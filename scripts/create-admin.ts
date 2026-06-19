import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}';
const serviceAccount = JSON.parse(serviceAccountKey);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();
const auth = getAuth();

async function createAdmin() {
  const email = 'admin@tutrain.com';
  const password = 'Password123!';
  
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log('User already exists in Auth:', userRecord.uid);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: 'Ops Admin'
      });
      console.log('Successfully created new user:', userRecord.uid);
    } else {
      throw error;
    }
  }

  // Set custom claims
  await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
  console.log('Successfully set admin custom claim.');

  // Create Firestore document
  await db.collection('users').doc(userRecord.uid).set({
    email,
    role: 'admin',
    createdAt: FieldValue.serverTimestamp()
  });
  console.log('Successfully created /users document.');
  
  console.log('\n--- OPS ADMIN ACCOUNT READY ---');
  console.log('Email:', email);
  console.log('Password:', password);
}

createAdmin().catch(console.error);
