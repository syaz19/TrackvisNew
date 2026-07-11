/* global require, process */
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("TrackVis backend is running");
});

// =========================
// RFID SCAN API
// =========================
app.post("/scan", async (req, res) => {
  try {

    const { epc, location } = req.body;

    if (!epc || !location) {
      return res.status(400).json({
        success: false,
        message: "Missing EPC or Location"
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    // -----------------------------
    // READER SCANS
    // Document ID = EPC
    // -----------------------------
    const readerRef = db.collection("reader_scans").doc(epc);

    await readerRef.set({
      epc: epc,
      lastLocation: location,
      lastScan: now
    }, { merge: true });

    await readerRef.collection("history").add({
      location: location,
      timestamp: now
    });

    // -----------------------------
    // FIND ACTIVE VISITOR
    // Query by UID field instead of using UID as document ID
    // -----------------------------
    const visitorQ = admin.firestore().collection("visitors")
      .where("uid", "==", epc)
      .where("status", "==", "active")
      .limit(1);
    
    const visitorSnap = await visitorQ.get();
    
    if (visitorSnap.empty) {
      return res.json({
        success: true,
        message: "Active visitor not found for this EPC. Reader scan saved."
      });
    }

    const visitorDoc = visitorSnap.docs[0];
    const visitorData = visitorDoc.data();

    // -----------------------------
    // UPDATE CURRENT LOCATION
    // -----------------------------
    await visitorDoc.ref.update({
      currentLocation: location,
      location: location,
      lastSeen: now
    });

    // -----------------------------
    // VISITOR HISTORY
    // Use visitor document ID for history tracking
    // -----------------------------
    const historyRef = db.collection("visitor_history").doc(visitorDoc.id);

    await historyRef.set({

      uid: epc,
      visitorId: visitorDoc.id,
      updatedAt: now

    }, { merge: true });

    await historyRef.collection("history").add({

      location: location,
      timestamp: now

    });

    res.json({

      success: true,
      message: "Visitor location updated."

    });

  } catch (err) {

    console.error(err);

    res.status(500).json({

      success: false,
      error: err.message

    });

  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});