"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditSubjects = exports.auditEnrollments = exports.auditTutors = exports.auditStudents = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
function now() { return admin.firestore.FieldValue.serverTimestamp(); }
const AUDITED_COLLECTIONS = ['students', 'tutors', 'enrollments', 'subjects'];
/**
 * Firestore trigger: writes an audit_log entry on every write to audited collections.
 * This runs server-side, so it captures all writes including those from the Admin SDK.
 */
function makeAuditTrigger(col) {
    return (0, firestore_1.onDocumentWritten)(`${col}/{docId}`, async (event) => {
        var _a, _b, _c, _d, _e, _f;
        const before = (_c = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data()) !== null && _c !== void 0 ? _c : null;
        const after = (_f = (_e = (_d = event.data) === null || _d === void 0 ? void 0 : _d.after) === null || _e === void 0 ? void 0 : _e.data()) !== null && _f !== void 0 ? _f : null;
        const docId = event.params.docId;
        let action;
        if (!before && after)
            action = 'create';
        else if (before && !after)
            action = 'delete';
        else
            action = 'update';
        // Avoid writing audit entries for audit_log itself (circular)
        try {
            await db.collection('audit_log').add({
                actorUid: 'server-trigger',
                action,
                entity: col,
                entityId: docId,
                before: before ? sanitize(before) : null,
                after: after ? sanitize(after) : null,
                ts: now(),
            });
        }
        catch (err) {
            console.error(`[audit] Failed to write audit for ${col}/${docId}:`, err);
        }
    });
}
// Strip serverTimestamp sentinels which can't be serialized
function sanitize(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && '_methodName' in v)
            continue; // FieldValue
        out[k] = v;
    }
    return out;
}
exports.auditStudents = makeAuditTrigger('students');
exports.auditTutors = makeAuditTrigger('tutors');
exports.auditEnrollments = makeAuditTrigger('enrollments');
exports.auditSubjects = makeAuditTrigger('subjects');
//# sourceMappingURL=auditTrigger.js.map