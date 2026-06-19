import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  } else {
    admin.initializeApp();
  }
}

/**
 * Secure recording / transcript / chat streaming endpoint.
 *
 * Verifies the caller owns the session (student, tutor, or admin),
 * then streams the Drive file using the service account's credentials.
 * Supports HTTP Range headers for video seeking.
 *
 * Query params:
 *   sessionId – class_sessions document ID
 *   kind      – 'video' | 'transcript' | 'chat' (default: 'video')
 *   token     – Firebase ID token (alternative to Authorization header)
 */
export const streamRecording = onRequest(
  {
    memory: '512MiB',
    timeoutSeconds: 300,
    cors: true,
    secrets: ['GOOGLE_DRIVE_SA_KEY'],
  },
  async (req, res) => {
    // 1. Extract and verify Firebase ID token
    const idToken =
      (req.query.token as string) ||
      req.headers.authorization?.split('Bearer ')[1];

    if (!idToken) {
      res.status(401).json({ error: 'Missing authentication token' });
      return;
    }

    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // 2. Resolve session + authorize
    const sessionId = req.query.sessionId as string;
    const kind = (req.query.kind as string) || 'video';

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    const snap = await admin.firestore().doc(`class_sessions/${sessionId}`).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = snap.data()!;
    const role = decoded.role as string | undefined;
    const myLinkedId = decoded.linkedId as string | undefined;

    const allowed =
      role === 'admin' ||
      role === 'super_admin' ||
      (role === 'student' && session.studentId === myLinkedId) ||
      (role === 'tutor' && session.tutorId === myLinkedId);

    if (!allowed) {
      res.status(403).json({ error: 'You do not have access to this recording' });
      return;
    }

    // 3. Resolve the Drive file ID
    const fileId =
      kind === 'transcript' ? session.transcriptDriveId :
      kind === 'chat' ? session.chatDriveId :
      session.recordingDriveId;

    if (!fileId) {
      res.status(404).json({ error: `No ${kind} file linked to this session` });
      return;
    }

    // 4. Build Drive client with service account
    const saKeyRaw = process.env.GOOGLE_DRIVE_SA_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!saKeyRaw) {
      res.status(500).json({ error: 'Drive service account not configured' });
      return;
    }

    let credentials: any;
    try {
      credentials = JSON.parse(saKeyRaw);
      // Fix double-escaped newlines in private_key (common with env files / Secret Manager)
      if (credentials.private_key && credentials.private_key.includes('\\n')) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (parseErr: any) {
      console.error('[streamRecording] Failed to parse SA key:', parseErr.message);
      res.status(500).json({ error: 'Invalid service account key format' });
      return;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    try {
      // 5. Handle transcript (Google Doc) → export as HTML
      if (kind === 'transcript') {
        const meta = await drive.files.get({ fileId, fields: 'mimeType' });
        if (meta.data.mimeType === 'application/vnd.google-apps.document') {
          const exported = await drive.files.export(
            { fileId, mimeType: 'text/html' },
            { responseType: 'arraybuffer' },
          );
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'private, max-age=3600');
          res.send(Buffer.from(exported.data as ArrayBuffer));
          return;
        }
        // If it's a regular file (e.g. .vtt), fall through to stream
      }

      // 6. Stream the file (video / chat / non-Google-Doc transcript)
      // Cloud Run limits responses to 32MB. We must enforce chunked range requests.
      const meta = await drive.files.get({ fileId, fields: 'size, mimeType' });
      const totalSize = parseInt(meta.data.size || '0', 10);

      let start = 0;
      let end = totalSize > 0 ? totalSize - 1 : 0;

      if (req.headers.range) {
        const parts = req.headers.range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10) || 0;
        if (parts[1]) {
          end = parseInt(parts[1], 10);
        }
      }

      const MAX_CHUNK = 10 * 1024 * 1024; // 10MB
      if (end - start + 1 > MAX_CHUNK) {
        end = start + MAX_CHUNK - 1;
      }
      if (end >= totalSize && totalSize > 0) {
        end = totalSize - 1;
      }

      const driveRes = await drive.files.get(
        { fileId, alt: 'media' },
        {
          responseType: 'stream',
          headers: { Range: `bytes=${start}-${end}` },
        },
      );

      // Force 206 Partial Content for chunked streaming
      res.status(206);
      
      // Pass headers manually to ensure the browser understands the chunking
      res.setHeader('Content-Type', meta.data.mimeType || 'video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(end - start + 1));
      if (totalSize > 0) {
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      }
      res.setHeader('Cache-Control', 'private, max-age=3600');

      // Pipe the stream
      (driveRes.data as NodeJS.ReadableStream).pipe(res);
    } catch (err: any) {
      console.error('[streamRecording] Drive error:', err.message);
      if (err.code === 404) {
        res.status(404).json({ error: 'File not found in Drive' });
      } else {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    }
  },
);
