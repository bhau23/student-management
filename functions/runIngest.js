
const { ingestMeetData } = require('./lib/ingest.js');

(async () => {
  try {
    console.log("Triggering ingestMeetData locally...");
    // For Firebase Functions v2, .run() executes the handler directly
    await ingestMeetData.run({});
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
