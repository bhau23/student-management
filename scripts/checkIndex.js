const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = "C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

if (!admin.getApps().length) {
  admin.initializeApp();
}

const db = getFirestore();

async function checkIndex() {
  try {
    console.log("Checking if the composite index is ready...");
    const snapshot = await db.collection('class_sessions')
      .orderBy('attendanceStatus', 'asc')
      .orderBy('flaggedUnderMin', 'asc')
      .orderBy('date', 'desc')
      .limit(1)
      .get();
      
    console.log("SUCCESS! The index is fully built and active. The dashboard should load perfectly now.");
  } catch (error) {
    if (error.message.includes('requires an index') || error.message.includes('FAILED_PRECONDITION')) {
      console.log("STILL BUILDING... The index is not quite ready yet. Give it another minute or two.");
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

checkIndex().catch(console.error).finally(() => process.exit(0));
