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
exports.ingestMeetData = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const XLSX = __importStar(require("xlsx"));
if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const creds = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(creds),
            projectId: creds.project_id
        });
    }
    else {
        admin.initializeApp();
    }
}
const db = admin.firestore();
// ── Regex patterns ─────────────────────────────────────────────────────────────
// Format 1: "ryu-auqj-dvm (2026-06-14 18:00 GMT+5:30) Attendance report.xlsx"
// Format 2: "2026-06-15 13:18 hgy-eqfd-dhp Attendance report"
function parseReportName(name) {
    let m = /^([a-z]{3}-[a-z]{4}-[a-z]{3})\s+\((\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+GMT/.exec(name);
    if (m)
        return { code: m[1], date: m[2], time: m[3] };
    m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+([a-z]{3}-[a-z]{4}-[a-z]{3})\s+Attendance report/.exec(name);
    if (m)
        return { code: m[3], date: m[1], time: m[2] };
    return null;
}
// Recording filenames come in the same two formats as reports:
// Format 1: "ryu-auqj-dvm (2026-06-14 18:00 GMT+5:30) Recording.mp4"
// Format 2: "2026-06-14 18:00 hgy-eqfd-dhp Recording.mp4"
function parseRecordingName(name) {
    let m = /^([a-z]{3}-[a-z]{4}-[a-z]{3})\s+\((\d{4}-\d{2}-\d{2})/.exec(name);
    if (m)
        return { code: m[1], date: m[2] };
    m = /^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}\s+([a-z]{3}-[a-z]{4}-[a-z]{3})/.exec(name);
    if (m)
        return { code: m[2], date: m[1] };
    return null;
}
const TUTOR_RE = /\.tutor@eqourse\.com$/i;
// ── Duration parser ────────────────────────────────────────────────────────────
// Handles: "1 hr 1 min", "1 hr 3 mins", "45 mins", "2 hrs", "0:45:12"
function durationToMin(s) {
    if (!s)
        return 0;
    // HH:MM:SS format
    if (/^\d+:\d+:\d+$/.test(s)) {
        const [h, m] = s.split(':').map(Number);
        return h * 60 + m;
    }
    let m = 0;
    const h = s.match(/(\d+)\s*hr/);
    if (h)
        m += parseInt(h[1]) * 60;
    const mn = s.match(/(\d+)\s*min/);
    if (mn)
        m += parseInt(mn[1]);
    return m;
}
// ── Drive client ───────────────────────────────────────────────────────────────
async function driveClient() {
    let auth;
    const saKey = process.env.GOOGLE_DRIVE_SA_KEY;
    if (saKey) {
        const credentials = JSON.parse(saKey);
        auth = new googleapis_1.google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
    }
    else {
        auth = new googleapis_1.google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
    }
    return googleapis_1.google.drive({ version: 'v3', auth });
}
// ── List files in a Drive folder ───────────────────────────────────────────────
async function listFiles(drive, folderId, recurse = false, modifiedAfter = null) {
    const all = [];
    const fetch = async (parentId) => {
        var _a, _b;
        let pageToken;
        const folderPromises = [];
        do {
            const qParts = [`'${parentId}' in parents`, `trashed = false`];
            if (modifiedAfter)
                qParts.push(`modifiedTime > '${modifiedAfter}'`);
            const res = await drive.files.list({
                q: qParts.join(' and '),
                fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, parents)',
                pageSize: 200,
                pageToken,
            });
            const files = (_a = res.data.files) !== null && _a !== void 0 ? _a : [];
            for (const f of files) {
                if (recurse && f.mimeType === 'application/vnd.google-apps.folder') {
                    if (modifiedAfter && f.modifiedTime && f.modifiedTime <= modifiedAfter)
                        continue;
                    folderPromises.push(fetch(f.id));
                }
                else {
                    all.push(f);
                }
            }
            pageToken = (_b = res.data.nextPageToken) !== null && _b !== void 0 ? _b : undefined;
        } while (pageToken);
        await Promise.all(folderPromises);
    };
    await fetch(folderId);
    return all;
}
// ── Parse XLSX attendance report ───────────────────────────────────────────────
async function parseXlsx(drive, file) {
    let res;
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
        res = await drive.files.export({ fileId: file.id, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { responseType: 'arraybuffer' });
    }
    else {
        res = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'arraybuffer' });
    }
    const wb = XLSX.read(Buffer.from(res.data), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // Row 0 = headers; rows 1+ = data
    return rows.slice(1).filter((r) => r.length >= 3).map((r) => {
        var _a, _b, _c, _d, _e, _f;
        return ({
            firstName: String((_a = r[0]) !== null && _a !== void 0 ? _a : '').trim(),
            lastName: String((_b = r[1]) !== null && _b !== void 0 ? _b : '').trim(),
            email: String((_c = r[2]) !== null && _c !== void 0 ? _c : '').toLowerCase().trim(),
            duration: String((_d = r[3]) !== null && _d !== void 0 ? _d : ''),
            joined: String((_e = r[4]) !== null && _e !== void 0 ? _e : ''),
            exited: String((_f = r[5]) !== null && _f !== void 0 ? _f : ''),
        });
    });
}
function matchRec(recFiles, code, date) {
    var _a, _b, _c, _d, _e, _f, _g;
    const result = { video: null, transcript: null, chat: null };
    for (const f of recFiles) {
        const parsed = parseRecordingName((_a = f.name) !== null && _a !== void 0 ? _a : '');
        if (!parsed || parsed.code !== code || parsed.date !== date)
            continue;
        const lower = ((_b = f.name) !== null && _b !== void 0 ? _b : '').toLowerCase();
        if (lower.includes('chat'))
            result.chat = (_c = f.id) !== null && _c !== void 0 ? _c : null;
        else if (lower.includes('transcript') || lower.endsWith('.vtt') || lower.endsWith('.sbv'))
            result.transcript = (_d = f.id) !== null && _d !== void 0 ? _d : null;
        else if (lower.includes('recording') ||
            lower.endsWith('.mp4') ||
            lower.endsWith('.webm') ||
            (f.mimeType && f.mimeType.startsWith('video/'))) {
            result.video = (_e = f.id) !== null && _e !== void 0 ? _e : null;
        }
        else if (!lower.includes('attendance') && !((_f = f.mimeType) === null || _f === void 0 ? void 0 : _f.includes('spreadsheet'))) {
            // Ultimate fallback: if it's not a known transcript, chat, or attendance report, assume it's the video
            result.video = (_g = f.id) !== null && _g !== void 0 ? _g : null;
        }
    }
    return result;
}
function now() { return admin.firestore.FieldValue.serverTimestamp(); }
// ── Core session writer ────────────────────────────────────────────────────────
// Extracted so it can be called from BOTH the main loop AND the unmappedQueue
// reconciliation path (which bypasses the watermark filter entirely).
async function ingestGroup(drive, key, reportFiles, recFiles) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { code, date, time } = reportFiles[0];
    // Resolve enrollment via meetingCodeIndex (O(1) lookup)
    const idxSnap = await db.doc(`meetingCodeIndex/${code}`).get();
    if (!idxSnap.exists) {
        throw new Error(`NO_ENROLLMENT:${code}`);
    }
    const enrollmentId = idxSnap.data().enrollmentId;
    const enrSnap = await db.doc(`enrollments/${enrollmentId}`).get();
    if (!enrSnap.exists) {
        throw new Error(`ENROLLMENT_DOC_MISSING:${enrollmentId}`);
    }
    const enr = enrSnap.data();
    // Fetch denormalized names directly from the referenced docs
    const [studentSnap, tutorSnap, subjectSnap] = await Promise.all([
        db.doc(`students/${enr.studentId}`).get(),
        db.doc(`tutors/${enr.tutorId}`).get(),
        db.doc(`subjects/${enr.subjectId}`).get(),
    ]);
    // Parse + aggregate ALL rows across files (rejoin handling)
    const people = {};
    const rawRows = [];
    for (const f of reportFiles) {
        let rows;
        try {
            rows = await parseXlsx(drive, f);
        }
        catch (e) {
            console.error(`[ingest] Failed to parse file ${f.id} (${f.name}):`, e);
            continue;
        }
        for (const r of rows) {
            const isTutor = TUTOR_RE.test(r.email);
            const personKey = isTutor ? '__tutor__' : `${r.firstName}|${r.lastName}|${r.email}`;
            const dur = durationToMin(r.duration);
            if (!people[personKey]) {
                people[personKey] = Object.assign(Object.assign({}, r), { durationMin: 0, isTutor });
            }
            people[personKey].durationMin += dur;
            if (!people[personKey].joined || r.joined < people[personKey].joined) {
                people[personKey].joined = r.joined;
            }
            if (!people[personKey].exited || r.exited > people[personKey].exited) {
                people[personKey].exited = r.exited;
            }
            rawRows.push(Object.assign(Object.assign({}, r), { durationMin: dur, isTutor, fileId: f.id }));
        }
    }
    const studentEntry = Object.values(people).find((p) => !p.isTutor);
    const attended = (_a = studentEntry === null || studentEntry === void 0 ? void 0 : studentEntry.durationMin) !== null && _a !== void 0 ? _a : 0;
    const minRequired = (_b = enr.minPresentMin) !== null && _b !== void 0 ? _b : 45;
    const flagged = attended < minRequired;
    // Link recording / transcript / chat
    const rec = matchRec(recFiles, code, date);
    // Idempotent upsert — doc ID is deterministic
    const sessionId = key; // `${code}_${date}`
    const sessionRef = db.doc(`class_sessions/${sessionId}`);
    const existingSnap = await sessionRef.get();
    const existing = existingSnap.data();
    const isOverridden = !!(existing === null || existing === void 0 ? void 0 : existing.adminOverrideBy);
    const factual = {
        id: sessionId,
        enrollmentId: enrollmentId,
        studentId: enr.studentId,
        studentName: ((_c = studentSnap.data()) === null || _c === void 0 ? void 0 : _c.name) || null,
        subjectId: enr.subjectId,
        subjectName: ((_d = subjectSnap.data()) === null || _d === void 0 ? void 0 : _d.name) || null,
        tutorId: enr.tutorId,
        tutorName: ((_e = tutorSnap.data()) === null || _e === void 0 ? void 0 : _e.name) || null,
        perClassRate: ((_f = tutorSnap.data()) === null || _f === void 0 ? void 0 : _f.perClassRate) || null,
        meetingCode: code,
        date,
        scheduledStart: `${date}T${time}:00`,
        actualStart: (_g = studentEntry === null || studentEntry === void 0 ? void 0 : studentEntry.joined) !== null && _g !== void 0 ? _g : null,
        actualEnd: (_h = studentEntry === null || studentEntry === void 0 ? void 0 : studentEntry.exited) !== null && _h !== void 0 ? _h : null,
        attendedMin: attended,
        status: 'conducted',
        source: 'auto',
        updatedAt: now(),
    };
    // Only include recording fields when we actually found the file.
    // Never write null over a previously-linked good ID.
    if (rec.video)
        factual.recordingDriveId = rec.video;
    if (rec.transcript)
        factual.transcriptDriveId = rec.transcript;
    if (rec.chat)
        factual.chatDriveId = rec.chat;
    // Set createdAt only on first write — never overwrite
    if (!existing) {
        factual.createdAt = now();
        factual.adminOverrideBy = null;
        factual.adminRemark = null;
    }
    const review = isOverridden ? {} : {
        attendanceStatus: flagged ? 'pending_review' : 'present',
        flaggedUnderMin: flagged,
    };
    await sessionRef.set(Object.assign(Object.assign({}, factual), review), { merge: true });
    // Write raw attendance rows (idempotent via subcollection)
    const batch = db.batch();
    for (const r of rawRows) {
        const rawId = `${sessionId}_${r.email}_${r.fileId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        batch.set(db.collection('attendance_raw').doc(rawId), {
            sessionId, meetingCode: code, date,
            firstName: r.firstName, lastName: r.lastName, email: r.email,
            durationMin: r.durationMin, joined: r.joined, exited: r.exited,
            isTutor: r.isTutor, fileId: r.fileId,
        }, { merge: true });
    }
    await batch.commit();
    console.log(`[ingest] ✓ ${sessionId}: ${attended} min, flagged=${flagged}${isOverridden ? ' [admin override preserved]' : ''}`);
}
// ── Main ingestion function ────────────────────────────────────────────────────
exports.ingestMeetData = (0, scheduler_1.onSchedule)({
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    secrets: ['GOOGLE_DRIVE_SA_KEY'],
    memory: '512MiB',
    timeoutSeconds: 300,
}, async () => {
    var _a, _b, _c, _d, _e, _f, _g;
    console.log('[ingest] Starting ingestion run…');
    const drive = await driveClient();
    const stateRef = db.doc('_system/ingestState');
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
        console.error('[ingest] _system/ingestState missing. Create it with recordingsFolderId + reportsFolderId.');
        return;
    }
    const state = stateSnap.data();
    const { recordingsFolderId, reportsFolderId, lastModifiedSeen } = state;
    // 1. List files from both folders
    // Reports use the success-gated watermark (only advances on clean group success).
    const watermark = lastModifiedSeen !== null && lastModifiedSeen !== void 0 ? lastModifiedSeen : null;
    // Recordings use a 72h rolling window to catch late-arriving large files.
    const last72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const [reportFiles, recFiles] = await Promise.all([
        listFiles(drive, reportsFolderId, true, watermark),
        listFiles(drive, recordingsFolderId, false, last72h),
    ]);
    console.log(`[ingest] Found ${reportFiles.length} report files, ${recFiles.length} recording files`);
    // newestModified is advanced ONLY inside the success path of the main loop.
    // Unmapped and thrown groups do NOT advance it — they stay visible to the next run.
    let newestModified = lastModifiedSeen !== null && lastModifiedSeen !== void 0 ? lastModifiedSeen : '';
    // 2. Group files by (code, date)
    const groups = {};
    for (const f of reportFiles) {
        if (!((_a = f.name) !== null && _a !== void 0 ? _a : '').includes('Attendance report'))
            continue;
        const parsed = parseReportName((_b = f.name) !== null && _b !== void 0 ? _b : '');
        if (!parsed) {
            console.warn(`[ingest] Skipping unrecognized filename: ${f.name}`);
            continue;
        }
        const key = `${parsed.code}_${parsed.date}`;
        (groups[key] || (groups[key] = { reports: [], recordings: [] })).reports.push(Object.assign(Object.assign({}, f), { code: parsed.code, date: parsed.date, time: parsed.time }));
    }
    for (const f of recFiles) {
        const parsed = parseRecordingName((_c = f.name) !== null && _c !== void 0 ? _c : '');
        if (!parsed)
            continue;
        const key = `${parsed.code}_${parsed.date}`;
        (groups[key] || (groups[key] = { reports: [], recordings: [] })).recordings.push(f);
    }
    console.log(`[ingest] Processing ${Object.keys(groups).length} (code, date) groups`);
    for (const [key, group] of Object.entries(groups)) {
        const { reports, recordings } = group;
        const [code, date] = key.split('_');
        // Recordings-only → just patch the existing session's media links
        if (reports.length === 0) {
            if (recordings.length === 0)
                continue;
            const rec = matchRec(recordings, code, date);
            const sessionRef = db.doc(`class_sessions/${key}`);
            const existingSnap = await sessionRef.get();
            if (existingSnap.exists) {
                const recPatch = { updatedAt: now() };
                if (rec.video)
                    recPatch.recordingDriveId = rec.video;
                if (rec.transcript)
                    recPatch.transcriptDriveId = rec.transcript;
                if (rec.chat)
                    recPatch.chatDriveId = rec.chat;
                await sessionRef.set(recPatch, { merge: true });
                console.log(`[ingest] Patched recordings for existing session ${key}`);
            }
            continue;
        }
        try {
            // Check enrollment before calling ingestGroup — unmapped groups must NOT
            // advance the watermark, so we check here and store in the queue.
            const idxSnap = await db.doc(`meetingCodeIndex/${code}`).get();
            if (!idxSnap.exists) {
                console.warn(`[ingest] No enrollment for code ${code} — queuing as unmapped`);
                await db.doc(`unmappedQueue/${key}`).set({
                    meetingCode: code,
                    date,
                    reason: 'no_enrollment',
                    // Store ALL report file IDs — there may be multiple (rejoin files)
                    reportFileIds: reports.map(f => f.id).filter(Boolean),
                    sampleFileId: (_d = reports[0].id) !== null && _d !== void 0 ? _d : null,
                    reportModifiedTime: (_e = reports[0].modifiedTime) !== null && _e !== void 0 ? _e : null,
                    dismissed: false,
                    createdAt: now(),
                }, { merge: true });
                // Deliberately skip advancing newestModified.
                continue;
            }
            await ingestGroup(drive, key, reports, recordings);
            // SUCCESS — advance watermark past these report files
            for (const f of reports) {
                if (f.modifiedTime && f.modifiedTime > newestModified)
                    newestModified = f.modifiedTime;
            }
        }
        catch (err) {
            // Do NOT advance newestModified — next run will retry this group.
            console.error(`[ingest] Error processing group ${key}:`, err);
        }
    }
    // 3. unmappedQueue reconciliation
    // For every queued entry whose code is now mapped:
    //   → Actively re-fetch + re-ingest that specific code+date by fileId,
    //     bypassing the watermark entirely (the file is old; the listing filter won't see it).
    //   → Only delete the queue entry AFTER the session is successfully written.
    //   → If dismissed=true, skip re-ingestion but still delete to release the watermark pin.
    const unmappedSnap = await db.collection('unmappedQueue')
        .where('dismissed', '==', false)
        .get();
    let reconciledCount = 0;
    // Minor optimization: Fetch recordings once for the entire reconciliation batch
    let reconcileRecFiles = null;
    if (!unmappedSnap.empty) {
        reconcileRecFiles = await listFiles(drive, state.recordingsFolderId, false, null);
    }
    for (const qDoc of unmappedSnap.docs) {
        const q = qDoc.data();
        // Check if enrollment now exists
        const nowIdxSnap = await db.doc(`meetingCodeIndex/${q.meetingCode}`).get();
        if (!nowIdxSnap.exists)
            continue; // still unmapped — leave in queue, let it pin the watermark
        try {
            // Fetch file metadata for ALL report files by their IDs (bypasses watermark)
            const fileIds = (_f = q.reportFileIds) !== null && _f !== void 0 ? _f : [q.sampleFileId];
            const reportFileMetas = [];
            for (const fileId of fileIds) {
                if (!fileId)
                    continue;
                const fileRes = await drive.files.get({
                    fileId,
                    fields: 'id, name, mimeType, modifiedTime',
                });
                const f = fileRes.data;
                const parsed = parseReportName((_g = f.name) !== null && _g !== void 0 ? _g : '');
                if (parsed) {
                    reportFileMetas.push(Object.assign(Object.assign({}, f), { code: parsed.code, date: parsed.date, time: parsed.time }));
                }
            }
            if (reportFileMetas.length === 0) {
                console.warn(`[ingest] Could not fetch report files for unmapped entry ${qDoc.id}`);
                continue;
            }
            const reconcileKey = `${reportFileMetas[0].code}_${reportFileMetas[0].date}`;
            // Fully ingest the session — same logic as the main loop
            await ingestGroup(drive, reconcileKey, reportFileMetas, reconcileRecFiles);
            // SUCCESS: delete the queue entry
            await qDoc.ref.delete();
            reconciledCount++;
            console.log(`[ingest] ✓ Reconciled unmapped code ${q.meetingCode} (${q.date}) — session created.`);
        }
        catch (e) {
            console.error(`[ingest] Failed to reconcile unmapped entry ${qDoc.id}:`, e);
        }
    }
    if (reconciledCount > 0)
        console.log(`[ingest] Reconciled ${reconciledCount} unmapped queue entries.`);
    // Also clean up dismissed entries (admin manually retired them)
    const dismissedSnap = await db.collection('unmappedQueue')
        .where('dismissed', '==', true)
        .get();
    const dismissedBatch = db.batch();
    dismissedSnap.docs.forEach(d => dismissedBatch.delete(d.ref));
    if (!dismissedSnap.empty) {
        await dismissedBatch.commit();
        console.log(`[ingest] Cleared ${dismissedSnap.size} dismissed unmapped queue entries.`);
    }
    // 4. Advance watermark
    const watermarkUpdate = { lastRunAt: now() };
    if (newestModified)
        watermarkUpdate.lastModifiedSeen = newestModified;
    await stateRef.set(watermarkUpdate, { merge: true });
    console.log('[ingest] Run complete.');
});
//# sourceMappingURL=ingest.js.map