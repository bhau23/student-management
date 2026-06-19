const fs = require('fs');
const { cert } = require('firebase-admin/app');

try {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const match = envText.match(/FIREBASE_SERVICE_ACCOUNT_KEY='([^']+)'/);
  if (!match) throw new Error("Could not find FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
  
  const sa = match[1];
  console.log("Raw env string starts with:", sa.substring(0, 50));
  const parsed = JSON.parse(sa);
  console.log("Parsed private key starts with:", parsed.private_key.substring(0, 50));
  console.log("Private key has real newlines?", parsed.private_key.includes('\n'));
  console.log("Private key has literal backslash-n?", parsed.private_key.includes('\\n'));
  
  if (parsed.private_key.includes('\\n')) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  cert(parsed);
  console.log("cert() succeeded!");
} catch (e) {
  console.error("Error:", e.message);
}
