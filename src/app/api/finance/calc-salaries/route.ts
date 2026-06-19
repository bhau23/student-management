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
    
    // 1. Get all active tutors
    const tutorsSnap = await db.collection('tutors').where('active', '==', true).get();
    
    let created = 0;
    let updated = 0;
    
    const batch = db.batch();
    const ts = FieldValue.serverTimestamp();

    // 2. Compute salary for each tutor
    for (const doc of tutorsSnap.docs) {
      const tutor = doc.data();
      
      // Get all conducted sessions in the billing month where tutor attended
      // Note: Month format is 'YYYY-MM'. Session date is 'YYYY-MM-DD'.
      // We can query strings starting with 'YYYY-MM-'
      const startStr = `${billingMonth}-01`;
      const endStr = `${billingMonth}-31`;

      const sessionsSnap = await db.collection('class_sessions')
        .where('tutorId', '==', tutor.id)
        .where('status', '==', 'conducted')
        .where('date', '>=', startStr)
        .where('date', '<=', endStr)
        .get();

      let classesConducted = 0;
      let earnings = 0; // in paise

      sessionsSnap.docs.forEach(sessionDoc => {
        const session = sessionDoc.data();
        classesConducted++;
        // Use perClassRate stamped on session, fallback to tutor's rate, or 0
        const rate = session.perClassRate || tutor.perClassRate || 0;
        earnings += rate;
      });

      const salaryId = `${tutor.id}_${billingMonth}`;
      const salaryRef = db.collection('salaries').doc(salaryId);
      
      const salarySnap = await salaryRef.get();

      if (!salarySnap.exists) {
        batch.set(salaryRef, {
          id: salaryId,
          tutorId: tutor.id,
          tutorName: tutor.name,
          billingMonth,
          classesConducted,
          earnings,
          paid: 0,
          pending: earnings,
          status: earnings <= 0 ? 'paid' : 'unpaid',
          payouts: [],
          createdAt: ts,
          updatedAt: ts,
        });
        created++;
      } else {
        const existing = salarySnap.data()!;
        if (existing.classesConducted !== classesConducted || existing.earnings !== earnings) {
          const pending = earnings - existing.paid;
          let status = existing.paid <= 0 ? 'unpaid' : (pending <= 0 ? 'paid' : 'partial');
          if (earnings <= 0) status = 'paid';

          batch.update(salaryRef, {
            classesConducted,
            earnings,
            pending,
            status,
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
        action: 'calc_salaries',
        entity: 'salaries',
        entityId: billingMonth,
        before: null,
        after: { created, updated, billingMonth },
        ts,
      });
    }

    return NextResponse.json({ created, updated }, { status: 200 });
  } catch (err: any) {
    console.error('[calc-salaries]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
