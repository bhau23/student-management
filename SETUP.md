# Tutrain — Setup Guide

## Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud SDK (for service account)
- A Firebase project (Firestore + Auth + Cloud Functions enabled)

---

## 1. Firebase Project Configuration

### 1a. Get your Firebase config
In the Firebase console → Project Settings → Your apps → Web app config. Paste into `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 1b. Admin SDK service account (for Next.js API routes)
Firebase Console → Project Settings → Service Accounts → Generate New Private Key.
Save as `serviceAccountKey.json` (never commit!), then add to `.env.local`:
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```
Or point to the file path:
```
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
```

### 1c. Enable Firebase services
- Authentication → Sign-in methods → Email/Password ✓
- Firestore → Create database (Production mode)
- Cloud Functions → Enable billing (Blaze plan required)

---

## 2. Seed the Super Admin

After deploying, run this one-time script to create the first super_admin:

```bash
cd functions
npm run seed-admin -- --email admin@eqourse.com --password <secure>
```

Or manually:
1. Create a user in Firebase Auth console
2. In Firestore, create `users/{uid}` with `{ role: 'super_admin', active: true, createdAt: now }`
3. Call the `setCustomClaims` function to set the Auth claim

---

## 3. Google Drive Integration (Ingestion Function)

### 3a. Create a Google Cloud service account
1. Google Cloud Console → IAM & Admin → Service Accounts → Create
2. Grant no roles (Drive access is handled via sharing)
3. Create and download a JSON key
4. Add the JSON key as a Firebase Functions secret:
   ```bash
   firebase functions:secrets:set GOOGLE_DRIVE_SA_KEY
   # paste the JSON key content when prompted
   ```

### 3b. Share your Drive folders
Share both folders with the service account email (format: `name@project.iam.gserviceaccount.com`) as **Viewer**.

### 3c. Store folder IDs in Firestore
In Firestore console, create:
- `_system/ingestState` → `{ recordingsFolderId: "...", reportsFolderId: "..." }`

---

## 4. Deploy

### Deploy Firestore rules and indexes
```bash
firebase deploy --only firestore
```

### Deploy Cloud Functions
```bash
cd functions && npm run build
firebase deploy --only functions
```

### Deploy frontend (Vercel)
```bash
vercel --prod
```
Set all `NEXT_PUBLIC_*` env vars in Vercel dashboard, and `FIREBASE_SERVICE_ACCOUNT_KEY` as a secret env var.

---

## 5. meetingCodeIndex Bootstrap

For existing enrollments, run this one-time migration:
```bash
npx ts-node scripts/bootstrap-meeting-code-index.ts
```

---

## 6. Test the ingestion pipeline

1. Place sample attendance XLSX files in the reports Drive folder
2. Wait up to 15 minutes for the scheduled function, OR trigger manually:
   ```bash
   firebase functions:shell
   # then: ingestMeetData()
   ```
3. Check Firestore `class_sessions/` and `_system/unmappedQueue/`
