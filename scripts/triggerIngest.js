const fs = require('fs');
const path = require('path');

// Set the credentials path for Firebase Admin and Google Auth
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:\\\\Users\\\\yobha\\\\Downloads\\\\student-mange\\\\tutrain-automation-firebase-adminsdk-fbsvc-42223ba939.json';
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'tutrain-automation' });

// We MUST set GOOGLE_DRIVE_SA_KEY because ingest.ts explicitly looks for it
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.GOOGLE_DRIVE_SA_KEY = fs.readFileSync(saPath, 'utf8');

// 5. Import and run the compiled function
const { ingestMeetData } = require('../functions/lib/ingest');

console.log("Starting manual trigger of ingestMeetData...");

ingestMeetData.run({}).then(() => {
  console.log("Manual trigger completed successfully!");
  process.exit(0);
}).catch(err => {
  console.error("Error running ingestMeetData:", err);
  process.exit(1);
});
