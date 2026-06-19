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
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Student } from '@/lib/types';

const COL = 'students';

export async function getStudents(activeOnly = true): Promise<Student[]> {
  const ref = collection(db, COL);
  const q = activeOnly
    ? query(ref, where('active', '==', true), orderBy('name'))
    : query(ref, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

export async function getStudent(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Student) : null;
}

export async function createStudent(
  data: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>,
  actorUid: string
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAudit(actorUid, 'create', 'students', ref.id, null, data);
  return ref.id;
}

export async function updateStudent(
  id: string,
  data: Partial<Student>,
  actorUid: string,
  before?: Partial<Student>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
  await writeAudit(actorUid, 'update', 'students', id, before ?? null, data);
}

export async function deactivateStudent(id: string, actorUid: string): Promise<void> {
  const before = await getStudent(id);
  await updateDoc(doc(db, COL, id), { active: false, updatedAt: serverTimestamp() });
  await writeAudit(actorUid, 'update', 'students', id, before, { active: false });
}

// Lazy import to avoid circular dep — audit is shared util
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
