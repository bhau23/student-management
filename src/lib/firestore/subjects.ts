import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Subject } from '@/lib/types';

const COL = 'subjects';

export async function getSubjects(): Promise<Subject[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy('name')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
}

export async function getSubject(id: string): Promise<Subject | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Subject) : null;
}

export async function createSubject(name: string, actorUid: string): Promise<string> {
  const ref = await addDoc(collection(db, COL), { name });
  await writeAudit(actorUid, 'create', 'subjects', ref.id, null, { name });
  return ref.id;
}

export async function updateSubject(id: string, name: string, actorUid: string): Promise<void> {
  const before = await getSubject(id);
  await updateDoc(doc(db, COL, id), { name });
  await writeAudit(actorUid, 'update', 'subjects', id, before, { name });
}

export async function deleteSubject(id: string, actorUid: string): Promise<void> {
  const before = await getSubject(id);
  await deleteDoc(doc(db, COL, id));
  await writeAudit(actorUid, 'delete', 'subjects', id, before, null);
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
