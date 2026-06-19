import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'admin' | 'tutor' | 'student';

export interface TutrainUser {
  uid: string;
  email: string;
  role: UserRole;
  linkedId: string | null; // students/{id} or tutors/{id}
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  board: string;
  parentName: string;
  parentContact: string;
  contact: string;
  admissionDate: string; // ISO date string
  status: 'trial' | 'active' | 'converted' | 'inactive';
  monthlyFee: number;
  feeDueDay: number;
  authUid: string;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Tutor {
  id: string;
  name: string;
  email: string; // must be *.tutor@eqourse.com
  subjects: string[]; // subjectId[]
  salaryModel: string;
  perClassRate?: number; // paise, e.g. 30000 for ₹300
  authUid: string;
  active: boolean;
  createdAt: Timestamp;
}

export interface Subject {
  id: string;
  name: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  subjectId: string;
  tutorId: string;
  meetingCode: string; // e.g. 'ryu-auqj-dvm' — UNIQUE
  scheduleDays: string[]; // ['Mon','Wed']
  scheduleTime: string;   // '18:00'
  expectedDurationMin: number; // default 60
  minPresentMin: number;       // default 45
  monthlyQuota: number;        // default 12
  active: boolean;
  createdAt: Timestamp;
}

export interface MeetingCodeIndex {
  enrollmentId: string;
}

export type SessionStatus = 'scheduled' | 'conducted' | 'missed' | 'cancelled' | 'rescheduled';
export type AttendanceStatus = 'present' | 'absent' | 'pending_review';

export interface ClassSession {
  id: string; // ${meetingCode}_${date}
  enrollmentId: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  perClassRate?: number; // paise
  meetingCode: string;
  date: string; // YYYY-MM-DD
  scheduledStart: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  attendedMin: number;
  status: SessionStatus;
  attendanceStatus: AttendanceStatus;
  flaggedUnderMin: boolean;
  adminOverrideBy: string | null;
  adminRemark: string | null;
  recordingDriveId: string | null;
  transcriptDriveId: string | null;
  chatDriveId: string | null;
  source: 'auto' | 'manual';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AttendanceRaw {
  id: string;
  sessionId: string;
  meetingCode: string;
  date: string;
  fileId: string;
  firstName: string;
  lastName: string;
  email: string;
  durationMin: number;
  joined: string;
  exited: string;
  isTutor: boolean;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ts: Timestamp;
}

export interface UnmappedQueueEntry {
  meetingCode: string;
  date: string;
  reason: 'no_enrollment' | 'name_mismatch';
  sampleFileId: string;
  createdAt: Timestamp;
}

export interface IngestState {
  lastRunAt: Timestamp;
  lastModifiedSeen: string;
  recordingsFolderId: string;
  reportsFolderId: string;
}

export interface FeeRecord {
  id: string; // ${studentId}_${billingMonth}
  studentId: string;
  studentName?: string;
  billingMonth: string; // YYYY-MM
  totalFee: number; // paise
  paid: number; // paise
  balance: number; // paise
  dueDate: string; // ISO
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName?: string;
  billingMonth: string;
  amount: number; // paise
  source: 'vendor' | 'manual';
  payerName: string;
  txnRef: string;
  course?: string;
  paidAt: Timestamp;
  enteredBy: string; // uid
  createdAt: Timestamp;
}

export interface PayoutEntry {
  amount: number; // paise
  paidAt: Timestamp;
  ref: string;
  enteredBy: string; // uid
}

export interface SalaryRecord {
  id: string; // ${tutorId}_${billingMonth}
  tutorId: string;
  tutorName?: string;
  billingMonth: string; // YYYY-MM
  classesConducted: number;
  earnings: number; // paise
  paid: number; // paise
  pending: number; // paise
  status: 'unpaid' | 'partial' | 'paid';
  payouts: PayoutEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Phase 8: Tests & PTM ──────────────────────────────────────────────────────

export type TestType = 'unit' | 'monthly' | 'mock' | 'other';

export interface Test {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  title: string;
  type: TestType;
  date: string; // YYYY-MM-DD
  maxMarks: number; // integer
  createdBy: string; // uid
  createdAt: Timestamp;
}

export interface TestResult {
  id: string; // = testId (one result per test in 1:1)
  testId: string;
  studentId: string;
  subjectId: string;
  tutorId: string;
  marks: number; // integer
  maxMarks: number; // integer
  percentage: number; // round(marks/maxMarks*100)
  remarks?: string;
  gradedBy: string; // uid
  gradedAt: Timestamp;
}

export type PTMStatus = 'scheduled' | 'completed' | 'cancelled';

export interface PTM {
  id: string;
  studentId: string;
  studentName?: string;
  tutorId: string;
  tutorName?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: PTMStatus;
  summary?: string;
  recommendations?: string;
  createdBy: string; // uid
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Phase 9: Lead CRM & Automations ──────────────────────────────────────────

export type LeadSource = 'referral' | 'website' | 'ad' | 'walk_in' | 'other';
export type LeadStage = 'new' | 'contacted' | 'demo_scheduled' | 'demo_done' | 'converted' | 'lost';

export interface LeadNote {
  text: string;
  by: string; // uid
  at: string; // ISO string
}

export interface Lead {
  id: string;
  name: string;
  contact: string;
  source: LeadSource;
  stage: LeadStage;
  assignedTo?: string; // admin uid
  value?: number; // paise
  notes: LeadNote[];
  convertedStudentId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  type: string;
  recipientId: string;
  channel: 'email' | 'whatsapp';
  refId: string;
  sentAt: Timestamp;
  status: 'sent' | 'failed';
}