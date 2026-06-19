import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/set-claims
 * Manually sets custom claims on an existing Firebase Auth user.
 * Called if claims need to be updated (e.g. role change).
 *
 * Body: { uid, role, linkedId }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '') || null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const caller = await adminAuth().verifyIdToken(token);

    // 2. Caller must be staff
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { uid, role, linkedId } = await req.json();
    if (!uid || !role) return NextResponse.json({ error: 'uid and role are required' }, { status: 400 });

    // 3. Privilege ceiling: only a super_admin can mint a super_admin
    if (role === 'super_admin' && caller.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only a super_admin can grant super_admin' }, { status: 403 });
    }

    await adminAuth().setCustomUserClaims(uid, { role, linkedId: linkedId ?? null });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[set-claims]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
