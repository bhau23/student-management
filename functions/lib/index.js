"use strict";
/**
 * Tutrain Cloud Functions — index.ts
 * Exports all functions for Firebase deployment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPTMCompleted = exports.onPayoutCreated = exports.onPaymentCreated = exports.testReminder = exports.ptmReminder = exports.feeReminder = exports.classReminder = exports.streamRecording = exports.refreshClaims = exports.onNewUserDoc = exports.auditSubjects = exports.auditEnrollments = exports.auditTutors = exports.auditStudents = exports.sweepMissed = exports.ingestMeetData = void 0;
// Ingestion pipeline
var ingest_1 = require("./ingest");
Object.defineProperty(exports, "ingestMeetData", { enumerable: true, get: function () { return ingest_1.ingestMeetData; } });
// Daily missed-class sweep
var sweepMissed_1 = require("./sweepMissed");
Object.defineProperty(exports, "sweepMissed", { enumerable: true, get: function () { return sweepMissed_1.sweepMissed; } });
// Firestore audit triggers
var auditTrigger_1 = require("./auditTrigger");
Object.defineProperty(exports, "auditStudents", { enumerable: true, get: function () { return auditTrigger_1.auditStudents; } });
Object.defineProperty(exports, "auditTutors", { enumerable: true, get: function () { return auditTrigger_1.auditTutors; } });
Object.defineProperty(exports, "auditEnrollments", { enumerable: true, get: function () { return auditTrigger_1.auditEnrollments; } });
Object.defineProperty(exports, "auditSubjects", { enumerable: true, get: function () { return auditTrigger_1.auditSubjects; } });
// Auth claims — set via Firestore onCreate trigger on /users/{uid}
var setClaims_1 = require("./setClaims");
Object.defineProperty(exports, "onNewUserDoc", { enumerable: true, get: function () { return setClaims_1.onNewUserDoc; } });
Object.defineProperty(exports, "refreshClaims", { enumerable: true, get: function () { return setClaims_1.refreshClaims; } });
// Secure recording / transcript streaming
var streamRecording_1 = require("./streamRecording");
Object.defineProperty(exports, "streamRecording", { enumerable: true, get: function () { return streamRecording_1.streamRecording; } });
// Phase 9: Automations & Notifications
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "classReminder", { enumerable: true, get: function () { return notifications_1.classReminder; } });
Object.defineProperty(exports, "feeReminder", { enumerable: true, get: function () { return notifications_1.feeReminder; } });
Object.defineProperty(exports, "ptmReminder", { enumerable: true, get: function () { return notifications_1.ptmReminder; } });
Object.defineProperty(exports, "testReminder", { enumerable: true, get: function () { return notifications_1.testReminder; } });
Object.defineProperty(exports, "onPaymentCreated", { enumerable: true, get: function () { return notifications_1.onPaymentCreated; } });
Object.defineProperty(exports, "onPayoutCreated", { enumerable: true, get: function () { return notifications_1.onPayoutCreated; } });
Object.defineProperty(exports, "onPTMCompleted", { enumerable: true, get: function () { return notifications_1.onPTMCompleted; } });
//# sourceMappingURL=index.js.map