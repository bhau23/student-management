/**
 * Test: Can the service account actually read/download files from Drive?
 */
const { google } = require('googleapis');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const saKey = JSON.parse(raw.replace(/\\\\n/g, '\\n'));

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  // Test with an actual transcript file ID from the patched data
  // hgy-eqfd-dhp_2026-06-15 transcript: 1J5q21hKTLY7wiWz5CwrZvKSrQv7WSWGLqutACPbzeNI
  const transcriptId = '1J5q21hKTLY7wiWz5CwrZvKSrQv7WSWGLqutACPbzeNI';
  // hgy-eqfd-dhp_2026-06-15 recording: 1HWjceG_NEnk1M-kh7ERnO1Itz015tK9x
  const videoId = '1HWjceG_NEnk1M-kh7ERnO1Itz015tK9x';

  // Test 1: Can we get file metadata?
  console.log('=== Test 1: Get transcript metadata ===');
  try {
    const meta = await drive.files.get({ fileId: transcriptId, fields: 'id, name, mimeType, size' });
    console.log('✓ Metadata:', JSON.stringify(meta.data));
  } catch (e) {
    console.log('✗ Error:', e.message);
    if (e.errors) console.log('  Details:', JSON.stringify(e.errors));
  }

  // Test 2: Can we export the transcript as HTML?
  console.log('\n=== Test 2: Export transcript as HTML ===');
  try {
    const exported = await drive.files.export(
      { fileId: transcriptId, mimeType: 'text/html' },
      { responseType: 'arraybuffer' },
    );
    const html = Buffer.from(exported.data).toString('utf8').substring(0, 200);
    console.log('✓ Got HTML (first 200 chars):', html);
  } catch (e) {
    console.log('✗ Error:', e.message);
    if (e.errors) console.log('  Details:', JSON.stringify(e.errors));
  }

  // Test 3: Can we get video metadata?
  console.log('\n=== Test 3: Get video metadata ===');
  try {
    const meta = await drive.files.get({ fileId: videoId, fields: 'id, name, mimeType, size' });
    console.log('✓ Metadata:', JSON.stringify(meta.data));
  } catch (e) {
    console.log('✗ Error:', e.message);
    if (e.errors) console.log('  Details:', JSON.stringify(e.errors));
  }

  // Test 4: Can we stream video?
  console.log('\n=== Test 4: Stream video (first 1KB) ===');
  try {
    const driveRes = await drive.files.get(
      { fileId: videoId, alt: 'media' },
      { responseType: 'stream', headers: { Range: 'bytes=0-1023' } },
    );
    console.log('✓ Status:', driveRes.status);
    console.log('  Content-Type:', driveRes.headers['content-type']);
    console.log('  Content-Range:', driveRes.headers['content-range']);
    // Consume some bytes to confirm
    let bytes = 0;
    for await (const chunk of driveRes.data) {
      bytes += chunk.length;
      if (bytes > 1024) break;
    }
    console.log('  Bytes received:', bytes);
  } catch (e) {
    console.log('✗ Error:', e.message);
    if (e.errors) console.log('  Details:', JSON.stringify(e.errors));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
