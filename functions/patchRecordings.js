/**
 * One-time script: Link ALL recording/transcript/chat files from Google Drive
 * to their matching class_sessions in Firestore.
 * 
 * This bypasses the 72h rolling window that the scheduled ingest uses.
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

// Same regex as ingest.ts
function parseRecordingName(name) {
  let m = /^([a-z]{3}-[a-z]{4}-[a-z]{3})\s+\((\d{4}-\d{2}-\d{2})/.exec(name);
  if (m) return { code: m[1], date: m[2] };
  m = /^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}\s+([a-z]{3}-[a-z]{4}-[a-z]{3})/.exec(name);
  if (m) return { code: m[2], date: m[1] };
  return null;
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Get the recordings folder ID from _system/ingestState
  const stateSnap = await db.doc('_system/ingestState').get();
  const state = stateSnap.data();
  const recFolderId = state.recordingsFolderId;

  console.log(`Fetching ALL files from recordings folder ${recFolderId}...`);

  // List ALL files (no date filter)
  let allFiles = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      q: `'${recFolderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime)',
      pageSize: 200,
      pageToken,
    });
    allFiles = allFiles.concat(res.data.files || []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${allFiles.length} total files in recordings folder.`);

  // Group by (code, date)
  const groups = {};
  for (const f of allFiles) {
    const parsed = parseRecordingName(f.name || '');
    if (!parsed) { continue; }
    const key = `${parsed.code}_${parsed.date}`;
    (groups[key] ||= []).push(f);
  }

  console.log(`Grouped into ${Object.keys(groups).length} (code, date) groups.`);

  // For each group, check if session exists and patch recording fields
  let patched = 0, skipped = 0, noSession = 0;

  for (const [key, files] of Object.entries(groups)) {
    const sessionRef = db.doc(`class_sessions/${key}`);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      noSession++;
      continue;
    }

    const existing = sessionSnap.data();
    const patch = {};

    for (const f of files) {
      const lower = (f.name || '').toLowerCase();
      if (lower.includes('chat') && !existing.chatDriveId) {
        patch.chatDriveId = f.id;
      } else if ((lower.includes('transcript') || lower.endsWith('.vtt') || lower.endsWith('.sbv')) && !existing.transcriptDriveId) {
        patch.transcriptDriveId = f.id;
      } else if (
        (lower.includes('recording') || lower.endsWith('.mp4') || lower.endsWith('.webm') ||
         (f.mimeType && f.mimeType.startsWith('video/')))
        && !existing.recordingDriveId
      ) {
        patch.recordingDriveId = f.id;
      }
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await sessionRef.set(patch, { merge: true });
      console.log(`✓ Patched ${key}: ${JSON.stringify(patch)}`);
      patched++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone! Patched: ${patched}, Already OK: ${skipped}, No session: ${noSession}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
