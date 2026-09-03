/// <reference types="node" />
/* global require, exports */


const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");


admin.initializeApp();


const db = getFirestore();


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
        assignedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    
    res.send("Visitor Registered");
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});


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
      lastSeen: FieldValue.serverTimestamp(),
    });

    
    await db.collection("rfid_tags").doc(epc).set(
      {
        currentLocation: location,
        lastScan: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.send("Location Updated");
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});


exports.scanRFID = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};

    
    if (!epc || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing EPC or Location",
      });
    }

    const now = FieldValue.serverTimestamp();

    
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

      
    if (!visitorDoc) {
      return res.json({
        success: false,
        message: "RFID tag not assigned to an active visitor",
      });
    }

    
    await visitorDoc.ref.update({
      currentLocation: location,
      location,
      lastSeen: now,
    });

    
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
          currentLocation: FieldValue.delete(),
          lastScan: FieldValue.delete(),
          updatedAt: FieldValue.delete(),
        },
        { merge: true }
      );

      return null;
    } catch (error) {
      console.error(error);
      return null;
    }
  });


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
          currentLocation: FieldValue.delete(),
          lastScan: FieldValue.delete(),
          updatedAt: FieldValue.delete(),
        });
      }
    }

    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
});