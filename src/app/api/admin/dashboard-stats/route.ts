import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { avgPct } from '@/lib/academicHelpers';

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: 'Sanity Check Error' }, { status: 400 });
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
    const isSuperAdmin = decoded.role === 'super_admin';

    const { period } = await req.json(); // 'YYYY-MM'
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'Invalid period — expected YYYY-MM' }, { status: 400 });
    }

    const db = adminDb();
    const startDate = `${period}-01`;
    const endDate = `${period}-31`;

    // ── 1. Student counts ────────────────────────────────────────────────────
    const studentsSnap = await db.collection('students').where('active', '==', true).get();
    const totalActiveStudents = studentsSnap.size;
    const newStudents = studentsSnap.docs.filter(d => {
      const ad: string = d.data().admissionDate || '';
      return ad.startsWith(period);
    }).length;

    // ── 2. Tutor counts ─────────────────────────────────────────────────────
    const tutorsSnap = await db.collection('tutors').where('active', '==', true).get();
    const totalActiveTutors = tutorsSnap.size;

    // ── 3. Session aggregations for the period ───────────────────────────────
    const sessionsSnap = await db.collection('class_sessions')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    let conducted = 0;
    let missed = 0;
    let cancelled = 0;
    let present = 0;
    let absent = 0;
    let pendingReview = 0;

    // per-tutor session counts
    const tutorConducted: Record<string, number> = {};
    const tutorPresent: Record<string, number> = {};
    const tutorAbsent: Record<string, number> = {};

    sessionsSnap.docs.forEach(d => {
      const s = d.data();
      if (s.status === 'conducted') {
        conducted++;
        tutorConducted[s.tutorId] = (tutorConducted[s.tutorId] || 0) + 1;
      }
      if (s.status === 'missed') missed++;
      if (s.status === 'cancelled') cancelled++;
      if (s.attendanceStatus === 'present') {
        present++;
        tutorPresent[s.tutorId] = (tutorPresent[s.tutorId] || 0) + 1;
      }
      if (s.attendanceStatus === 'absent') {
        absent++;
        tutorAbsent[s.tutorId] = (tutorAbsent[s.tutorId] || 0) + 1;
      }
      if (s.attendanceStatus === 'pending_review') pendingReview++;
    });

    const totalReviewed = present + absent;
    const attendancePct = totalReviewed > 0 ? Math.round((present / totalReviewed) * 100) : null;

    // ── 4. Tests & PTM aggregation for the period ────────────────────────────
    const [testResultsSnap, ptmsSnap, leadsSnap] = await Promise.all([
      db.collection('test_results').where('gradedAt', '>=', new Date(`${period}-01`)).where('gradedAt', '<', new Date(`${period}-31T23:59:59`)).get(),
      db.collection('ptms').where('date', '>=', `${period}-01`).where('date', '<=', `${period}-31`).get(),
      db.collection('leads').where('updatedAt', '>=', new Date(`${period}-01`)).where('updatedAt', '<', new Date(`${period}-31T23:59:59`)).get(),
    ]);

    const testPcts = testResultsSnap.docs.map(d => d.data().percentage as number);
    const avgTestPct = avgPct(testPcts);

    let ptmScheduled = 0, ptmCompleted = 0, ptmCancelled = 0;
    ptmsSnap.docs.forEach(d => {
      const s = d.data().status;
      if (s === 'scheduled') ptmScheduled++;
      if (s === 'completed') ptmCompleted++;
      if (s === 'cancelled') ptmCancelled++;
    });

    // ── 5. CRM Aggregation ───────────────────────────────────────────────────
    let totalLeads = 0, convertedLeads = 0, expectedValue = 0;
    const leadsBySource: Record<string, number> = {};
    leadsSnap.docs.forEach(d => {
      const l = d.data();
      totalLeads++;
      leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1;
      if (l.stage === 'converted') {
        convertedLeads++;
        if (l.value) expectedValue += l.value;
      }
    });

    // ── 6. Alerts ─────────────────────────────────────────────────────────────
    // Note: unmappedQueue is camelCase — matches the ingestion function's write path.
    // The salaries alert is super_admin-only; we skip that query for ops admins
    // (avoids the billingMonth+status!=paid composite index requirement for all callers).
    const [overdueFeesSnap, unmappedSnap] = await Promise.all([
      db.collection('fees').where('billingMonth', '==', period).where('status', '==', 'overdue').get(),
      db.collection('unmappedQueue').get(), // ← correct camelCase name
    ]);

    const alerts: Record<string, number | undefined> = {
      overdueFees: overdueFeesSnap.size,
      pendingReviews: pendingReview,
      unmappedSessions: unmappedSnap.size,
      // unpaidSalaries populated below inside the isSuperAdmin block
    };

    // ── 5. Tutor utilization (admin + super_admin) ────────────────────────────
    const tutorUtilization = tutorsSnap.docs.map(d => {
      const t = d.data();
      const cl = tutorConducted[t.id] || 0;
      const pr = tutorPresent[t.id] || 0;
      const ab = tutorAbsent[t.id] || 0;
      const total = pr + ab;
      return {
        tutorId: t.id,
        tutorName: t.name,
        classesConducted: cl,
        attendancePct: total > 0 ? Math.round((pr / total) * 100) : null,
      };
    }).filter(t => t.classesConducted > 0);

    // ── 6. At-risk students (attendance < 70% or overdue fee) ──────────────
    // Build attendance per student from sessions
    const studentPresent: Record<string, number> = {};
    const studentAbsent: Record<string, number> = {};
    sessionsSnap.docs.forEach(d => {
      const s = d.data();
      if (s.attendanceStatus === 'present') studentPresent[s.studentId] = (studentPresent[s.studentId] || 0) + 1;
      if (s.attendanceStatus === 'absent') studentAbsent[s.studentId] = (studentAbsent[s.studentId] || 0) + 1;
    });
    const overdueStudentIds = new Set(overdueFeesSnap.docs.map(d => d.data().studentId));

    const atRisk = studentsSnap.docs
      .map(d => {
        const s = d.data();
        const pr = studentPresent[s.id] || 0;
        const ab = studentAbsent[s.id] || 0;
        const total = pr + ab;
        const attPct = total > 0 ? Math.round((pr / total) * 100) : null;
        const hasOverdueFee = overdueStudentIds.has(s.id);
        const isAtRisk = hasOverdueFee || (attPct !== null && attPct < 70);
        if (!isAtRisk) return null;
        return { studentId: s.id, studentName: s.name, attendancePct: attPct, hasOverdueFee };
      })
      .filter(Boolean);

    // ── 7. Finance (super_admin only) ────────────────────────────────────────
    let finance: Record<string, number> | undefined;
    if (isSuperAdmin) {
      const [paymentsSnap, feesSnap, salariesSnap] = await Promise.all([
        db.collection('payments').where('billingMonth', '==', period).get(),
        db.collection('fees').where('billingMonth', '==', period).get(),
        db.collection('salaries').where('billingMonth', '==', period).get(),
      ]);

      let revenue = 0;
      paymentsSnap.docs.forEach(d => { revenue += d.data().amount || 0; });

      let outstanding = 0;
      feesSnap.docs.forEach(d => {
        const fee = d.data();
        if (fee.status !== 'paid') outstanding += fee.balance || 0;
      });

      let salaryLiability = 0;
      let payoutsMade = 0;
      let grossCost = 0;
      salariesSnap.docs.forEach(d => {
        const sal = d.data();
        salaryLiability += sal.pending || 0;
        payoutsMade += sal.paid || 0;
        grossCost += sal.earnings || 0;
      });

      finance = {
        revenue,           // paise
        outstanding,       // paise — unpaid fee balance
        salaryLiability,   // paise — pending tutor pay
        payoutsMade,       // paise — already paid out
        net: revenue - payoutsMade,
        grossMargin: revenue - grossCost,
      };

      // Populate the unpaid-salaries alert using data already in memory — no extra query
      alerts.unpaidSalaries = salariesSnap.docs.filter(d => d.data().status !== 'paid').length;
    }

    return NextResponse.json({
      period,
      students: {
        totalActive: totalActiveStudents,
        newThisMonth: newStudents,
        atRisk,
      },
      tutors: {
        totalActive: totalActiveTutors,
        utilization: tutorUtilization,
      },
      academic: {
        conducted,
        missed,
        cancelled,
        attendancePct,
        pendingReviews: pendingReview,
        avgTestPct,
        ptm: {
          scheduled: ptmScheduled,
          completed: ptmCompleted,
          cancelled: ptmCancelled,
        },
      },
      crm: {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
        expectedValue,
        leadsBySource,
      },
      alerts,
      ...(finance ? { finance } : {}), // never present in an admin's payload
    });
  } catch (err: any) {
    console.error('[dashboard-stats]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
