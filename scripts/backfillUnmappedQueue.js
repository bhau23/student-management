const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Use the existing path
const serviceAccountPath = "C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

if (!admin.getApps().length) {
  admin.initializeApp();
}

const db = getFirestore();

async function backfillUnmappedQueue() {
  console.log('Starting unmappedQueue dismissed backfill...');
  const snapshot = await db.collection('unmappedQueue').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.dismissed === undefined) {
      batch.update(doc.ref, { dismissed: false });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully backfilled dismissed=false on ${count} unmapped queue entries.`);
  } else {
    console.log('All unmapped queue entries already have the dismissed field. No backfill needed.');
  }
}

backfillUnmappedQueue().catch(console.error).finally(() => process.exit(0));
