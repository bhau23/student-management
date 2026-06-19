'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStudents, updateStudent, deactivateStudent } from '@/lib/firestore/students';
import { Student } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Pencil, X, UserX } from 'lucide-react';

type StudentForm = {
  name: string; grade: string; board: string;
  parentName: string; parentContact: string; contact: string;
  admissionDate: string; status: Student['status'];
  monthlyFee: string; feeDueDay: string;
  password?: string;
};

const EMPTY: StudentForm = {
  name: '', grade: '', board: '', parentName: '', parentContact: '',
  contact: '', admissionDate: new Date().toISOString().split('T')[0],
  status: 'trial', monthlyFee: '0', feeDueDay: '5', password: '',
};

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getStudents(false);
    setStudents(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setField = (k: keyof StudentForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setModal('create'); };
  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({ name: s.name, grade: s.grade, board: s.board, parentName: s.parentName,
      parentContact: s.parentContact, contact: s.contact, admissionDate: s.admissionDate,
      status: s.status, monthlyFee: String(s.monthlyFee), feeDueDay: String(s.feeDueDay) });
    setError(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditing(null); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        if (!form.password || form.password.length < 8) { setError('Password min 8 chars.'); setSaving(false); return; }
        const token = await user!.getIdToken();
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: form.contact, password: form.password, role: 'student',
            collection: 'students',
            profile: {
              name: form.name, grade: form.grade, board: form.board,
              parentName: form.parentName, parentContact: form.parentContact,
              contact: form.contact, admissionDate: form.admissionDate,
              status: form.status, monthlyFee: Number(form.monthlyFee),
              feeDueDay: Number(form.feeDueDay),
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else if (editing) {
        await updateStudent(editing.id, {
          name: form.name, grade: form.grade, board: form.board,
          parentName: form.parentName, parentContact: form.parentContact,
          contact: form.contact, admissionDate: form.admissionDate,
          status: form.status, monthlyFee: Number(form.monthlyFee),
          feeDueDay: Number(form.feeDueDay),
        }, user!.uid, editing);
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this student?')) return;
    await deactivateStudent(id, user!.uid);
    await load();
  };

  const filtered = students.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <div className="subtitle">{students.filter((s) => s.active).length} active, {students.length} total</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="create-student-btn">
          <Plus size={14} /> New Student
        </button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-title">All Students</div>
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="search-input" placeholder="Search students…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Grade / Board</th>
                <th>Parent</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Fee</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-empty">No students found.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                  <td><span style={{ fontWeight: 500 }}>{s.name}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.grade} · {s.board}</td>
                  <td>
                    <div style={{ fontWeight: 500, fontSize: 12 }}>{s.parentName}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.parentContact}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{s.contact}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td style={{ color: 'var(--text-secondary)' }}>₹{s.monthlyFee?.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}><Pencil size={13} /></button>
                      {s.active && (
                        <button className="btn-icon" title="Deactivate" onClick={() => handleDeactivate(s.id)}
                          style={{ color: 'var(--danger)', borderColor: 'rgba(248,81,73,0.3)' }}>
                          <UserX size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'New Student' : 'Edit Student'}</div>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input className="form-input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Student's full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    <option value="trial">Trial</option>
                    <option value="active">Active</option>
                    <option value="converted">Converted</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Grade</label>
                  <input className="form-input" value={form.grade} onChange={(e) => setField('grade', e.target.value)} placeholder="e.g. Class 10" />
                </div>
                <div className="form-group">
                  <label className="form-label">Board</label>
                  <input className="form-input" value={form.board} onChange={(e) => setField('board', e.target.value)} placeholder="e.g. CBSE, ICSE" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Parent Name</label>
                  <input className="form-input" value={form.parentName} onChange={(e) => setField('parentName', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Parent Contact</label>
                  <input className="form-input" value={form.parentContact} onChange={(e) => setField('parentContact', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Login Email (Student/Parent) <span className="required">*</span></label>
                  <input className="form-input" type="email" value={form.contact} onChange={(e) => setField('contact', e.target.value)} placeholder="shared login email" disabled={modal === 'edit'} />
                  {modal === 'create' && <div className="form-hint">Shared login for student and parent</div>}
                </div>
                {modal === 'create' && (
                  <div className="form-group">
                    <label className="form-label">Temp Password <span className="required">*</span></label>
                    <input className="form-input" type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} placeholder="Min. 8 characters" />
                  </div>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Monthly Fee (₹)</label>
                  <input className="form-input" type="number" value={form.monthlyFee} onChange={(e) => setField('monthlyFee', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fee Due Day</label>
                  <input className="form-input" type="number" min={1} max={28} value={form.feeDueDay} onChange={(e) => setField('feeDueDay', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Admission Date</label>
                <input className="form-input" type="date" value={form.admissionDate} onChange={(e) => setField('admissionDate', e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : modal === 'create' ? 'Create Student' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
