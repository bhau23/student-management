const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  initializeApp({ credential: cert(serviceAccount) });
}

async function backfillPerClassRate() {
  const db = getFirestore();

  console.log('Fetching tutors...');
  const tutorsSnap = await db.collection('tutors').get();
  const tutorsMap = new Map();
  tutorsSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.perClassRate) {
      tutorsMap.set(doc.id, data.perClassRate);
    }
  });

  console.log(`Found ${tutorsMap.size} tutors with perClassRate.`);

  if (tutorsMap.size === 0) {
    console.log('No tutors have perClassRate set. Skipping backfill.');
    return;
  }

  console.log('Fetching class sessions...');
  const sessionsSnap = await db.collection('class_sessions').get();
  
  let updatedCount = 0;
  const batch = db.batch();
  let ops = 0;

  for (const doc of sessionsSnap.docs) {
    const data = doc.data();
    if (data.perClassRate !== undefined) continue;

    const rate = tutorsMap.get(data.tutorId);
    if (rate !== undefined) {
      batch.update(doc.ref, { perClassRate: rate });
      ops++;
      updatedCount++;

      if (ops === 400) {
        await batch.commit();
        console.log(`Committed 400 updates...`);
        ops = 0;
      }
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`Done. Updated ${updatedCount} sessions.`);
}

backfillPerClassRate().catch(console.error).finally(() => process.exit(0));
