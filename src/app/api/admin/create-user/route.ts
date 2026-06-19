import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/admin/create-user
 * Creates a Firebase Auth user and the corresponding Firestore profile document.
 * Sets custom claims { role, linkedId } on the Auth user.
 * Requires a valid admin Bearer token.
 *
 * Body: {
 *   email: string,
 *   password: string,
 *   role: 'tutor' | 'student',
 *   collection: 'tutors' | 'students',
 *   profile: { name, ...rest }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (!['admin', 'super_admin'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const actorUid = decoded.uid;

    const body = await req.json();
    const { email, password, role, collection: col, profile } = body;

    // Privilege ceiling: only a super_admin can create a super_admin
    if (role === 'super_admin' && decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only a super_admin can create a super_admin' }, { status: 403 });
    }

    // 1. Create Firebase Auth user
    const authUser = await adminAuth().createUser({
      email,
      password,
      displayName: profile.name,
    });

    // 2. Create Firestore profile document
    const db = adminDb();
    const docRef = db.collection(col).doc();
    const docId = docRef.id;

    await docRef.set({
      ...profile,
      id: docId,
      authUid: authUser.uid,
      active: true,
      ...(col === 'students' ? { tutorIds: [] } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 3. Create user record in /users collection
    await db.collection('users').doc(authUser.uid).set({
      uid: authUser.uid,
      email,
      role,
      linkedId: docId,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: actorUid,
    });

    // 4. Set custom claims on Auth token
    await adminAuth().setCustomUserClaims(authUser.uid, {
      role,
      linkedId: docId,
    });

    // 5. Write audit log with real actor uid
    await db.collection('audit_log').add({
      actorUid,
      action: 'create',
      entity: col,
      entityId: docId,
      before: null,
      after: { email, role },
      ts: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ uid: authUser.uid, docId }, { status: 201 });
  } catch (err: any) {
    console.error('[create-user]', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to create user' },
      { status: 500 }
    );
  }
}

