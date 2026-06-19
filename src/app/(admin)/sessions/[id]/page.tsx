'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSession } from '@/lib/firestore/sessions';
import { ClassSession } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string };
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<ClassSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'absent'>('present');
  const [overrideRemark, setOverrideRemark] = useState('');
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState('');

  useEffect(() => {
    (async () => {
      const s = await getSession(id);
      setSession(s);
      setLoading(false);
    })();
  }, [id]);

  const handleOverride = async () => {
    if (!overrideRemark.trim()) { setOverrideError('Please provide a remark for this override.'); return; }
    setOverrideSaving(true); setOverrideError('');
    try {
      const token = await auth.currentUser!.getIdToken();
      const res = await fetch(`/api/sessions/${id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ attendanceStatus: overrideStatus, adminRemark: overrideRemark }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const updated = await getSession(id);
      setSession(updated);
      setOverrideModal(false);
    } catch (e: any) {
      setOverrideError(e.message);
    } finally {
      setOverrideSaving(false);
    }
  };

  if (loading) return <div className="loading-full"><div className="spinner" /></div>;
  if (!session) return (
    <div className="page-body">
      <Link href="/sessions" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
        <ArrowLeft size={13} /> Back
      </Link>
      <div className="alert alert-danger">Session not found.</div>
    </div>
  );

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{value ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</div>
    </div>
  );

  return (
    <div className="page-body">
      <Link href="/sessions" className="btn btn-ghost btn-sm" style={{ marginBottom: 20, display: 'inline-flex' }}>
        <ArrowLeft size={13} /> Back to Sessions
      </Link>

      <div className="page-header">
        <div>
          <h1>Session: <span className="code" style={{ fontSize: 18 }}>{session.meetingCode}_{session.date}</span></h1>
          <div className="subtitle">Class session detail & admin override</div>
        </div>
        {isAdmin && session.flaggedUnderMin && (
          <button className="btn btn-primary" onClick={() => setOverrideModal(true)}>
            <ShieldCheck size={14} /> Override Attendance
          </button>
        )}
      </div>

      {session.flaggedUnderMin && session.attendanceStatus === 'pending_review' && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          ⚠ This session is flagged: student attended {session.attendedMin} min, below the minimum of {session.attendedMin} min. Admin review required.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Attendance Info */}
        <div className="card">
          <div className="card-header"><div className="card-title">Attendance</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <Field label="Date" value={session.date} />
            <Field label="Status" value={<StatusBadge status={session.attendanceStatus} />} />
            <Field label="Attended (min)" value={<span style={{ fontWeight: 700, fontSize: 20, color: session.flaggedUnderMin ? 'var(--warning)' : 'var(--success)' }}>{session.attendedMin}</span>} />
            <Field label="Session Status" value={<StatusBadge status={session.status} />} />
            <Field label="Actual Start" value={session.actualStart} />
            <Field label="Actual End" value={session.actualEnd} />
            {session.adminOverrideBy && <Field label="Overridden By" value={session.adminOverrideBy} />}
            {session.adminRemark && <Field label="Admin Remark" value={session.adminRemark} />}
          </div>
        </div>

        {/* Session Info */}
        <div className="card">
          <div className="card-header"><div className="card-title">Session Details</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <Field label="Meeting Code" value={<span className="code">{session.meetingCode}</span>} />
            <Field label="Source" value={<span className={`badge ${session.source === 'auto' ? 'badge-accent' : 'badge-muted'}`} style={{ fontSize: 11 }}>{session.source}</span>} />
            <Field label="Enrollment ID" value={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>{session.enrollmentId}</span>} />
            <Field label="Student ID" value={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>{session.studentId}</span>} />
            <Field label="Tutor ID" value={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>{session.tutorId}</span>} />
            <Field label="Subject ID" value={<span style={{ fontSize: 11, fontFamily: 'monospace' }}>{session.subjectId}</span>} />
          </div>
        </div>

        {/* Recordings */}
        {(session.recordingDriveId || session.transcriptDriveId || session.chatDriveId) && (
          <div className="card">
            <div className="card-header"><div className="card-title">Recordings & Files</div></div>
            {session.recordingDriveId && (
              <a href={`https://drive.google.com/file/d/${session.recordingDriveId}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginRight: 8 }}>
                <ExternalLink size={12} /> Recording
              </a>
            )}
            {session.transcriptDriveId && (
              <a href={`https://drive.google.com/file/d/${session.transcriptDriveId}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginRight: 8 }}>
                <ExternalLink size={12} /> Transcript
              </a>
            )}
            {session.chatDriveId && (
              <a href={`https://drive.google.com/file/d/${session.chatDriveId}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                <ExternalLink size={12} /> Chat Log
              </a>
            )}
          </div>
        )}
      </div>

      {/* Override Modal */}
      {overrideModal && (
        <div className="modal-overlay" onClick={() => setOverrideModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Override Attendance</div>
              <button className="btn-icon" onClick={() => setOverrideModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {overrideError && <div className="alert alert-danger">{overrideError}</div>}
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                Current: Student attended <strong>{session.attendedMin} min</strong>. Override will clear the flag.
              </div>
              <div className="form-group">
                <label className="form-label">New Attendance Status <span className="required">*</span></label>
                <select className="form-select" value={overrideStatus} onChange={(e) => setOverrideStatus(e.target.value as 'present' | 'absent')}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Remark <span className="required">*</span></label>
                <textarea
                  className="form-textarea"
                  value={overrideRemark}
                  onChange={(e) => setOverrideRemark(e.target.value)}
                  placeholder="Explain why you're overriding (e.g. connectivity issue, device restart…)"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOverrideModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleOverride} disabled={overrideSaving}>
                {overrideSaving ? 'Saving…' : 'Confirm Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
