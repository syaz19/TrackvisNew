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
    const readerRef = db.collection("reader_scans").doc(epc);

    await readerRef.set(
      {
        epc,
        lastLocation: location,
        lastScan: now
      },
      { merge: true }
    );

    await readerRef.collection("history").add({
      location,
      timestamp: now
    });

    const visitorSnapshot = await db
      .collection("visitors")
      .where("uid", "==", epc)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (visitorSnapshot.empty) {
      return res.json({
        success: true,
        message: "Active visitor not found for this EPC. Reader scan saved."
      });
    }

    const visitorDoc = visitorSnapshot.docs[0];

    await visitorDoc.ref.update({
      currentLocation: location,
      location,
      lastSeen: now
    });

    const historyRef = db.collection("visitor_history").doc(visitorDoc.id);

    await historyRef.set(
      {
        uid: epc,
        visitorId: visitorDoc.id,
        updatedAt: now
      },
      { merge: true }
    );

    await historyRef.collection("history").add({
      location,
      timestamp: now
    });

    res.json({
      success: true,
      message: "Visitor location updated."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});