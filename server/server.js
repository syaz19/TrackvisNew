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
    // -----------------------------
    const visitorRef = db.collection("visitors").doc(epc);
    const visitorDoc = await visitorRef.get();

    if (!visitorDoc.exists) {
      return res.json({
        success: true,
        message: "Visitor not found. Reader scan saved."
      });
    }

    const visitorData = visitorDoc.data();
    if (visitorData?.status !== "active") {
      return res.json({
        success: true,
        message: "Visitor is not active. Reader scan saved."
      });
    }

    // -----------------------------
    // UPDATE CURRENT LOCATION
    // -----------------------------
    await visitorRef.update({
      currentLocation: location,
      location: location,
      lastSeen: now
    });

    // -----------------------------
    // VISITOR HISTORY
    // Document ID = EPC
    // -----------------------------
    const historyRef = db.collection("visitor_history").doc(epc);

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