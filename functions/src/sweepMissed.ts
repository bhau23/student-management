import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Days map for schedule matching
const DAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function now() { return admin.firestore.FieldValue.serverTimestamp(); }

/**
 * Daily sweep at 23:55 IST.
 * For each active enrollment scheduled today (by scheduleDays),
 * if there's no class_sessions doc for today, creates one with status='missed'.
 */
export const sweepMissed = onSchedule(
  {
    schedule: '55 23 * * *',
    timeZone: 'Asia/Kolkata',
    memory: '256MiB',
    timeoutSeconds: 300,
  },
  async () => {
    console.log('[sweep] Starting daily missed sweep…');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const todayDow = today.getDay(); // 0=Sun, 1=Mon, …
    const todayDayName = Object.entries(DAY_MAP).find(([, v]) => v === todayDow)?.[0];

    if (!todayDayName) { console.error('[sweep] Could not determine day of week'); return; }

    // Get all active enrollments
    const enrollmentsSnap = await db
      .collection('enrollments')
      .where('active', '==', true)
      .get();

    let swept = 0;
    const batch = db.batch();

    for (const enrDoc of enrollmentsSnap.docs) {
      const enr = enrDoc.data() as {
        id: string; studentId: string; subjectId: string; tutorId: string;
        meetingCode: string; scheduleDays: string[]; scheduleTime: string;
      };

      // Check if this enrollment is scheduled for today
      if (!(enr.scheduleDays ?? []).includes(todayDayName)) continue;

      const sessionId = `${enr.meetingCode}_${todayStr}`;
      const sessionRef = db.doc(`class_sessions/${sessionId}`);
      const sessionSnap = await sessionRef.get();

      // Skip if session already exists (ingestion already created it)
      if (sessionSnap.exists) continue;

      // Create a missed session
      batch.set(sessionRef, {
        id: sessionId,
        enrollmentId: enrDoc.id,
        studentId: enr.studentId,
        subjectId: enr.subjectId,
        tutorId: enr.tutorId,
        meetingCode: enr.meetingCode,
        date: todayStr,
        scheduledStart: `${todayStr}T${enr.scheduleTime ?? '00:00'}:00`,
        actualStart: null,
        actualEnd: null,
        attendedMin: 0,
        status: 'missed',
        attendanceStatus: 'absent',
        flaggedUnderMin: false,
        adminOverrideBy: null,
        adminRemark: null,
        recordingDriveId: null,
        transcriptDriveId: null,
        chatDriveId: null,
        source: 'auto',
        createdAt: now(),
        updatedAt: now(),
      });

      swept++;
    }

    if (swept > 0) {
      await batch.commit();
      console.log(`[sweep] Swept ${swept} missed session(s) for ${todayStr}`);
    } else {
      console.log(`[sweep] No missed sessions to create for ${todayStr}`);
    }
  }
);
