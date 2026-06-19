import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function now() { return admin.firestore.FieldValue.serverTimestamp(); }

const AUDITED_COLLECTIONS = ['students', 'tutors', 'enrollments', 'subjects'];

/**
 * Firestore trigger: writes an audit_log entry on every write to audited collections.
 * This runs server-side, so it captures all writes including those from the Admin SDK.
 */
function makeAuditTrigger(col: string) {
  return onDocumentWritten(`${col}/{docId}`, async (event) => {
    const before = event.data?.before?.data() ?? null;
    const after  = event.data?.after?.data() ?? null;
    const docId  = event.params.docId;

    let action: 'create' | 'update' | 'delete';
    if (!before && after)  action = 'create';
    else if (before && !after) action = 'delete';
    else action = 'update';

    // Avoid writing audit entries for audit_log itself (circular)
    try {
      await db.collection('audit_log').add({
        actorUid: 'server-trigger',
        action,
        entity: col,
        entityId: docId,
        before: before ? sanitize(before) : null,
        after:  after  ? sanitize(after)  : null,
        ts: now(),
      });
    } catch (err) {
      console.error(`[audit] Failed to write audit for ${col}/${docId}:`, err);
    }
  });
}

// Strip serverTimestamp sentinels which can't be serialized
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && '_methodName' in (v as any)) continue; // FieldValue
    out[k] = v;
  }
  return out;
}

export const auditStudents    = makeAuditTrigger('students');
export const auditTutors      = makeAuditTrigger('tutors');
export const auditEnrollments = makeAuditTrigger('enrollments');
export const auditSubjects    = makeAuditTrigger('subjects');
