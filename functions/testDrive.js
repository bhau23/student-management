const { google } = require('googleapis');

const saKey = process.env.GOOGLE_DRIVE_SA_KEY || require("C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json");

async function testDrive() {
  const auth = new google.auth.GoogleAuth({
    credentials: saKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  try {
    console.log("Checking Reports Folder...");
    const reports = await drive.files.list({
      q: `'1cg8BXql3S-QWHanBAaoPd5meyxFGy2o8' in parents and trashed = false`,
      fields: 'files(id, name)'
    });
    console.log(`✓ Reports folder connected! Found ${reports.data.files.length} files.`);

    console.log("Checking Recordings Folder...");
    const recs = await drive.files.list({
      q: `'1a6UWiNXHZtxREiGFCzksD5Fq-3UlxnI0' in parents and trashed = false`,
      fields: 'files(id, name)'
    });
    console.log(`✓ Recordings folder connected! Found ${recs.data.files.length} files.`);
    
  } catch (err) {
    console.error("❌ Drive Connection Failed:", err.message);
  }
}

testDrive().catch(console.error);
