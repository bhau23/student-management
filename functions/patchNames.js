const admin = require('firebase-admin');
const saKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.replace(/\\\\n/g, '\\n'));
admin.initializeApp({
  credential: admin.credential.cert(saKey)
});
const db = admin.firestore();

async function backfillNames() {
  console.log('Fetching tutors and subjects...');
  const [tutorsSnap, subjectsSnap] = await Promise.all([
    db.collection('tutors').get(),
    db.collection('subjects').get()
  ]);

  const tutorsMap = {};
  tutorsSnap.forEach(doc => tutorsMap[doc.id] = doc.data().name);

  const subjectsMap = {};
  subjectsSnap.forEach(doc => subjectsMap[doc.id] = doc.data().name);

  console.log('Backfilling enrollments...');
  let enrollmentsCount = 0;
  const enrollmentsSnap = await db.collection('enrollments').get();
  const batch1 = db.batch();
  enrollmentsSnap.forEach(doc => {
    const data = doc.data();
    const update = {};
    if (data.tutorId && tutorsMap[data.tutorId]) update.tutorName = tutorsMap[data.tutorId];
    if (data.subjectId && subjectsMap[data.subjectId]) update.subjectName = subjectsMap[data.subjectId];
    
    if (Object.keys(update).length > 0) {
      batch1.update(doc.ref, update);
      enrollmentsCount++;
    }
  });
  await batch1.commit();
  console.log(`Updated ${enrollmentsCount} enrollments.`);

  console.log('Backfilling class_sessions...');
  let sessionsCount = 0;
  const sessionsSnap = await db.collection('class_sessions').get();
  
  // Firestore batches have a 500 limit.
  const sessionDocs = sessionsSnap.docs;
  for (let i = 0; i < sessionDocs.length; i += 400) {
    const chunk = sessionDocs.slice(i, i + 400);
    const b = db.batch();
    chunk.forEach(doc => {
      const data = doc.data();
      const update = {};
      if (data.tutorId && tutorsMap[data.tutorId]) update.tutorName = tutorsMap[data.tutorId];
      if (data.subjectId && subjectsMap[data.subjectId]) update.subjectName = subjectsMap[data.subjectId];
      
      if (Object.keys(update).length > 0) {
        b.update(doc.ref, update);
        sessionsCount++;
      }
    });
    await b.commit();
  }
  
  console.log(`Updated ${sessionsCount} class_sessions.`);
}

backfillNames().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(console.error);
