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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPTMCompleted = exports.onPayoutCreated = exports.onPaymentCreated = exports.testReminder = exports.ptmReminder = exports.feeReminder = exports.classReminder = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const admin = __importStar(require("firebase-admin"));
const dayjs_1 = __importDefault(require("dayjs"));
const db = admin.firestore();
/**
 * Sends a notification if it hasn't been sent already.
 * Uses Firestore transaction to guarantee deduplication via deterministic ID.
 */
async function sendNotification(params) {
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
    }
    catch (err) {
        if (err.message !== 'ALREADY_SENT') {
            logger.error(`Notification failed: ${notifId}`, err);
        }
        else {
            logger.info(`Skipped duplicate notification: ${notifId}`);
        }
    }
}
// ── 2. Scheduled Reminders (Cron) ───────────────────────────────────────────
const TIMEZONE = 'Asia/Kolkata';
// Runs daily at 7:00 AM
exports.classReminder = (0, scheduler_1.onSchedule)({ schedule: '0 7 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
    const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const dow = (0, dayjs_1.default)().format('dddd'); // e.g. "Monday"
    // Find all active enrollments that have class today
    const enrollmentsSnap = await db.collection('enrollments').where('status', '==', 'active').get();
    for (const doc of enrollmentsSnap.docs) {
        const e = doc.data();
        if (!e.schedule)
            continue;
        // Check if schedule includes today
        const hasClassToday = e.schedule.some((s) => s.day === dow);
        if (!hasClassToday)
            continue;
        const studentDoc = await db.collection('students').doc(e.studentId).get();
        const student = studentDoc.data();
        if (!student || !student.email)
            continue; // No email to send to
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
exports.feeReminder = (0, scheduler_1.onSchedule)({ schedule: '0 9 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
    const feesSnap = await db.collection('fees').where('status', 'in', ['pending', 'overdue']).get();
    for (const doc of feesSnap.docs) {
        const fee = doc.data();
        const studentDoc = await db.collection('students').doc(fee.studentId).get();
        const student = studentDoc.data();
        if (!student || (!student.email && !student.parentEmail))
            continue;
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
exports.ptmReminder = (0, scheduler_1.onSchedule)({ schedule: '0 10 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
    const tomorrow = (0, dayjs_1.default)().add(1, 'day').format('YYYY-MM-DD');
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
                html: `<p>Hi ${tutor.name},</p><p>You have a PTM tomorrow with ${(student === null || student === void 0 ? void 0 : student.name) || 'Student'}.</p>`,
            });
        }
    }
});
// Runs daily at 11:00 AM
exports.testReminder = (0, scheduler_1.onSchedule)({ schedule: '0 11 * * *', timeZone: TIMEZONE, region: 'asia-south1' }, async () => {
    const tomorrow = (0, dayjs_1.default)().add(1, 'day').format('YYYY-MM-DD');
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
exports.onPaymentCreated = (0, firestore_1.onDocumentCreated)({ document: 'payments/{paymentId}', region: 'asia-south1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const p = snap.data();
    const feeDoc = await db.collection('fees').doc(p.feeId).get();
    const fee = feeDoc.data();
    if (!fee)
        return;
    const studentDoc = await db.collection('students').doc(fee.studentId).get();
    const student = studentDoc.data();
    if (!student || (!student.email && !student.parentEmail))
        return;
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
exports.onPayoutCreated = (0, firestore_1.onDocumentCreated)({ document: 'payouts/{payoutId}', region: 'asia-south1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const p = snap.data();
    const salaryDoc = await db.collection('salaries').doc(p.salaryId).get();
    const salary = salaryDoc.data();
    if (!salary)
        return;
    const tutorDoc = await db.collection('tutors').doc(salary.tutorId).get();
    const tutor = tutorDoc.data();
    if (!tutor || !tutor.email)
        return;
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
exports.onPTMCompleted = (0, firestore_1.onDocumentUpdated)({ document: 'ptms/{ptmId}', region: 'asia-south1' }, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const before = snap.before.data();
    const after = snap.after.data();
    // If status changed from scheduled -> completed
    if (before.status !== 'completed' && after.status === 'completed') {
        const studentDoc = await db.collection('students').doc(after.studentId).get();
        const student = studentDoc.data();
        if (!student || (!student.email && !student.parentEmail))
            return;
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
//# sourceMappingURL=notifications.js.map