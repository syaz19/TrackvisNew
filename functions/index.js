/// <reference types="node" />
/* global require, exports */

// import ng Firebase Functions at admin SDK para sa server-side logic.
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// initialize ang Firebase admin sa Cloud Functions runtime.
admin.initializeApp();

// kunin ang Firestore instance para gumawa ng reads/writes.
const db = getFirestore();

// ==============================
// 1. REGISTER VISITOR
// ==============================
// Function para i-register ang bagong visitor o i-update ang RFID tag record. Ito ang ginagamit kapag nag-register ng visitor at ina-assign ang RFID tag.
exports.registerVisitor = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, visitorInfo } = req.body || {};

    // kailangan ng EPC para malaman kung aling RFID tag ang i-a-assign.
    if (!epc) {
      return res.status(400).send("Missing EPC");
    }

    // i-save o i-merge ang visitor info sa rfid_tags collection.
    await db.collection("rfid_tags").doc(epc).set(
      {
        ...visitorInfo,
        Status: "In Use",
        currentLocation: "Entrance",
        assignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // response sa caller na successful ang registration.
    res.send("Visitor Registered");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// ==============================
// 2. UPDATE RFID LOCATION
// ==============================
// Function para mag-update ng visitor location kapag nade-detect ang RFID sa isang reader.
exports.updateRFIDLocation = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};

    // kailangan ang EPC at location para malaman kung saan ilalagay ang visitor.
    if (!epc || !location) {
      return res.status(400).send("Missing data");
    }

    // hanapin ang visitor record base sa UID na katumbas ng EPC.
    const visitorQuery = await db
      .collection("visitors")
      .where("uid", "==", epc)
      .limit(1)
      .get();

    if (visitorQuery.empty) {
      return res.status(404).send("Visitor not found");
    }

    const visitorRef = visitorQuery.docs[0].ref;

    // i-update ang visitor document sa bagong lokasyon.
    await visitorRef.update({
      currentLocation: location,
      location: location,
      lastSeen: FieldValue.serverTimestamp(),
    });

    // i-update rin ang RFID tag record sa rfid_tags collection.
    await db.collection("rfid_tags").doc(epc).set(
      {
        currentLocation: location,
        lastScan: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.send("Location Updated");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// ==============================
// 3. SCAN RFID (Replacement for Render)
// ==============================
// Function para iproseso ang RFID scan event at i-log ang history ng reader scan.
exports.scanRFID = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};

    // siguraduhin na may sapat na data bago magpatuloy.
    if (!epc || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing EPC or Location",
      });
    }

    const now = FieldValue.serverTimestamp();

    // hanapin ang active visitor na may katugmang UID/EPC.
    let visitorDoc = null;

    const visitorQuery = await db
      .collection("visitors")
      .where("uid", "==", epc)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!visitorQuery.empty) {
      visitorDoc = visitorQuery.docs[0];
    } else {
      const directDoc = await db.collection("visitors").doc(epc).get();
      if (directDoc.exists && directDoc.data()?.status === "active") {
        visitorDoc = directDoc;
      }
    }

      //May RFID scan pero wala itong active visitor na naka-assign.
    if (!visitorDoc) {
      return res.json({
        success: false,
        message: "RFID tag not assigned to an active visitor",
      });
    }

    // i-update ang visitor record sa aktwal na lokasyon.
    await visitorDoc.ref.update({
      currentLocation: location,
      location,
      lastSeen: now,
    });

    // i-log ang pinaka-huling reader scan sa reader_scans collection.
    await db.collection("reader_scans").doc(epc).set(
      {
        epc,
        lastLocation: location,
        lastScan: now,
      },
      { merge: true }
    );

    // magdagdag rin ng history entry sa subcollection ng reader_scans.
    await db
      .collection("reader_scans")
      .doc(epc)
      .collection("history")
      .add({
        location,
        timestamp: now,
      });

    // visitor_history collection removed to avoid duplication; history kept under reader_scans and visitors

    await db.collection("rfid_tags").doc(epc).set(
      {
        currentLocation: location,
        lastScan: now,
        updatedAt: now,
      },
      { merge: true }
    );

    res.json({
      success: true,
      message: "RFID Scan Processed",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==============================
// 4. SYNC RFID TAG UPDATES TO VISITOR
// ==============================
exports.onRFIDTagUpdate = functions.firestore
  .document("rfid_tags/{tagId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const tagId = context.params.tagId;

    const locationChanged = before.currentLocation !== after.currentLocation;
    const lastScanChanged = before.lastScan !== after.lastScan;

    if (!locationChanged && !lastScanChanged) {
      return null;
    }

    const updates = {};

    if (after.currentLocation) {
      updates.currentLocation = after.currentLocation;
      updates.location = after.currentLocation;
    }

    if (after.lastScan) {
      updates.lastSeen = after.lastScan;
    }

    if (Object.keys(updates).length === 0) {
      return null;
    }

    const visitorQuery = await db
      .collection("visitors")
      .where("uid", "==", tagId)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (visitorQuery.empty) {
      return null;
    }

    const visitorRef = visitorQuery.docs[0].ref;
    return visitorRef.update(updates);
  });

// ==============================
// 5. RELEASE RFID WHEN VISITOR IS DELETED
// ==============================
// Firestore trigger kapag nabura ang visitor document.
exports.onVisitorDelete = functions.firestore
  .document("visitors/{id}")
  .onDelete(async (snap) => {
    try {
      const data = snap.data() || {};

      const epc = data.uid || data.epc;

      if (!epc) return null;

      // i-reset ang RFID tag status kapag na-unassign ang visitor.
      await db.collection("rfid_tags").doc(String(epc)).set(
        {
          Status: "Available",
          UsedBy: "",
          assignedAt: null,
          currentLocation: FieldValue.delete(),
          lastScan: FieldValue.delete(),
          updatedAt: FieldValue.delete(),
        },
        { merge: true }
      );

      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  });

// ==============================
// 5. RELEASE RFID WHEN AUTH USER IS DELETED
// ==============================
// Firebase Auth trigger kapag na-delete ang user account.
exports.onAuthUserDelete = functions.auth.user().onDelete(async (user) => {
  try {
    const values = [];

    if (user.email) values.push(user.email);

    if (user.displayName) values.push(user.displayName);

    // hanapin lahat ng RFID tags na naka-assign sa user email o display name.
    for (const value of values) {
      const snapshot = await db
        .collection("rfid_tags")
        .where("UsedBy", "==", value)
        .get();

      for (const doc of snapshot.docs) {
        await doc.ref.update({
          Status: "Available",
          UsedBy: "",
          assignedAt: null,
          currentLocation: FieldValue.delete(),
          lastScan: FieldValue.delete(),
          updatedAt: FieldValue.delete(),
        });
      }
    }

    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
});