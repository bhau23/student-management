const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const saPath = 'C:\\\\Users\\\\yobha\\\\Downloads\\\\student-mange\\\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json';
initializeApp({ credential: cert(require(saPath)) });
const db = getFirestore();
async function run() {
  const snaps = await db.collection('class_sessions').where('meetingCode', '==', 'hgy-eqfd-dhp').get();
  console.log(`Found ${snaps.size} sessions for hgy-eqfd-dhp`);
  snaps.forEach(doc => console.log(doc.id, doc.data().date, doc.data().status));
  process.exit(0);
}
run();
