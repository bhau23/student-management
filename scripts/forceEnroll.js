const fs = require('fs');
const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const saPath = 'C:\\\\Users\\\\yobha\\\\Downloads\\\\student-mange\\\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json';
const parsed = require(saPath);

if (!getApps().length) {
  initializeApp({ credential: cert(parsed) });
}

async function forceCreateEnrollment() {
  const db = getFirestore();
  
  // 1. Get Subject (Chemistry)
  let subjectId = null;
  const subjectsSnap = await db.collection('subjects').where('name', '==', 'Chemistry').get();
  if (!subjectsSnap.empty) {
    subjectId = subjectsSnap.docs[0].id;
  } else {
    // create it just in case
    const ref = await db.collection('subjects').add({ name: 'Chemistry' });
    subjectId = ref.id;
  }
  
  // 2. Get Student (Vijayant Kumawat)
  let studentId = null;
  const studentsSnap = await db.collection('students').get();
  for (const doc of studentsSnap.docs) {
    if (doc.data().name.includes('Vijayant')) studentId = doc.id;
  }
  if (!studentId) throw new Error("Student Vijayant not found");

  // 3. Get Tutor (Meera Dureja)
  let tutorId = null;
  const tutorsSnap = await db.collection('tutors').get();
  for (const doc of tutorsSnap.docs) {
    if (doc.data().name.includes('Meera') || doc.data().name.includes('Ravina')) tutorId = doc.id;
  }
  if (!tutorId) tutorId = tutorsSnap.docs[0].id; // fallback to any tutor

  // 4. Create Enrollment
  const meetingCode = 'vst-fdtt-fci'; // Claude said vst-fdtt-fci
  
  const enrollmentRef = db.collection('enrollments').doc();
  const indexRef = db.collection('meetingCodeIndex').doc(meetingCode);
  const studentRef = db.collection('students').doc(studentId);

  await db.runTransaction(async (tx) => {
    const indexSnap = await tx.get(indexRef);
    if (indexSnap.exists) {
      console.log("Enrollment for this code already exists.");
      return;
    }
    tx.set(enrollmentRef, {
      studentId,
      subjectId,
      tutorId,
      meetingCode,
      scheduleDays: ['Mon', 'Wed', 'Fri'],
      scheduleTime: '18:00',
      expectedDurationMin: 60,
      minPresentMin: 45,
      monthlyQuota: 12,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(indexRef, { enrollmentId: enrollmentRef.id });
    tx.update(studentRef, { tutorIds: FieldValue.arrayUnion(tutorId) });
  });

  console.log("Successfully force-created the enrollment!");
}

forceCreateEnrollment().catch(console.error).finally(() => process.exit(0));
