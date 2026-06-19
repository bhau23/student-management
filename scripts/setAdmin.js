require('dotenv').config({ path: '.env.local' });
const { getAuth } = require('firebase-admin/auth');
const getAdminApp = require('./src/lib/firebaseAdmin').default;

async function setAdminClaim() {
  const app = getAdminApp();
  const auth = getAuth(app);
  
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
