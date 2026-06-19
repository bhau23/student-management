import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Firestore trigger: runs when a /users/{uid} document is created.
 * Sets custom Auth claims { role, linkedId } from the document data.
 * This fires AFTER the user is created (via the create-user API route),
 * so the Firestore doc exists at claim-set time.
 */
export const onNewUserDoc = onDocumentCreated('users/{uid}', async (event) => {
  const uid = event.params.uid;
  const data = event.data?.data() as { role: string; linkedId: string } | undefined;

  if (!data || !data.role) {
    console.warn(`[setClaims] /users/${uid} has no role field — skipping`);
    return;
  }

  try {
    await admin.auth().setCustomUserClaims(uid, {
      role: data.role,
      linkedId: data.linkedId ?? null,
    });
    console.log(`[setClaims] Claims set for ${uid}: role=${data.role}, linkedId=${data.linkedId}`);
  } catch (err) {
    console.error(`[setClaims] Error setting claims for ${uid}:`, err);
  }
});

/**
 * Callable function: admin can manually refresh custom claims for any user.
 * Useful if role/linkedId is changed in Firestore after initial creation.
 */
export const refreshClaims = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  const callerClaims = request.auth.token as { role?: string };
  if (!['admin', 'super_admin'].includes(callerClaims.role ?? '')) {
    throw new HttpsError('permission-denied', 'Only admins can refresh claims');
  }

  const { targetUid } = request.data as { targetUid: string };
  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid is required');

  const userDoc = await db.doc(`users/${targetUid}`).get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'User document not found');

  const userData = userDoc.data() as { role: string; linkedId: string };
  await admin.auth().setCustomUserClaims(targetUid, {
    role: userData.role,
    linkedId: userData.linkedId ?? null,
  });

  return { ok: true, role: userData.role, linkedId: userData.linkedId };
});
