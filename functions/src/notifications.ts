import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import dayjs from 'dayjs';

const db = admin.firestore();

// ── 1. Notification Adapter & Deduplication ──────────────────────────────────

interface NotifyParams {
  type: string;
  recipientId: string;
  channel?: 'email' | 'whatsapp';
  refId: string;
  toEmail: string;
  subject: string;
  html: string;
}

/**
 * Sends a notification if it hasn't been sent already.
 * Uses Firestore transaction to guarantee deduplication via deterministic ID.
 */
async function sendNotification(params: NotifyParams) {
  const { type, recipientId, channel = 'email', refId, toEmail, subject, html } = params;
  const notifId = `${type}_${refId}_${recipientId}`;
  const notifRef = db.collection('notifications').doc(notifId);

  try {
    await db.runTransaction(async (t) => {
      const doc = await t.get(notifRef);
      if (doc.exists) {
        throw new Error('ALREADY_SENT');
      }
      
      // Write to Trigger-Email extension collection ('mail')
      const mailRef = db.collection('mail').doc();
      t.set(mailRef, {
        to: toEmail,
        message: { subject, html },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Write dedupe log
      t.set(notifRef, {
        id: notifId,
        type,
        recipientId,
        channel,
        refId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
      });
    });
    logger.info(`Notification sent: ${notifId}`);
  } catch (err: any) {
    if (err.message !== 'ALREADY_SENT') {
      logger.error(`Notification failed: ${notifId}`, err);
    } else {
      logger.info(`Skipped duplicate notification: ${notifId}`);
    }
  }
}

// ── 2. Scheduled Reminders (Cron) ───────────────────────────────────────────

const TIMEZONE = 'Asia/Kolkata';

// Runs daily at 7:00 AM
export const classReminder = onSchedule({ schedule: '0 7 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
  const today = dayjs().format('YYYY-MM-DD');
  const dow = dayjs().format('dddd'); // e.g. "Monday"

  // Find all active enrollments that have class today
  const enrollmentsSnap = await db.collection('enrollments').where('status', '==', 'active').get();
  
  for (const doc of enrollmentsSnap.docs) {
    const e = doc.data();
    if (!e.schedule) continue;
    
    // Check if schedule includes today
    const hasClassToday = e.schedule.some((s: any) => s.day === dow);
    if (!hasClassToday) continue;

    const studentDoc = await db.collection('students').doc(e.studentId).get();
    const student = studentDoc.data();
    if (!student || !student.email) continue; // No email to send to

    await sendNotification({
      type: 'class_reminder',
      recipientId: e.studentId,
      refId: `${e.id}_${today}`, // Dedupe per enrollment per day
      toEmail: student.email,
      subject: `Reminder: Class Today (${e.subjectId})`,
      html: `<p>Hi ${student.name},</p><p>You have a <b>${e.subjectId}</b> class today.</p>`,
    });
  }
});

// Runs daily at 9:00 AM
export const feeReminder = onSchedule({ schedule: '0 9 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
  const feesSnap = await db.collection('fees').where('status', 'in', ['pending', 'overdue']).get();
  
  for (const doc of feesSnap.docs) {
    const fee = doc.data();
    const studentDoc = await db.collection('students').doc(fee.studentId).get();
    const student = studentDoc.data();
    if (!student || (!student.email && !student.parentEmail)) continue;

    const to = student.parentEmail || student.email;
    const amountStr = (fee.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

    await sendNotification({
      type: 'fee_reminder',
      recipientId: fee.studentId,
      refId: doc.id, // We only send this ONCE per fee document. If you want weekly, refId needs a week identifier.
      toEmail: to,
      subject: `Fee Reminder: ${fee.billingMonth}`,
      html: `<p>Hi ${student.name},</p><p>Your fee for ${fee.billingMonth} of <b>${amountStr}</b> is ${fee.status}. Please clear it at the earliest.</p>`,
    });
  }
});

// Runs daily at 10:00 AM
export const ptmReminder = onSchedule({ schedule: '0 10 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  
  const ptmSnap = await db.collection('ptms')
    .where('status', '==', 'scheduled')
    .where('date', '==', tomorrow)
    .get();

  for (const doc of ptmSnap.docs) {
    const ptm = doc.data();
    
    // Notify Student/Parent
    const studentDoc = await db.collection('students').doc(ptm.studentId).get();
    const student = studentDoc.data();
    if (student && (student.email || student.parentEmail)) {
      await sendNotification({
        type: 'ptm_reminder_student',
        recipientId: ptm.studentId,
        refId: doc.id,
        toEmail: student.parentEmail || student.email,
        subject: `PTM Scheduled for Tomorrow`,
        html: `<p>Hi ${student.name},</p><p>You have a Parent-Teacher Meeting scheduled tomorrow.</p>`,
      });
    }

    // Notify Tutor
    const tutorDoc = await db.collection('tutors').doc(ptm.tutorId).get();
    const tutor = tutorDoc.data();
    if (tutor && tutor.email) {
      await sendNotification({
        type: 'ptm_reminder_tutor',
        recipientId: ptm.tutorId,
        refId: doc.id,
        toEmail: tutor.email,
        subject: `PTM Scheduled for Tomorrow`,
        html: `<p>Hi ${tutor.name},</p><p>You have a PTM tomorrow with ${student?.name || 'Student'}.</p>`,
      });
    }
  }
});

// Runs daily at 11:00 AM
export const testReminder = onSchedule({ schedule: '0 11 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
  
  const testSnap = await db.collection('tests').where('date', '==', tomorrow).get();

  for (const doc of testSnap.docs) {
    const test = doc.data();
    const studentDoc = await db.collection('students').doc(test.studentId).get();
    const student = studentDoc.data();
    if (student && student.email) {
      await sendNotification({
        type: 'test_reminder',
        recipientId: test.studentId,
        refId: doc.id,
        toEmail: student.email,
        subject: `Upcoming Test Tomorrow: ${test.title}`,
        html: `<p>Hi ${student.name},</p><p>You have a test <b>${test.title}</b> scheduled for tomorrow. Good luck!</p>`,
      });
    }
  }
});

// ── 3. Event Triggers (Firestore) ───────────────────────────────────────────

export const onPaymentCreated = onDocumentCreated({ document: 'payments/{paymentId}', region: 'asia-south1' }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const p = snap.data();
  const feeDoc = await db.collection('fees').doc(p.feeId).get();
  const fee = feeDoc.data();
  if (!fee) return;

  const studentDoc = await db.collection('students').doc(fee.studentId).get();
  const student = studentDoc.data();
  if (!student || (!student.email && !student.parentEmail)) return;

  const amountStr = (p.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  await sendNotification({
    type: 'payment_confirmation',
    recipientId: fee.studentId,
    refId: snap.id,
    toEmail: student.parentEmail || student.email,
    subject: `Payment Received - ${fee.billingMonth}`,
    html: `<p>Dear ${student.name},</p><p>We have successfully received your payment of ${amountStr} for ${fee.billingMonth} (Ref: ${p.transactionRef}). Thank you!</p>`,
  });
});

export const onPayoutCreated = onDocumentCreated({ document: 'payouts/{payoutId}', region: 'asia-south1' }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const p = snap.data();
  const salaryDoc = await db.collection('salaries').doc(p.salaryId).get();
  const salary = salaryDoc.data();
  if (!salary) return;

  const tutorDoc = await db.collection('tutors').doc(salary.tutorId).get();
  const tutor = tutorDoc.data();
  if (!tutor || !tutor.email) return;

  const amountStr = (p.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
  await sendNotification({
    type: 'payout_confirmation',
    recipientId: salary.tutorId,
    refId: snap.id,
    toEmail: tutor.email,
    subject: `Payout Processed - ${salary.billingMonth}`,
    html: `<p>Hi ${tutor.name},</p><p>A payout of ${amountStr} for ${salary.billingMonth} has been processed (Ref: ${p.transactionRef}).</p>`,
  });
});

export const onPTMCompleted = onDocumentUpdated({ document: 'ptms/{ptmId}', region: 'asia-south1' }, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const before = snap.before.data();
  const after = snap.after.data();

  // If status changed from scheduled -> completed
  if (before.status !== 'completed' && after.status === 'completed') {
    const studentDoc = await db.collection('students').doc(after.studentId).get();
    const student = studentDoc.data();
    if (!student || (!student.email && !student.parentEmail)) return;

    await sendNotification({
      type: 'ptm_completed',
      recipientId: after.studentId,
      refId: snap.after.id,
      toEmail: student.parentEmail || student.email,
      subject: `PTM Summary Available`,
      html: `<p>Dear Parent of ${student.name},</p><p>The summary and recommendations from your recent Parent-Teacher Meeting are now available in your portal.</p>`,
    });
  }
});
