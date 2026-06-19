import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check that we have real config values before initializing
const hasConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_api_key_here' &&
  firebaseConfig.projectId
);

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (hasConfig) {
  // Initialize Firebase (guard against re-initialization in dev hot-reload)
  app = getApps().length === 0 ? initializeApp(firebaseConfig as any) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // During build / before env vars are set, create a placeholder app
  // so imports don't fail at module evaluation time
  if (getApps().length === 0) {
    app = initializeApp({
      apiKey: 'placeholder-key',
      authDomain: 'placeholder.firebaseapp.com',
      projectId: 'placeholder',
    });
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
  if (typeof window !== 'undefined') {
    console.warn(
      '[Tutrain] Firebase is not configured. Create a .env.local file based on .env.local.example and fill in your Firebase project credentials.'
    );
  }
}

export { auth, db };
export default app!;
