const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!serviceAccount) {
  console.error('Missing serviceAccountKey.json in this folder. Get this from Firebase Console.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function releaseStuckTags() {
  try {
    const tagsSnap = await db.collection('rfid_tags').where('Status', '==', 'In Use').get();
    console.log(`Found ${tagsSnap.size} tags marked In Use`);

    let released = 0;
    for (const tagDoc of tagsSnap.docs) {
      const epc = tagDoc.id;
      // check for any active visitor with this uid
      const vq = await db.collection('visitors').where('uid', '==', epc).where('status', '==', 'active').limit(1).get();
      if (vq.empty) {
        try {
          await db.collection('rfid_tags').doc(epc).update({
            Status: 'Available',
            UsedBy: '',
            assignedAt: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`Released tag ${epc}`);
          released++;
        } catch (e) {
          console.warn(`Failed to release tag ${epc}:`, e.message || e);
        }
      } else {
        console.log(`Tag ${epc} has active visitor; skipping`);
      }
    }

    console.log(`Done. Released ${released} tags.`);
    process.exit(0);
  } catch (err) {
    console.error('Error releasing stuck tags:', err);
    process.exit(2);
  }
}

releaseStuckTags();
