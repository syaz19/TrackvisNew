/// <reference types="node" />
/* global require, exports */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// ==============================
// 1. REGISTER VISITOR
// ==============================
exports.registerVisitor = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, visitorInfo } = req.body || {};

    if (!epc) {
      return res.status(400).send("Missing EPC");
    }

    await db.collection("rfid_tags").doc(epc).set(
      {
        ...visitorInfo,
        Status: "In Use",
        currentLocation: "Entrance",
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("rfid_logs").add({
      epc,
      location: "Entrance",
      time: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send("Visitor Registered");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// ==============================
// 2. UPDATE RFID LOCATION
// ==============================
exports.updateRFIDLocation = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};

    if (!epc || !location) {
      return res.status(400).send("Missing data");
    }

    const visitorQuery = await db
      .collection("visitors")
      .where("uid", "==", epc)
      .limit(1)
      .get();

    if (visitorQuery.empty) {
      return res.status(404).send("Visitor not found");
    }

    const visitorRef = visitorQuery.docs[0].ref;

    await visitorRef.update({
      currentLocation: location,
      location: location,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("rfid_tags").doc(epc).set(
      {
        currentLocation: location,
        lastScan: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection("rfid_logs").add({
      epc,
      location,
      time: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.send("Location Updated");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

// ==============================
// 3. SCAN RFID (Replacement for Render)
// ==============================
exports.scanRFID = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};

    if (!epc || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing EPC or Location",
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("reader_scans").doc(epc).set(
      {
        epc,
        lastLocation: location,
        lastScan: now,
      },
      { merge: true }
    );

    await db
      .collection("reader_scans")
      .doc(epc)
      .collection("history")
      .add({
        location,
        timestamp: now,
      });

    const visitorSnapshot = await db
      .collection("visitors")
      .where("uid", "==", epc)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (!visitorSnapshot.empty) {
      const visitorDoc = visitorSnapshot.docs[0];

      await visitorDoc.ref.update({
        currentLocation: location,
        location,
        lastSeen: now,
      });

      await db.collection("visitor_history").doc(visitorDoc.id).set(
        {
          uid: epc,
          visitorId: visitorDoc.id,
          updatedAt: now,
        },
        { merge: true }
      );

      await db
        .collection("visitor_history")
        .doc(visitorDoc.id)
        .collection("history")
        .add({
          location,
          timestamp: now,
        });

      await db.collection("rfid_tags").doc(epc).set(
        {
          currentLocation: location,
          lastScan: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await db.collection("rfid_logs").add({
        epc,
        location,
        time: now,
      });
    }

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
// 4. RELEASE RFID WHEN VISITOR IS DELETED
// ==============================
exports.onVisitorDelete = functions.firestore
  .document("visitors/{id}")
  .onDelete(async (snap) => {
    try {
      const data = snap.data() || {};

      const epc = data.uid || data.epc;

      if (!epc) return null;

      await db.collection("rfid_tags").doc(String(epc)).set(
        {
          Status: "Available",
          UsedBy: "",
          assignedAt: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
exports.onAuthUserDelete = functions.auth.user().onDelete(async (user) => {
  try {
    const values = [];

    if (user.email) values.push(user.email);

    if (user.displayName) values.push(user.displayName);

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
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
});