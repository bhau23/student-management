'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSubjects, createSubject, updateSubject, deleteSubject } from '@/lib/firestore/subjects';
import { Subject } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getSubjects();
    setSubjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setNameValue(''); setError(''); setModal('create'); };
  const openEdit = (s: Subject) => { setEditing(s); setNameValue(s.name); setError(''); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditing(null); setNameValue(''); };

  const handleSave = async () => {
    if (!nameValue.trim()) { setError('Subject name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal === 'create') {
        await createSubject(nameValue.trim(), user!.uid);
      } else if (editing) {
        await updateSubject(editing.id, nameValue.trim(), user!.uid);
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this subject? This cannot be undone.')) return;
    await deleteSubject(id, user!.uid);
    await load();
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Subjects</h1>
          <div className="subtitle">{subjects.length} subject{subjects.length !== 1 ? 's' : ''} configured</div>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="create-subject-btn">
          <Plus size={14} /> New Subject
        </button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr><td colSpan={3} className="table-empty">No subjects yet. Add one to get started.</td></tr>
              ) : subjects.map((s, i) => (
                <tr key={s.id}>
                  <td style={{ color: 'var(--text-muted)', width: 48 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-icon" title="Delete" onClick={() => handleDelete(s.id)}
                        style={{ color: 'var(--danger)', borderColor: 'rgba(248,81,73,0.3)' }}>
                        <Trash2 size={13} />
                      </button>
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{modal === 'create' ? 'New Subject' : 'Edit Subject'}</div>
              <button className="btn-icon" onClick={closeModal}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="subject-name">
                  Subject Name <span className="required">*</span>
                </label>
                <input
                  id="subject-name"
                  type="text"
                  className="form-input"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="e.g. Mathematics, Physics…"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : 'Save Subject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
