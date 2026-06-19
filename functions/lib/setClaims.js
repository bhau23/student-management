"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshClaims = exports.onNewUserDoc = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
if (!admin.apps.length)
    admin.initializeApp();
const db = admin.firestore();
/**
 * Firestore trigger: runs when a /users/{uid} document is created.
 * Sets custom Auth claims { role, linkedId } from the document data.
 * This fires AFTER the user is created (via the create-user API route),
 * so the Firestore doc exists at claim-set time.
 */
exports.onNewUserDoc = (0, firestore_1.onDocumentCreated)('users/{uid}', async (event) => {
    var _a, _b;
    const uid = event.params.uid;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data || !data.role) {
        console.warn(`[setClaims] /users/${uid} has no role field — skipping`);
        return;
    }
    try {
        await admin.auth().setCustomUserClaims(uid, {
            role: data.role,
            linkedId: (_b = data.linkedId) !== null && _b !== void 0 ? _b : null,
        });
        console.log(`[setClaims] Claims set for ${uid}: role=${data.role}, linkedId=${data.linkedId}`);
    }
    catch (err) {
        console.error(`[setClaims] Error setting claims for ${uid}:`, err);
    }
});
/**
 * Callable function: admin can manually refresh custom claims for any user.
 * Useful if role/linkedId is changed in Firestore after initial creation.
 */
exports.refreshClaims = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated');
    const callerClaims = request.auth.token;
    if (!['admin', 'super_admin'].includes((_a = callerClaims.role) !== null && _a !== void 0 ? _a : '')) {
        throw new https_1.HttpsError('permission-denied', 'Only admins can refresh claims');
    }
    const { targetUid } = request.data;
    if (!targetUid)
        throw new https_1.HttpsError('invalid-argument', 'targetUid is required');
    const userDoc = await db.doc(`users/${targetUid}`).get();
    if (!userDoc.exists)
        throw new https_1.HttpsError('not-found', 'User document not found');
    const userData = userDoc.data();
    await admin.auth().setCustomUserClaims(targetUid, {
        role: userData.role,
        linkedId: (_b = userData.linkedId) !== null && _b !== void 0 ? _b : null,
    });
    return { ok: true, role: userData.role, linkedId: userData.linkedId };
});
//# sourceMappingURL=setClaims.js.map