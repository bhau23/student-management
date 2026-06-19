import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClassSession, AttendanceStatus } from '@/lib/types';

const COL = 'class_sessions';

export interface SessionFilters {
  date?: string;
  status?: string;
  attendanceStatus?: AttendanceStatus;
  flaggedOnly?: boolean;
  tutorId?: string;
  studentId?: string;
  enrollmentId?: string;
  limitN?: number;
}

export async function getSessions(filters: SessionFilters = {}): Promise<ClassSession[]> {
  const ref = collection(db, COL);
  const constraints: any[] = [];

  if (filters.flaggedOnly) constraints.push(where('flaggedUnderMin', '==', true));
  if (filters.attendanceStatus) constraints.push(where('attendanceStatus', '==', filters.attendanceStatus));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.tutorId) constraints.push(where('tutorId', '==', filters.tutorId));
  if (filters.studentId) constraints.push(where('studentId', '==', filters.studentId));
  if (filters.enrollmentId) constraints.push(where('enrollmentId', '==', filters.enrollmentId));
  if (filters.date) constraints.push(where('date', '==', filters.date));

  constraints.push(orderBy('date', 'desc'));
  if (filters.limitN) constraints.push(limit(filters.limitN));

  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession));
}

export async function getSession(id: string): Promise<ClassSession | null> {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ClassSession) : null;
}

export async function adminOverrideSession(
  id: string,
  overrideData: {
    attendanceStatus: AttendanceStatus;
    adminRemark: string;
  },
  actorUid: string
): Promise<void> {
  const before = await getSession(id);
  await updateDoc(doc(db, COL, id), {
    attendanceStatus: overrideData.attendanceStatus,
    adminRemark: overrideData.adminRemark,
    adminOverrideBy: actorUid,
    flaggedUnderMin: false, // override resolves the flag
    updatedAt: serverTimestamp(),
  });
  // Audit log
  const { addDoc: add, collection: col } = await import('firebase/firestore');
  await add(col(db, 'audit_log'), {
    actorUid,
    action: 'update',
    entity: 'class_sessions',
    entityId: id,
    before: before ?? null,
    after: overrideData,
    ts: serverTimestamp(),
  });
}

export async function getTodaysSessions(): Promise<ClassSession[]> {
  const today = new Date().toISOString().split('T')[0];
  return getSessions({ date: today, limitN: 50 });
}

export async function getFlaggedSessions(limitN = 20): Promise<ClassSession[]> {
  return getSessions({ flaggedOnly: true, attendanceStatus: 'pending_review', limitN });
}
