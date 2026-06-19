const fs = require('fs');
const { google } = require('googleapis');
const { cert, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const saPath = 'C:\\\\Users\\\\yobha\\\\Downloads\\\\student-mange\\\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json';
const credentials = require(saPath);

initializeApp({ credential: cert(credentials) });
const db = getFirestore();

async function run() {
  const stateSnap = await db.doc('_system/ingestState').get();
  if (!stateSnap.exists) throw new Error("ingestState not found");
  const state = stateSnap.data();
  console.log("Configured Folders:", state);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  console.log("Searching Drive for hgy-eqfd-dhp...");
  try {
    const res = await drive.files.list({
      q: `name contains 'hgy-eqfd-dhp' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 50
    });
    console.log("Found:", res.data.files);
  } catch (e) {
    console.log("Search error:", e.message);
  }
}

run().catch(console.error).finally(() => process.exit(0));
