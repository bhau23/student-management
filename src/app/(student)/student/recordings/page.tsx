'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db, auth as firebaseAuth } from '@/lib/firebase';
import {
  collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import { Video, FileText, MessageSquare, Play, X } from 'lucide-react';

interface Session {
  id: string;
  studentId: string;
  tutorId: string;
  tutorName?: string;
  subjectId: string;
  subjectName?: string;
  date: string;
  recordingDriveId?: string | null;
  transcriptDriveId?: string | null;
  chatDriveId?: string | null;
}

const isDev = process.env.NODE_ENV === 'development';
const STREAM_BASE = process.env.NEXT_PUBLIC_STREAM_URL ||
  (isDev
    ? 'http://127.0.0.1:5001/tutrain-automation/us-central1/streamRecording'
    : 'https://us-central1-tutrain-automation.cloudfunctions.net/streamRecording');

export default function StudentRecordings() {
  const { linkedId } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<{ sessionId: string; title: string } | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<{ sessionId: string; title: string } | null>(null);
  const [idToken, setIdToken] = useState<string>('');

  // Get fresh ID token for streaming
  useEffect(() => {
    (async () => {
      if (firebaseAuth.currentUser) {
        const token = await firebaseAuth.currentUser.getIdToken(true);
        setIdToken(token);
      }
    })();
  }, []);

  // Fetch sessions with recordings
  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const snap = await getDocs(query(
        collection(db, 'class_sessions'),
        where('studentId', '==', linkedId),
        orderBy('date', 'desc'),
      ));
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Session))
        .filter(s => s.recordingDriveId || s.transcriptDriveId || s.chatDriveId);
      setSessions(all);
      setLoading(false);
    })();
  }, [linkedId]);

  // Group by subject
  const grouped = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const s of sessions) {
      const sName = s.subjectName || s.subjectId;
      if (!map.has(sName)) map.set(sName, []);
      map.get(sName)!.push(s);
    }
    // Sort descending by date
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
    return Array.from(map.entries());
  }, [sessions]);

  const streamUrl = (sessionId: string, kind: string) =>
    `${STREAM_BASE}?sessionId=${sessionId}&kind=${kind}&token=${idToken}`;

  if (loading) {
    return (
      <div className="page-body">
        <div className="loading-full"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Recordings</h1>
          <p className="subtitle">Watch past class recordings and read transcripts</p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="card">
          <div className="table-empty">
            <Video size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <div>No recordings available yet</div>
          </div>
        </div>
      ) : (
        grouped.map(([subjectName, subjectSessions]) => (
          <div key={subjectName} className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">{subjectName}</div>
              <span className="badge badge-accent">{subjectSessions.length} recordings</span>
            </div>
            <div className="recordings-list">
              {subjectSessions.map(s => (
                <div key={s.id} className="recording-row">
                  <div className="recording-info">
                    <div className="recording-date">
                      {new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </div>
                    <div className="recording-tutor text-muted">
                      {s.tutorName || s.tutorId}
                    </div>
                  </div>
                  <div className="recording-actions">
                    {s.recordingDriveId && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setActiveVideo({
                          sessionId: s.id,
                          title: `${subjectName} — ${s.date}`,
                        })}
                      >
                        <Play size={12} /> Watch
                      </button>
                    )}
                    {s.transcriptDriveId && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setActiveTranscript({
                          sessionId: s.id,
                          title: `Transcript: ${subjectName} — ${s.date}`,
                        })}
                      >
                        <FileText size={12} /> Transcript
                      </button>
                    )}
                    {s.chatDriveId && (
                      <a
                        href={streamUrl(s.id, 'chat')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-ghost"
                      >
                        <MessageSquare size={12} /> Chat
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Video player modal */}
      {activeVideo && (
        <div className="modal-overlay" onClick={() => setActiveVideo(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, padding: 0 }}>
            <div className="modal-header">
              <div className="modal-title">{activeVideo.title}</div>
              <button className="btn-icon" onClick={() => setActiveVideo(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ background: '#000', aspectRatio: '16/9' }}>
              <video
                controls
                autoPlay
                style={{ width: '100%', height: '100%' }}
                src={streamUrl(activeVideo.sessionId, 'video')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Transcript modal */}
      {activeTranscript && (
        <div className="modal-overlay" onClick={() => setActiveTranscript(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{activeTranscript.title}</div>
              <button className="btn-icon" onClick={() => setActiveTranscript(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <iframe
                src={streamUrl(activeTranscript.sessionId, 'transcript')}
                style={{ width: '100%', minHeight: 400, border: 'none', background: '#fff', borderRadius: 8 }}
                title="Transcript"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
