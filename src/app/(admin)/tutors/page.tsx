'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTutors, updateTutor } from '@/lib/firestore/tutors';
import { getSubjects } from '@/lib/firestore/subjects';
import { Tutor, Subject } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import StatusBadge from '@/components/StatusBadge';
import { Plus, Pencil, X, Check } from 'lucide-react';

type TutorForm = {
  name: string;
  email: string;
  subjects: string[];
  salaryModel: string;
  perClassRate: string; // rupees input
  password?: string;
};

const EMPTY_FORM: TutorForm = { name: '', email: '', subjects: [], salaryModel: '', perClassRate: '', password: '' };

export default function TutorsPage() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Tutor | null>(null);
  const [form, setForm] = useState<TutorForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [t, s] = await Promise.all([getTutors(false), getSubjects()]);
    setTutors(t);
    setSubjects(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(''); setModal('create'); };
  const openEdit = (t: Tutor) => {
    setEditing(t);
    setForm({ name: t.name, email: t.email, subjects: t.subjects, salaryModel: t.salaryModel, perClassRate: t.perClassRate ? (t.perClassRate / 100).toString() : '', password: '' });
    setError('');
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditing(null); setForm(EMPTY_FORM); };

  const setField = (k: keyof TutorForm, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleSubject = (id: string) =>
    setField('subjects', form.subjects.includes(id) ? form.subjects.filter((x) => x !== id) : [...form.subjects, id]);

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.email.trim() || !form.email.endsWith('.tutor@eqourse.com')) {
      setError('Email must end with .tutor@eqourse.com'); return;
    }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters.'); setSaving(false); return; }
        const token = await user!.getIdToken();
        const res = await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          role: 'tutor',
          collection: 'tutors',
          profile: {
            name: form.name.trim(),
            subjects: form.subjects,
            salaryModel: form.salaryModel.trim(),
            perClassRate: form.perClassRate ? Math.round(parseFloat(form.perClassRate) * 100) : 0,
          },
        }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to create tutor');
      } else if (editing) {
        await updateTutor(editing.id, { name: form.name, email: form.email, subjects: form.subjects, salaryModel: form.salaryModel, perClassRate: form.perClassRate ? Math.round(parseFloat(form.perClassRate) * 100) : 0 }, user!.uid, editing);
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = tutors.filter(
    (t) =>
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Tutors</h1>
          <div className="subtitle">{tutors.filter((t) => t.active).length} active tutors</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="create-tutor-btn">
          <Plus size={14} /> New Tutor
        </button>
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-title">All Tutors</div>
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="search-input" placeholder="Search tutors…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Subjects</th>
                <th>Per-Class Rate</th>
                <th>Status</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No tutors found.</td></tr>
              ) : filtered.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{t.email}</td>
                  <td>
                    {(t.subjects || []).map((sid) => {
                      const sub = subjects.find((s) => s.id === sid);
                      return sub ? <span key={sid} className="badge badge-accent" style={{ marginRight: 4, fontSize: 10 }}>{sub.name}</span> : null;
                    })}
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.perClassRate ? `₹${(t.perClassRate / 100).toFixed(2)}` : '—'}</td>
                  <td><StatusBadge status={t.active ? 'active' : 'inactive'} /></td>
                  <td>
                    <button className="btn-icon" title="Edit" onClick={() => openEdit(t)}><Pencil size={13} /></button>
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
              <div className="modal-title">{modal === 'create' ? 'New Tutor' : 'Edit Tutor'}</div>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input className="form-input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Tutor's full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email <span className="required">*</span></label>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)}
                    placeholder="name.tutor@eqourse.com" disabled={modal === 'edit'} />
                  {modal === 'create' && <div className="form-hint">Must end with .tutor@eqourse.com</div>}
                </div>
              </div>
              {modal === 'create' && (
                <div className="form-group">
                  <label className="form-label">Temporary Password <span className="required">*</span></label>
                  <input className="form-input" type="password" value={form.password ?? ''} onChange={(e) => setField('password', e.target.value)} placeholder="Min. 8 characters" />
                </div>
              )}
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Salary Model</label>
                  <input className="form-input" value={form.salaryModel} onChange={(e) => setField('salaryModel', e.target.value)} placeholder="e.g. Per-class / Monthly fixed…" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Per-Class Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={form.perClassRate}
                    onChange={(e) => setField('perClassRate', e.target.value)}
                    placeholder="e.g. 300"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Subjects</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {subjects.map((s) => {
                    const selected = form.subjects.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.id)}
                        className={`badge ${selected ? 'badge-accent' : 'badge-muted'}`}
                        style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 12, border: selected ? '1px solid var(--accent)' : '1px solid var(--border)' }}
                      >
                        {selected && <Check size={10} />} {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : modal === 'create' ? 'Create Tutor' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
