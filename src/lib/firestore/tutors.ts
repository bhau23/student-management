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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tutor } from '@/lib/types';

const COL = 'tutors';

export async function getTutors(activeOnly = true): Promise<Tutor[]> {
  const ref = collection(db, COL);
  const q = activeOnly
    ? query(ref, where('active', '==', true), orderBy('name'))
    : query(ref, orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tutor));
}

export async function getTutor(id: string): Promise<Tutor | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Tutor) : null;
}

export async function createTutor(
  data: Omit<Tutor, 'id' | 'createdAt'>,
  actorUid: string
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    active: true,
    createdAt: serverTimestamp(),
  });
  await writeAudit(actorUid, 'create', 'tutors', ref.id, null, data);
  return ref.id;
}

export async function updateTutor(
  id: string,
  data: Partial<Tutor>,
  actorUid: string,
  before?: Partial<Tutor>
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
  await writeAudit(actorUid, 'update', 'tutors', id, before ?? null, data);
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
