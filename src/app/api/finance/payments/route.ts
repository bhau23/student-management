import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!['admin', 'super_admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId, billingMonth, amount, source, payerName, txnRef } = await req.json();
    
    if (!studentId || !billingMonth || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment parameters' }, { status: 400 });
    }

    const db = adminDb();
    const feeId = `${studentId}_${billingMonth}`;
    const feeRef = db.collection('fees').doc(feeId);
    const ts = FieldValue.serverTimestamp();

    // Track whether we skipped due to idempotency — determined inside the txn
    let skipped = false;

    await db.runTransaction(async (transaction) => {
      // --- 1. Always read the fee record first ---
      const feeSnap = await transaction.get(feeRef);
      if (!feeSnap.exists) {
        throw new Error('Fee record not found for this month');
      }

      // --- 2. Vendor idempotency — INSIDE the transaction, using a deterministic doc ID ---
      // This makes the duplicate check atomic with the write, eliminating the
      // check-then-act race condition that allows double-charges on webhook retries.
      let paymentRef;
      if (source === 'vendor' && txnRef) {
        // Deterministic doc ID keyed on the vendor's transaction reference
        paymentRef = db.collection('payments').doc(`vendor_${txnRef}`);
        const dupSnap = await transaction.get(paymentRef);
        if (dupSnap.exists) {
          skipped = true;
          return; // abort the rest of the transaction body — nothing will be written
        }
      } else {
        // Manual payment — random doc ID (admin is responsible; see UI submit-lock)
        paymentRef = db.collection('payments').doc();
      }

      // --- 3. Build and write the payment document ---
      const paymentData = {
        id: paymentRef.id,
        studentId,
        studentName: feeSnap.data()?.studentName || null,
        billingMonth,
        amount, // paise
        source: source || 'manual',
        payerName: payerName || null,
        txnRef: txnRef || null,
        paidAt: ts,
        enteredBy: decoded.uid,
        createdAt: ts,
      };
      transaction.set(paymentRef, paymentData);

      // --- 4. Atomically update the fee balance ---
      const fee = feeSnap.data()!;
      const newPaid = (fee.paid || 0) + amount;
      const newBalance = fee.totalFee - newPaid;
      
      let newStatus = newPaid <= 0 ? 'pending' : (newBalance <= 0 ? 'paid' : 'partial');
      if (newBalance > 0 && new Date() > new Date(fee.dueDate)) {
        newStatus = 'overdue';
      }

      transaction.update(feeRef, {
        paid: newPaid,
        balance: newBalance,
        status: newStatus,
        updatedAt: ts,
      });

      // --- 5. Audit log entry ---
      const auditRef = db.collection('audit_log').doc();
      transaction.set(auditRef, {
        actorUid: decoded.uid,
        action: 'record_payment',
        entity: 'fees',
        entityId: feeId,
        before: { paid: fee.paid, balance: fee.balance, status: fee.status },
        after: { paid: newPaid, balance: newBalance, status: newStatus, paymentId: paymentRef.id },
        ts,
      });
    });

    // Respond based on whether the txn was a no-op (idempotent skip) or a real write
    if (skipped) {
      return NextResponse.json({ status: 'skipped', reason: 'idempotent_txnRef' }, { status: 200 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('[record-payment]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
