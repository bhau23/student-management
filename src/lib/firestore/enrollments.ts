import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Enrollment } from '@/lib/types';

const COL = 'enrollments';

export async function getEnrollments(activeOnly = true): Promise<Enrollment[]> {
  const ref = collection(db, COL);
  const q = activeOnly
    ? query(ref, where('active', '==', true))
    : query(ref);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

export async function getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('studentId', '==', studentId), where('active', '==', true))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

export async function getEnrollmentsByTutor(tutorId: string): Promise<Enrollment[]> {
  const snap = await getDocs(
    query(collection(db, COL), where('tutorId', '==', tutorId), where('active', '==', true))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Enrollment));
}

export async function getEnrollment(id: string): Promise<Enrollment | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Enrollment) : null;
}

/**
 * Check if meetingCode is already taken.
 * Uses the meetingCodeIndex helper collection for O(1) lookup.
 * NOTE: For uniqueness enforcement at write time, use createEnrollment which
 * wraps the check + write in a transaction to prevent race conditions.
 */
export async function isMeetingCodeTaken(code: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'meetingCodeIndex', code));
  return snap.exists();
}

export async function createEnrollment(
  data: Omit<Enrollment, 'id' | 'createdAt'>,
  actorUid: string
): Promise<string> {
  // Pre-generate the enrollment doc ID so we can use it inside the transaction
  const enrollmentRef = doc(collection(db, COL));
  const enrollmentId = enrollmentRef.id;

  const indexRef = doc(db, 'meetingCodeIndex', data.meetingCode);
  const studentRef = doc(db, 'students', data.studentId);

  await runTransaction(db, async (tx) => {
    // Read the index inside the transaction — this is the atomic check
    const indexSnap = await tx.get(indexRef);
    if (indexSnap.exists()) {
      throw new Error(`Meeting code "${data.meetingCode}" is already in use.`);
    }

    // Write 1: enrollment document
    tx.set(enrollmentRef, {
      ...data,
      id: enrollmentId,
      active: true,
      createdAt: serverTimestamp(),
    });

    // Write 2: reverse-lookup index (atomically with enrollment)
    tx.set(indexRef, { enrollmentId });

    // Write 3: add tutorId to student's tutorIds array (used by Firestore rules)
    tx.update(studentRef, { tutorIds: arrayUnion(data.tutorId) });
  });

  await writeAudit(actorUid, 'create', 'enrollments', enrollmentId, null, data);
  return enrollmentId;
}

export async function updateEnrollment(
  id: string,
  data: Partial<Enrollment>,
  actorUid: string,
  before?: Partial<Enrollment>
): Promise<void> {
  // If meetingCode is being changed, update the index atomically
  if (data.meetingCode && before?.meetingCode && data.meetingCode !== before.meetingCode) {
    const oldIndexRef = doc(db, 'meetingCodeIndex', before.meetingCode);
    const newIndexRef = doc(db, 'meetingCodeIndex', data.meetingCode);

    await runTransaction(db, async (tx) => {
      const newIndexSnap = await tx.get(newIndexRef);
      if (newIndexSnap.exists()) {
        throw new Error(`Meeting code "${data.meetingCode}" is already in use.`);
      }
      tx.delete(oldIndexRef);
      tx.set(newIndexRef, { enrollmentId: id });
      tx.update(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
    });
  } else {
    await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
  }

  await writeAudit(actorUid, 'update', 'enrollments', id, before ?? null, data);
}

export async function deactivateEnrollment(id: string, actorUid: string): Promise<void> {
  const before = await getEnrollment(id);
  if (!before) throw new Error("Enrollment not found");

  const studentRef = doc(db, 'students', before.studentId);

  // Check if there are OTHER active enrollments for this same student & tutor
  let keepTutorId = false;
  if (before.tutorId && before.studentId) {
    const q = query(
      collection(db, COL),
      where('studentId', '==', before.studentId),
      where('tutorId', '==', before.tutorId),
      where('active', '==', true)
    );
    const snap = await getDocs(q);
    const otherActive = snap.docs.filter(d => d.id !== id);
    if (otherActive.length > 0) {
      keepTutorId = true;
    }
  }

  await runTransaction(db, async (tx) => {
    tx.update(doc(db, COL, id), { active: false, updatedAt: serverTimestamp() });
    // Remove tutorId from student's tutorIds ONLY if no other active enrollments exist
    if (before.tutorId && before.studentId && !keepTutorId) {
      tx.update(studentRef, { tutorIds: arrayRemove(before.tutorId) });
    }
  });

  await writeAudit(actorUid, 'update', 'enrollments', id, before, { active: false });
}

async function writeAudit(
  actorUid: string,
  action: 'create' | 'update' | 'delete',
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown
) {
  try {
    const { addDoc: add, collection: col } = await import('firebase/firestore');
    await add(col(db, 'audit_log'), {
      actorUid, action, entity, entityId,
      before: before ?? null, after: after ?? null,
      ts: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[Audit] Failed to write audit log due to permissions, ignoring.', e);
  }
}

