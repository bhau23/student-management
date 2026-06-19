'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { db, auth as firebaseAuth } from '@/lib/firebase';
import {
  collection, query, where, orderBy, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import StatusBadge from '@/components/StatusBadge';
import { Video, Play, FileText, MessageSquare, X, Edit3, Save } from 'lucide-react';

interface Session {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  date: string;
  attendedMin: number;
  attendanceStatus: string;
  status: string;
  tutorNote?: string;
  recordingDriveId?: string | null;
  transcriptDriveId?: string | null;
  chatDriveId?: string | null;
}

const isDev = process.env.NODE_ENV === 'development';
const STREAM_BASE = process.env.NEXT_PUBLIC_STREAM_URL ||
  (isDev ? 'http://127.0.0.1:5001/tutrain-automation/us-central1/streamRecording'
         : 'https://streamrecording-en3s6pm6sq-uc.a.run.app');

export default function TutorClasses() {
  const { linkedId } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<{ sessionId: string; title: string } | null>(null);
  const [activeTranscript, setActiveTranscript] = useState<{ sessionId: string; title: string } | null>(null);
  const [idToken, setIdToken] = useState<string>('');
  
  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Get fresh ID token for streaming
  useEffect(() => {
    (async () => {
      if (firebaseAuth.currentUser) {
        const token = await firebaseAuth.currentUser.getIdToken(true);
        setIdToken(token);
      }
    })();
  }, []);

  // Fetch sessions
  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const snap = await getDocs(query(
        collection(db, 'class_sessions'),
        where('tutorId', '==', linkedId),
        orderBy('date', 'desc'),
      ));
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
      setLoading(false);
    })();
  }, [linkedId]);

  const streamUrl = (sessionId: string, kind: string) =>
    `${STREAM_BASE}?sessionId=${sessionId}&kind=${kind}&token=${idToken}`;

  const saveNote = async (sessionId: string) => {
    setSavingNote(true);
    try {
      await updateDoc(doc(db, `class_sessions/${sessionId}`), {
        tutorNote: draftNote,
        updatedAt: new Date().toISOString(),
      });
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, tutorNote: draftNote } : s));
      setEditingNoteId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

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
          <h1>My Classes</h1>
          <p className="subtitle">Manage your class sessions, teaching notes, and recordings</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Teaching Note</th>
              <th>Recordings</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={6} className="table-empty">No classes found</td></tr>
            ) : (
              sessions.map(s => (
                <tr key={s.id}>
                  <td>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td>{s.studentName || s.studentId}</td>
                  <td>{s.subjectName || s.subjectId}</td>
                  <td><StatusBadge status={s.attendanceStatus} /></td>
                  <td style={{ minWidth: 200 }}>
                    {editingNoteId === s.id ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          style={{ flex: 1 }}
                          value={draftNote}
                          onChange={e => setDraftNote(e.target.value)}
                          placeholder="Add note..."
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveNote(s.id);
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                        />
                        <button 
                          className="btn btn-primary btn-sm btn-icon" 
                          onClick={() => saveNote(s.id)}
                          disabled={savingNote}
                        >
                          <Save size={14} />
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm btn-icon" 
                          onClick={() => setEditingNoteId(null)}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: 4, borderRadius: 4, minHeight: 32 }}
                        className="hover-bg"
                        onClick={() => {
                          setDraftNote(s.tutorNote || '');
                          setEditingNoteId(s.id);
                        }}
                      >
                        <span className={s.tutorNote ? '' : 'text-muted'}>
                          {s.tutorNote || 'Click to add note...'}
                        </span>
                        <Edit3 size={14} className="text-muted" />
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {s.recordingDriveId && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => setActiveVideo({
                            sessionId: s.id,
                            title: `${s.subjectName || s.subjectId} — ${s.date}`,
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
                            title: `Transcript: ${s.subjectName || s.subjectId} — ${s.date}`,
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
