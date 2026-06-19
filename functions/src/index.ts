/**
 * Tutrain Cloud Functions — index.ts
 * Exports all functions for Firebase deployment.
 */

// Ingestion pipeline
export { ingestMeetData } from './ingest';

// Daily missed-class sweep
export { sweepMissed } from './sweepMissed';

// Firestore audit triggers
export { auditStudents, auditTutors, auditEnrollments, auditSubjects } from './auditTrigger';

// Auth claims — set via Firestore onCreate trigger on /users/{uid}
export { onNewUserDoc, refreshClaims } from './setClaims';

// Secure recording / transcript streaming
export { streamRecording } from './streamRecording';

// Phase 9: Automations & Notifications
export {
  classReminder, feeReminder, ptmReminder, testReminder,
  onPaymentCreated, onPayoutCreated, onPTMCompleted
} from './notifications';
