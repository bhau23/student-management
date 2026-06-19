const admin = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = "C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;

if (!admin.getApps().length) {
  admin.initializeApp();
}

const db = getFirestore();

async function checkState() {
  const snap = await db.doc('_system/ingestState').get();
  if (snap.exists) {
    console.log("State exists:", snap.data());
  } else {
    console.log("State does NOT exist!");
  }
}
checkState().catch(console.error).finally(() => process.exit(0));
