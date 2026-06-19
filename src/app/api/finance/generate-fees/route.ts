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

    const { billingMonth } = await req.json();
    if (!billingMonth) {
      return NextResponse.json({ error: 'Missing billingMonth' }, { status: 400 });
    }

    const db = adminDb();
    const studentsSnap = await db.collection('students').where('active', '==', true).get();
    
    let created = 0;
    let updated = 0;
    
    const batch = db.batch();
    const ts = FieldValue.serverTimestamp();

    for (const doc of studentsSnap.docs) {
      const student = doc.data();
      const feeId = `${student.id}_${billingMonth}`;
      const feeRef = db.collection('fees').doc(feeId);
      
      const feeSnap = await feeRef.get();
      const totalFee = (student.monthlyFee || 0) * 100; // convert to paise
      const dueDate = new Date(billingMonth + '-' + String(student.feeDueDay || 5).padStart(2, '0')).toISOString();

      if (!feeSnap.exists) {
        batch.set(feeRef, {
          id: feeId,
          studentId: student.id,
          studentName: student.name,
          billingMonth,
          totalFee,
          paid: 0,
          balance: totalFee,
          dueDate,
          status: totalFee <= 0 ? 'paid' : 'pending',
          createdAt: ts,
          updatedAt: ts,
        });
        created++;
      } else {
        const existing = feeSnap.data()!;
        if (existing.totalFee !== totalFee) {
          const balance = totalFee - existing.paid;
          let status = existing.paid <= 0 ? 'pending' : (balance <= 0 ? 'paid' : 'partial');
          if (balance > 0 && new Date() > new Date(dueDate)) {
            status = 'overdue';
          }
          batch.update(feeRef, {
            totalFee,
            balance,
            status,
            dueDate,
            updatedAt: ts,
          });
          updated++;
        }
      }
    }

    if (created > 0 || updated > 0) {
      await batch.commit();
      
      await db.collection('audit_log').add({
        actorUid: decoded.uid,
        action: 'generate_fees',
        entity: 'fees',
        entityId: billingMonth,
        before: null,
        after: { created, updated, billingMonth },
        ts,
      });
    }

    return NextResponse.json({ created, updated }, { status: 200 });
  } catch (err: any) {
    console.error('[generate-fees]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
