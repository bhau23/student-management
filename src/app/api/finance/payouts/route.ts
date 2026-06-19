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

    const { tutorId, billingMonth, amount, ref } = await req.json();
    
    if (!tutorId || !billingMonth || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payout parameters' }, { status: 400 });
    }

    const db = adminDb();
    const salaryId = `${tutorId}_${billingMonth}`;
    const salaryRef = db.collection('salaries').doc(salaryId);
    
    const ts = FieldValue.serverTimestamp();

    await db.runTransaction(async (transaction) => {
      const salarySnap = await transaction.get(salaryRef);
      if (!salarySnap.exists) {
        throw new Error('Salary record not found for this month');
      }

      const salary = salarySnap.data()!;
      const newPaid = (salary.paid || 0) + amount;
      const newPending = salary.earnings - newPaid;
      
      let newStatus = newPaid <= 0 ? 'unpaid' : (newPending <= 0 ? 'paid' : 'partial');

      const payoutEntry = {
        amount, // paise
        ref: ref || null,
        paidAt: ts,
        enteredBy: decoded.uid,
      };

      transaction.update(salaryRef, {
        paid: newPaid,
        pending: newPending,
        status: newStatus,
        payouts: FieldValue.arrayUnion(payoutEntry),
        updatedAt: ts,
      });

      const auditRef = db.collection('audit_log').doc();
      transaction.set(auditRef, {
        actorUid: decoded.uid,
        action: 'record_payout',
        entity: 'salaries',
        entityId: salaryId,
        before: { paid: salary.paid, pending: salary.pending, status: salary.status },
        after: { paid: newPaid, pending: newPending, status: newStatus, amount },
        ts,
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error('[record-payout]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
