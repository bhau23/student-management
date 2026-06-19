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

async function setAdminClaim() {
  const auth = getAuth();
  const email = 'eqourse@gmail.com';
  try {
    const user = await auth.getUserByEmail(email);
    console.log("Current claims for", email, ":", user.customClaims);
    
    // Set super_admin claim
    await auth.setCustomUserClaims(user.uid, { role: 'super_admin' });
    console.log("Successfully set super_admin claim for", email);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

setAdminClaim().catch(console.error).finally(() => process.exit(0));
