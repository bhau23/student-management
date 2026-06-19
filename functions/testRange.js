const { google } = require('googleapis');
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const saKey = JSON.parse(raw.replace(/\\\\n/g, '\\n'));
async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });
  const videoId = '1HWjceG_NEnk1M-kh7ERnO1Itz015tK9x';
  try {
    const driveRes = await drive.files.get(
      { fileId: videoId, alt: 'media' },
      { responseType: 'stream', headers: { Range: 'bytes=0-1000000' } },
    );
    console.log('Status:', driveRes.status);
    console.log('Content-Type:', driveRes.headers['content-type']);
    console.log('Content-Range:', driveRes.headers['content-range']);
    console.log('Content-Length:', driveRes.headers['content-length']);
  } catch (e) { console.error(e.message); }
}
main();
