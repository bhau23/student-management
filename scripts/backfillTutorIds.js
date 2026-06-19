const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Initialize Admin SDK using the absolute path provided by the user in the prompt
const serviceAccountPath = "C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

if (!admin.getApps().length) {
  admin.initializeApp();
}

const db = getFirestore();

async function backfill() {
  console.log('Starting tutorIds backfill for students...');
  const snapshot = await db.collection('students').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.tutorIds) {
      batch.update(doc.ref, { tutorIds: [] });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully backfilled tutorIds on ${count} student(s).`);
  } else {
    console.log('All students already have tutorIds. No backfill needed.');
  }
}

backfill().catch(console.error).finally(() => process.exit(0));
