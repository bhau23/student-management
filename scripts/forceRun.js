const admin = require('firebase-admin/app');
const serviceAccountPath = "C:\\Users\\yobha\\Downloads\\student-mange\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json";
process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
process.env.GOOGLE_DRIVE_SA_KEY = JSON.stringify(require(serviceAccountPath));

if (!admin.getApps().length) {
  admin.initializeApp();
}

const { ingestMeetData } = require('../functions/lib/ingest.js');

async function run() {
  console.log("Force-triggering ingestMeetData...");
  try {
    await ingestMeetData.run({});
    console.log("Run completed successfully.");
  } catch (err) {
    console.error("Run failed:", err);
  }
}

run().catch(console.error).finally(() => process.exit(0));
