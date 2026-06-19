/**
 * Quick diagnostic script to check:
 * 1. What's in _system/ingestState (especially recordingsFolderId)
 * 2. What class_sessions exist and whether they have recording/transcript fields
 * 3. What files the Drive API sees in the recordings folder
 */
const admin = require('firebase-admin');
const { google } = require('googleapis');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const saKey = JSON.parse(raw.replace(/\\\\n/g, '\\n'));
admin.initializeApp({
  credential: admin.credential.cert(saKey),
  projectId: saKey.project_id,
});
const db = admin.firestore();

async function main() {
  // 1. Check ingestState
  console.log('\n=== _system/ingestState ===');
  const stateSnap = await db.doc('_system/ingestState').get();
  if (!stateSnap.exists) {
    console.log('❌ Document does NOT exist!');
    return;
  }
  const state = stateSnap.data();
  console.log(JSON.stringify(state, null, 2));

  // 2. Check class_sessions for recording fields
  console.log('\n=== class_sessions with recording/transcript fields ===');
  const sessSnap = await db.collection('class_sessions').get();
  let withRec = 0, withTrans = 0, withChat = 0, total = 0;
  for (const doc of sessSnap.docs) {
    total++;
    const d = doc.data();
    if (d.recordingDriveId) withRec++;
    if (d.transcriptDriveId) withTrans++;
    if (d.chatDriveId) withChat++;
    console.log(`  ${doc.id}: recording=${d.recordingDriveId || 'NONE'}, transcript=${d.transcriptDriveId || 'NONE'}, chat=${d.chatDriveId || 'NONE'}`);
  }
  console.log(`\nTotals: ${total} sessions, ${withRec} with video, ${withTrans} with transcript, ${withChat} with chat`);

  // 3. Check what's in the recordings folder on Drive
  console.log('\n=== Drive files in recordingsFolderId ===');
  const auth = new google.auth.GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const recFolderId = state.recordingsFolderId;
  const repFolderId = state.reportsFolderId;
  
  console.log(`recordingsFolderId: ${recFolderId}`);
  console.log(`reportsFolderId: ${repFolderId}`);
  console.log(`Same folder? ${recFolderId === repFolderId}`);

  if (recFolderId) {
    const res = await drive.files.list({
      q: `'${recFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      pageSize: 50,
    });
    const files = res.data.files || [];
    console.log(`\nFiles in recordings folder (${files.length}):`);
    for (const f of files) {
      console.log(`  ${f.name} [${f.mimeType}] id=${f.id}`);
    }
  }

  // Also check the reports folder (user said videos are in the same folder)
  if (repFolderId && repFolderId !== recFolderId) {
    console.log('\n=== Drive files in reportsFolderId ===');
    const res = await drive.files.list({
      q: `'${repFolderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, modifiedTime)',
      pageSize: 50,
    });
    const files = res.data.files || [];
    console.log(`Files in reports folder (${files.length}):`);
    for (const f of files) {
      console.log(`  ${f.name} [${f.mimeType}] id=${f.id}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
