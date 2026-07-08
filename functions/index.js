/// <reference types="node" />
/* global require, exports */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
// exports is provided by the Node.js module system; no extra binding needed

// -----------------------------
// 1. REGISTER VISITOR (Entrance Auto)
// -----------------------------
exports.registerVisitor = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, visitorInfo } = req.body || {};
    if (!epc) return res.status(400).send("Missing EPC");

    // update tag info (merge)
    await admin.firestore().collection("rfid_tags").doc(epc).set({
      ...visitorInfo,
      Status: "In Use",
      currentLocation: "Entrance",
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

   

    // log entrance
    await admin.firestore().collection("rfid_logs").add({
      epc,
      location: "Entrance",
      time: admin.firestore.FieldValue.serverTimestamp()
    });

    res.send("Visitor Registered at Entrance");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || String(err));
  }
});

// -----------------------------
// 2. RFID SCAN UPDATE (Library etc.)
// -----------------------------
exports.updateRFIDLocation = functions.https.onRequest(async (req, res) => {
  try {
    const { epc, location } = req.body || {};
    if (!epc || !location) {
      return res.status(400).send("Missing data");
    }

    // Hanapin ang visitor gamit ang UID (EPC)
    const visitorQuery = await admin.firestore()
      .collection("visitors")
      .where("uid", "==", epc)
      .limit(1)
      .get();

    if (visitorQuery.empty) {
      return res.status(404).send("Visitor not found");
    }

    const visitorDoc = visitorQuery.docs[0];
    const visitorRef = visitorDoc.ref;

    // update visitor current location and last seen
    await visitorRef.update({
      currentLocation: location,
      lastSeen: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update visitor location
    await visitorRef.update({
      currentLocation: location,
      location: location,
      lastSeen: Date.now()
    });

    // update tag
    await admin.firestore().collection("rfid_tags").doc(epc).update({
      currentLocation: location,
      lastScan: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // log movement
    await admin.firestore().collection("rfid_logs").add({
      epc,
      location,
      time: admin.firestore.FieldValue.serverTimestamp()
    });

    res.send("Location Updated");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message || String(err));
  }
});

// -----------------------------
// 3. CLEANUP: Release RFID tag when a visitor document is deleted
// -----------------------------
exports.onVisitorDelete = functions.firestore.document('visitors/{id}').onDelete(async (snap, context) => {
  try {
    const data = snap.data() || {};
    let epc = data.uid || data.epc;
    if (epc == null) return null;
    epc = String(epc);
    const visitorId = context && context.params && context.params.id ? String(context.params.id) : null;
    console.log(`onVisitorDelete: visitorId=${visitorId}, epc=${epc}`);

    // set tag to available so it can be reused
    await admin.firestore().collection('rfid_tags').doc(epc).update({
      Status: 'Available',
      UsedBy: '',
      assignedAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return null;
  } catch (err) {
    console.error('onVisitorDelete error:', err);
    return null;
  }
});

// -----------------------------
// 4. CLEANUP: Release RFID tags when an Auth user is deleted
// If tags have `UsedBy` set to the user's email or displayName, clear them.
// -----------------------------
exports.onAuthUserDelete = functions.auth.user().onDelete(async (user) => {
  try {
    const candidates = [];
    if (user.email) candidates.push(user.email);
    if (user.displayName) candidates.push(user.displayName);

    const tagsRef = admin.firestore().collection('rfid_tags');
    for (const val of candidates) {
      const q = await tagsRef.where('UsedBy', '==', val).get();
      for (const d of q.docs) {
        try {
          await d.ref.update({
            Status: 'Available',
            UsedBy: '',
            assignedAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } catch (e) {
          console.warn('Failed to clear tag for deleted user:', d.id, e);
        }
      }
    }
    return null;
  } catch (err) {
    console.error('onAuthUserDelete error:', err);
    return null;
  }
});
