const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([^']+)'/);
let sa = match[1];
if (sa.includes('\\n')) sa = sa.replace(/\\n/g, '\\\\n');
const parsed = JSON.parse(sa);

if (!getApps().length) {
  initializeApp({ credential: cert(parsed) });
}

async function test() {
  const db = getFirestore();
  const subjects = await db.collection('subjects').get();
  console.log("Subjects:");
  subjects.forEach(d => console.log(d.id, d.data()));

  const enrollments = await db.collection('enrollments').get();
  console.log("Enrollments:");
  enrollments.forEach(d => console.log(d.id, d.data()));
}

test().catch(console.error).finally(() => process.exit(0));
