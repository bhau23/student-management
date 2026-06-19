'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc,
  doc, updateDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { PTM } from '@/lib/types';
import dayjs from 'dayjs';
import { Plus, CheckCircle, Clock, XCircle } from 'lucide-react';

interface StudentOption { id: string; name: string; }

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'var(--warning)',
  completed: 'var(--success)',
  cancelled: 'var(--danger)',
};

export default function TutorPTMPage() {
  const { user, linkedId } = useAuth();
  const tutorId = linkedId;

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [ptms, setPtms] = useState<PTM[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ studentId: '', date: dayjs().format('YYYY-MM-DD'), time: '17:00' });
  const [saving, setSaving] = useState(false);

  const [completeModal, setCompleteModal] = useState<PTM | null>(null);
  const [summary, setSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => { if (tutorId) loadData(); }, [tutorId]);

  async function loadData() {
    setLoading(true);
    try {
      const [enrSnap, ptmSnap] = await Promise.all([
        getDocs(query(collection(db, 'enrollments'), where('tutorId', '==', tutorId), where('active', '==', true))),
        getDocs(query(collection(db, 'ptms'), where('tutorId', '==', tutorId), orderBy('date', 'desc'))),
      ]);
      const seenIds = new Set<string>();
      const stList: StudentOption[] = [];
      enrSnap.docs.forEach(d => {
        const e = d.data();
        if (!seenIds.has(e.studentId)) { seenIds.add(e.studentId); stList.push({ id: e.studentId, name: e.studentName || e.studentId }); }
      });
      setStudents(stList);
      setPtms(ptmSnap.docs.map(d => ({ id: d.id, ...d.data() } as PTM)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const stud = students.find(s => s.id === form.studentId);
      const tutorSnap = await getDocs(query(collection(db, 'tutors'), where('authUid', '==', user?.uid)));
      const tutorName = tutorSnap.docs[0]?.data().name || '';
      await addDoc(collection(db, 'ptms'), {
        studentId: form.studentId, studentName: stud?.name || '',
        tutorId, tutorName,
        date: form.date, time: form.time,
        status: 'scheduled',
        createdBy: user?.uid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setShowCreate(false);
      setForm({ studentId: '', date: dayjs().format('YYYY-MM-DD'), time: '17:00' });
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();
    if (!completeModal) return;
    setCompleting(true);
    try {
      await updateDoc(doc(db, 'ptms', completeModal.id), {
        status: 'completed', summary, recommendations,
        updatedAt: serverTimestamp(),
      });
      setCompleteModal(null); setSummary(''); setRecommendations('');
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setCompleting(false); }
  }

  async function handleCancel(ptmId: string) {
    if (!confirm('Cancel this PTM?')) return;
    await updateDoc(doc(db, 'ptms', ptmId), { status: 'cancelled', updatedAt: serverTimestamp() });
    loadData();
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div><h1>PTM</h1><div className="subtitle">Schedule and track parent-teacher meetings</div></div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Schedule PTM</button>
      </div>

      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Date</th><th>Time</th><th>Status</th><th>Summary</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {ptms.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No PTMs scheduled yet.</td></tr>
              ) : ptms.map(p => (
                <tr key={p.id}>
                  <td className="font-medium">{p.studentName}</td>
                  <td>{p.date}</td>
                  <td>{p.time}</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[p.status], fontWeight: 600, textTransform: 'capitalize' }}>
                      {p.status === 'scheduled' && <Clock size={12} style={{ marginRight: 4 }} />}
                      {p.status === 'completed' && <CheckCircle size={12} style={{ marginRight: 4 }} />}
                      {p.status === 'cancelled' && <XCircle size={12} style={{ marginRight: 4 }} />}
                      {p.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 13 }}>
                    {p.summary || '—'}
                  </td>
                  <td>
                    {p.status === 'scheduled' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setCompleteModal(p); setSummary(p.summary || ''); setRecommendations(p.recommendations || ''); }}>
                          Complete
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleCancel(p.id)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule PTM Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>Schedule PTM</h2></div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Student</label>
                <select required className="input" value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}>
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" required className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Time</label>
                  <input type="time" required className="input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete PTM Modal */}
      {completeModal && (
        <div className="modal-overlay" onClick={() => setCompleteModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complete PTM</h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{completeModal.studentName} · {completeModal.date}</div>
            </div>
            <form onSubmit={handleComplete}>
              <div className="form-group">
                <label>Meeting Summary</label>
                <textarea required className="input" rows={4} value={summary} onChange={e => setSummary(e.target.value)} placeholder="What was discussed…" />
              </div>
              <div className="form-group">
                <label>Recommendations</label>
                <textarea className="input" rows={3} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Next steps for student / parent…" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setCompleteModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={completing}>{completing ? 'Saving…' : 'Mark Completed'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
