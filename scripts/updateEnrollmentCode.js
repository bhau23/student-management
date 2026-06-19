const fs = require('fs');
const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const saPath = 'C:\\\\Users\\\\yobha\\\\Downloads\\\\student-mange\\\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json';
const parsed = require(saPath);

if (!getApps().length) {
  initializeApp({ credential: cert(parsed) });
}

async function updateEnrollmentCode() {
  const db = getFirestore();
  const oldCode = 'vst-fdtt-fci';
  const newCode = 'hgy-eqfd-dhp';
  
  const indexSnap = await db.collection('meetingCodeIndex').doc(oldCode).get();
  if (!indexSnap.exists) {
    console.log("Could not find the old enrollment by code!");
    return;
  }
  
  const enrollmentId = indexSnap.data().enrollmentId;
  const enrollmentRef = db.collection('enrollments').doc(enrollmentId);
  const oldIndexRef = db.collection('meetingCodeIndex').doc(oldCode);
  const newIndexRef = db.collection('meetingCodeIndex').doc(newCode);

  await db.runTransaction(async (tx) => {
    tx.delete(oldIndexRef);
    tx.set(newIndexRef, { enrollmentId });
    tx.update(enrollmentRef, { 
      meetingCode: newCode,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  console.log(`Successfully updated the meeting code from ${oldCode} to ${newCode}!`);
}

updateEnrollmentCode().catch(console.error).finally(() => process.exit(0));
