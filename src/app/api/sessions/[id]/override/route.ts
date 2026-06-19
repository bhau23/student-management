import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/sessions/[id]/override
 * Admin override on a flagged class session.
 * Updates attendanceStatus, clears the flag, writes audit log.
 *
 * Body: { attendanceStatus: 'present' | 'absent', adminRemark: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify caller is admin (check their token)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth().verifyIdToken(token);
    if (!['admin', 'super_admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: sessionId } = await params;
    const { attendanceStatus, adminRemark } = await req.json();
    const db = adminDb();
    const sessionRef = db.collection('class_sessions').doc(sessionId);
    const before = (await sessionRef.get()).data();

    await sessionRef.update({
      attendanceStatus,
      adminRemark: adminRemark ?? '',
      adminOverrideBy: decoded.uid,
      flaggedUnderMin: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Audit
    await db.collection('audit_log').add({
      actorUid: decoded.uid,
      action: 'update',
      entity: 'class_sessions',
      entityId: sessionId,
      before: before ?? null,
      after: { attendanceStatus, adminRemark },
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[session-override]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
