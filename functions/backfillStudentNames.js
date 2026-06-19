const admin = require('firebase-admin');
const saKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY.replace(/\\\\n/g, '\\n'));
admin.initializeApp({
  credential: admin.credential.cert(saKey)
});
const db = admin.firestore();

async function backfillStudentNames() {
  console.log('Fetching students...');
  const studentsSnap = await db.collection('students').get();
  const studentsMap = {};
  studentsSnap.forEach(doc => {
    studentsMap[doc.id] = doc.data().name;
  });

  console.log('Backfilling enrollments...');
  let enrollmentsCount = 0;
  const enrollmentsSnap = await db.collection('enrollments').get();
  const batch1 = db.batch();
  enrollmentsSnap.forEach(doc => {
    const data = doc.data();
    if (data.studentId && studentsMap[data.studentId]) {
      batch1.update(doc.ref, { studentName: studentsMap[data.studentId] });
      enrollmentsCount++;
    }
  });
  await batch1.commit();
  console.log(`Updated ${enrollmentsCount} enrollments with studentName.`);

  console.log('Backfilling class_sessions...');
  let sessionsCount = 0;
  const sessionsSnap = await db.collection('class_sessions').get();
  
  const sessionDocs = sessionsSnap.docs;
  for (let i = 0; i < sessionDocs.length; i += 400) {
    const chunk = sessionDocs.slice(i, i + 400);
    const b = db.batch();
    chunk.forEach(doc => {
      const data = doc.data();
      if (data.studentId && studentsMap[data.studentId]) {
        b.update(doc.ref, { studentName: studentsMap[data.studentId] });
        sessionsCount++;
      }
    });
    await b.commit();
  }
  
  console.log(`Updated ${sessionsCount} class_sessions with studentName.`);
}

backfillStudentNames().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(console.error);
