import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      let rawKey = serviceAccountKey.trim();
      // Remove surrounding single quotes if pasted accidentally into Vercel UI
      if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
        rawKey = rawKey.slice(1, -1);
      }
      
      const serviceAccount = JSON.parse(rawKey);
      if (serviceAccount.private_key) {
        // Ensure newlines in private key are correctly interpreted
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (e: any) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e.message);
      throw new Error(`Firebase Admin Initialization Error: Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON format. Ensure you pasted the exact JSON string into Vercel.`);
    }
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Falling back to Application Default Credentials.');
    // Fall back to application default credentials (mostly for local development with gcloud auth)
    app = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }

  return app;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export default getAdminApp;
