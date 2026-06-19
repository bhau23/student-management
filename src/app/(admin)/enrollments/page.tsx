'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getEnrollments, createEnrollment, updateEnrollment,
  deactivateEnrollment, isMeetingCodeTaken,
} from '@/lib/firestore/enrollments';
import { getStudents } from '@/lib/firestore/students';
import { getTutors } from '@/lib/firestore/tutors';
import { getSubjects } from '@/lib/firestore/subjects';
import { Enrollment, Student, Tutor, Subject } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Pencil, X, Link as LinkIcon, AlertTriangle } from 'lucide-react';

type EnrollmentForm = {
  studentId: string; subjectId: string; tutorId: string;
  meetingCode: string; scheduleDays: string[];
  scheduleTime: string; expectedDurationMin: string;
  minPresentMin: string; monthlyQuota: string;
};

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const EMPTY: EnrollmentForm = {
  studentId: '', subjectId: '', tutorId: '', meetingCode: '',
  scheduleDays: [], scheduleTime: '18:00',
  expectedDurationMin: '60', minPresentMin: '45', monthlyQuota: '12',
};

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [form, setForm] = useState<EnrollmentForm>(EMPTY);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeTaken, setCodeTaken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [e, s, t, sub] = await Promise.all([
      getEnrollments(false), getStudents(), getTutors(), getSubjects(),
    ]);
    setEnrollments(e); setStudents(s); setTutors(t); setSubjects(sub);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k: keyof EnrollmentForm, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleDay = (d: string) =>
    setField('scheduleDays', form.scheduleDays.includes(d)
      ? form.scheduleDays.filter((x) => x !== d)
      : [...form.scheduleDays, d]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setCodeTaken(false); setError(''); setModal('create'); };
  const openEdit = (e: Enrollment) => {
    setEditing(e);
    setForm({
      studentId: e.studentId, subjectId: e.subjectId, tutorId: e.tutorId,
      meetingCode: e.meetingCode, scheduleDays: e.scheduleDays, scheduleTime: e.scheduleTime,
      expectedDurationMin: String(e.expectedDurationMin), minPresentMin: String(e.minPresentMin),
      monthlyQuota: String(e.monthlyQuota),
    });
    setCodeTaken(false); setError(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditing(null); };

  // Meeting code format check
  const CODE_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

  const handleCodeBlur = async () => {
    if (!form.meetingCode || !CODE_RE.test(form.meetingCode)) return;
    if (modal === 'edit' && editing?.meetingCode === form.meetingCode) { setCodeTaken(false); return; }
    setCodeChecking(true);
    const taken = await isMeetingCodeTaken(form.meetingCode);
    setCodeTaken(taken);
    setCodeChecking(false);
  };

  const handleSave = async () => {
    if (!form.studentId || !form.subjectId || !form.tutorId) { setError('Student, subject and tutor are required.'); return; }
    if (!form.meetingCode) { setError('Meeting code is required.'); return; }
    if (!CODE_RE.test(form.meetingCode)) { setError('Meeting code must be in format: abc-defg-hij'); return; }
    if (codeTaken && !(modal === 'edit' && editing?.meetingCode === form.meetingCode)) {
      setError('Meeting code is already in use.'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        studentId: form.studentId, subjectId: form.subjectId, tutorId: form.tutorId,
        meetingCode: form.meetingCode, scheduleDays: form.scheduleDays,
        scheduleTime: form.scheduleTime, expectedDurationMin: Number(form.expectedDurationMin),
        minPresentMin: Number(form.minPresentMin), monthlyQuota: Number(form.monthlyQuota),
        active: true,
      };
      if (modal === 'create') {
        await createEnrollment(payload, user!.uid);
      } else if (editing) {
        await updateEnrollment(editing.id, payload, user!.uid, editing);
      }
      await load(); closeModal();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const getName = (arr: any[], id: string) => arr.find((x) => x.id === id)?.name ?? id;

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Enrollments</h1>
          <div className="subtitle">{enrollments.filter((e) => e.active).length} active enrollments</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="create-enrollment-btn">
          <Plus size={14} /> New Enrollment
        </button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Meeting Code</th>
                <th>Student</th>
                <th>Subject</th>
                <th>Tutor</th>
                <th>Schedule</th>
                <th>Threshold</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No enrollments yet. This is required before ingestion can work.</td></tr>
              ) : enrollments.map((e) => (
                <tr key={e.id} style={{ opacity: e.active ? 1 : 0.5 }}>
                  <td>
                    <span className="code">{e.meetingCode}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{getName(students, e.studentId)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{getName(subjects, e.subjectId)}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{getName(tutors, e.tutorId)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {e.scheduleDays.join(', ')} @ {e.scheduleTime}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    ≥{e.minPresentMin}min / {e.expectedDurationMin}min
                  </td>
                  <td><StatusBadge status={e.active ? 'active' : 'inactive'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(e)}><Pencil size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'New Enrollment' : 'Edit Enrollment'}</div>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Student <span className="required">*</span></label>
                  <select className="form-select" value={form.studentId} onChange={(e) => setField('studentId', e.target.value)}>
                    <option value="">Select student…</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject <span className="required">*</span></label>
                  <select className="form-select" value={form.subjectId} onChange={(e) => setField('subjectId', e.target.value)}>
                    <option value="">Select subject…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Tutor <span className="required">*</span></label>
                <select className="form-select" value={form.tutorId} onChange={(e) => setField('tutorId', e.target.value)}>
                  <option value="">Select tutor…</option>
                  {tutors.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <LinkIcon size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Meeting Code <span className="required">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    value={form.meetingCode}
                    onChange={(e) => { setField('meetingCode', e.target.value.toLowerCase()); setCodeTaken(false); }}
                    onBlur={handleCodeBlur}
                    placeholder="e.g. ryu-auqj-dvm"
                    style={{ borderColor: codeTaken ? 'var(--danger)' : undefined }}
                  />
                  {codeChecking && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}><span className="spinner" style={{ width: 14, height: 14 }} /></span>}
                </div>
                {codeTaken && (
                  <div className="form-error"><AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />This meeting code is already in use.</div>
                )}
                <div className="form-hint">Format: abc-defg-hij (Google Meet code). Must be globally unique.</div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Schedule Days</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {DAYS.map((d) => (
                      <button
                        key={d} type="button"
                        onClick={() => toggleDay(d)}
                        className={`badge ${form.scheduleDays.includes(d) ? 'badge-accent' : 'badge-muted'}`}
                        style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12, border: form.scheduleDays.includes(d) ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Schedule Time</label>
                  <input className="form-input" type="time" value={form.scheduleTime} onChange={(e) => setField('scheduleTime', e.target.value)} />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Expected Duration (min)</label>
                  <input className="form-input" type="number" value={form.expectedDurationMin} onChange={(e) => setField('expectedDurationMin', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Present (min)</label>
                  <input className="form-input" type="number" value={form.minPresentMin} onChange={(e) => setField('minPresentMin', e.target.value)} />
                  <div className="form-hint">Attendance flagged if below this</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Monthly Quota</label>
                  <input className="form-input" type="number" value={form.monthlyQuota} onChange={(e) => setField('monthlyQuota', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || codeTaken}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : modal === 'create' ? 'Create Enrollment' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
