const fs = require('fs');
const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([^']+)'/);
const sa = match[1];
const parsed = JSON.parse(sa);
if (parsed.private_key.includes('\\n')) {
  parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
}

if (!getApps().length) {
  initializeApp({ credential: cert(parsed) });
}

async function listUsers() {
  const auth = getAuth();
  const listUsersResult = await auth.listUsers(10);
  listUsersResult.users.forEach((userRecord) => {
    console.log('user', userRecord.toJSON());
  });
}

listUsers().catch(console.error).finally(() => process.exit(0));
