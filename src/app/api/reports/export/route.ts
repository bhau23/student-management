import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth().verifyIdToken(token);
    
    // Read custom claims directly
    const role = decoded.role as string;
    if (!['admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { type, period } = await req.json(); // type: 'students'|'attendance'|'fees'|'salaries'|'tests'|'leads'
    
    // Finance gate
    if (['fees', 'salaries'].includes(type) && role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin required for finance reports' }, { status: 403 });
    }

    let csvContent = '';

    if (type === 'attendance') {
      // Fetch attendance for the period
      const start = `${period}-01`;
      const end = `${period}-31`;
      const snap = await adminDb().collection('class_sessions')
        .where('date', '>=', start)
        .where('date', '<=', end)
        .get();
      
      csvContent = 'Session ID,Student,Subject,Date,Attendance,Attended Min\n';
      snap.docs.forEach(d => {
        const r = d.data();
        const studentName = (r.studentName || r.studentId).replace(/"/g, '""');
        const subjectName = (r.subjectName || r.subjectId).replace(/"/g, '""');
        csvContent += `${d.id},"${studentName}","${subjectName}",${r.date},${r.attendanceStatus},${r.attendedMin}\n`;
      });
    } else if (type === 'fees') {
      // Fetch fees for the period
      const snap = await adminDb().collection('fees')
        .where('billingMonth', '==', period)
        .get();
      
      csvContent = 'Fee ID,Student,Month,Total (INR),Paid (INR),Balance (INR),Status\n';
      snap.docs.forEach(d => {
        const r = d.data();
        const studentName = (r.studentName || r.studentId).replace(/"/g, '""');
        csvContent += `${d.id},"${studentName}",${r.billingMonth},${r.totalFee/100},${r.paid/100},${r.balance/100},${r.status}\n`;
      });
    } else if (type === 'salaries') {
      // Fetch salaries
      const snap = await adminDb().collection('salaries')
        .where('billingMonth', '==', period)
        .get();
      
      csvContent = 'Salary ID,Tutor,Month,Earnings (INR),Paid (INR),Pending (INR),Status\n';
      snap.docs.forEach(d => {
        const r = d.data();
        const tutorName = (r.tutorName || r.tutorId).replace(/"/g, '""');
        csvContent += `${d.id},"${tutorName}",${r.billingMonth},${r.earnings/100},${r.paid/100},${r.pending/100},${r.status}\n`;
      });
    } else if (type === 'leads') {
      // Fetch leads
      const snap = await adminDb().collection('leads')
        .where('createdAt', '>=', new Date(`${period}-01`))
        .where('createdAt', '<', new Date(`${period}-31T23:59:59`))
        .get();
      
      csvContent = 'Lead ID,Name,Contact,Source,Stage,Expected Value (INR)\n';
      snap.docs.forEach(d => {
        const row = d.data();
        csvContent += `${d.id},${row.name},${row.contact},${row.source},${row.stage},${(row.value || 0) / 100}\n`;
      });
    } else if (type === 'students') {
      const snap = await adminDb().collection('students').get();
      csvContent = 'Student ID,Name,Grade,School,Status\n';
      snap.docs.forEach(d => {
        const row = d.data();
        csvContent += `${d.id},${row.name},${row.grade},${row.school},${row.active ? 'Active' : 'Inactive'}\n`;
      });
    } else {
      return NextResponse.json({ error: 'Unsupported report type' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}_report_${period}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
