'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, getDocs, addDoc, doc, updateDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { Lead, LeadStage, LeadSource } from '@/lib/types';
import dayjs from 'dayjs';
import { Plus, MessageSquare, Check, X, Phone, User, MoveRight } from 'lucide-react';
import Link from 'next/link';
import InfoGuide from '@/components/InfoGuide';

const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'var(--primary)' },
  { id: 'contacted', label: 'Contacted', color: 'var(--info)' },
  { id: 'demo_scheduled', label: 'Demo Scheduled', color: 'var(--warning)' },
  { id: 'demo_done', label: 'Demo Done', color: '#8b5cf6' },
  { id: 'converted', label: 'Converted', color: 'var(--success)' },
  { id: 'lost', label: 'Lost', color: 'var(--danger)' },
];

export default function LeadCRMPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showConvert, setShowConvert] = useState<Lead | null>(null);

  // Forms
  const [form, setForm] = useState({ name: '', contact: '', source: 'referral' as LeadSource, value: '' });
  const [saving, setSaving] = useState(false);

  // Note form
  const [noteText, setNoteText] = useState('');

  // Convert form
  const [convertForm, setConvertForm] = useState({
    name: '', email: '',
    parentName: '', parentEmail: '', parentPhone: '',
    dob: '', grade: '', school: '', address: '', admissionDate: dayjs().format('YYYY-MM-DD'),
  });
  const [converting, setConverting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'leads'), orderBy('updatedAt', 'desc')));
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addDoc(collection(db, 'leads'), {
        name: form.name,
        contact: form.contact,
        source: form.source,
        stage: 'new',
        assignedTo: user?.uid,
        value: form.value ? parseInt(form.value) * 100 : 0, // save in paise
        notes: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowAdd(false);
      setForm({ name: '', contact: '', source: 'referral', value: '' });
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function updateStage(leadId: string, newStage: LeadStage) {
    if (newStage === 'converted') {
      const l = leads.find(x => x.id === leadId);
      if (l) {
        setConvertForm(f => ({ ...f, name: l.name, parentPhone: l.contact }));
        setShowConvert(l);
      }
      return;
    }
    try {
      await updateDoc(doc(db, 'leads', leadId), { stage: newStage, updatedAt: serverTimestamp() });
      loadData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLead || !noteText.trim()) return;
    try {
      const newNote = { text: noteText, by: user?.uid || 'Unknown', at: new Date().toISOString() };
      const updatedNotes = [...(selectedLead.notes || []), newNote];
      await updateDoc(doc(db, 'leads', selectedLead.id), { notes: updatedNotes, updatedAt: serverTimestamp() });
      setNoteText('');
      setSelectedLead({ ...selectedLead, notes: updatedNotes });
      loadData();
    } catch (err: any) { alert(err.message); }
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!showConvert) return;
    setConverting(true);
    try {
      // 1. Create student
      const stRef = await addDoc(collection(db, 'students'), {
        name: convertForm.name,
        email: convertForm.email,
        parentName: convertForm.parentName,
        parentEmail: convertForm.parentEmail,
        parentPhone: convertForm.parentPhone,
        dob: convertForm.dob,
        grade: convertForm.grade,
        school: convertForm.school,
        address: convertForm.address,
        admissionDate: convertForm.admissionDate,
        active: true,
        tutorIds: [],
        authUid: null,
      });

      // 2. Update lead
      await updateDoc(doc(db, 'leads', showConvert.id), {
        stage: 'converted',
        convertedStudentId: stRef.id,
        updatedAt: serverTimestamp(),
      });
      
      setShowConvert(null);
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setConverting(false); }
  }

  // Group leads by stage
  const board: Record<LeadStage, Lead[]> = { new: [], contacted: [], demo_scheduled: [], demo_done: [], converted: [], lost: [] };
  leads.forEach(l => { if (board[l.stage]) board[l.stage].push(l); });

  return (
    <div className="page-body" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1>
            Lead CRM
            <InfoGuide title="CRM Guide">
              <p style={{ marginBottom: 12 }}>The Customer Relationship Manager tracks prospective student inquiries.</p>
              <ul style={{ paddingLeft: 20, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong>Pipeline:</strong> Leads start as "New". As you contact them or offer a trial class, change their status to move them across the board.</li>
                <li><strong>Conversion:</strong> Moving a lead to "Converted" means they have enrolled. You must separately create a Student record for them.</li>
                <li><strong>Expected Value:</strong> The estimated fee revenue this lead could bring. This is summarized in the Command Center metrics.</li>
              </ul>
            </InfoGuide>
          </h1>
          <div className="subtitle">Track inquiries to enrollment</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> New Lead</button>
      </div>

      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <div style={{ flex: 1, overflowX: 'auto', paddingBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, height: '100%', minWidth: 'min-content' }}>
            {STAGES.map(s => (
              <div key={s.id} style={{ width: 300, background: 'var(--surface-alt)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: s.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                    {s.label}
                  </div>
                  <span style={{ fontSize: 12, background: 'var(--surface)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
                    {board[s.id].length}
                  </span>
                </div>
                
                <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
                  {board[s.id].map(l => (
                    <div key={l.id} className="card" style={{ padding: 12, cursor: 'pointer', borderLeft: `3px solid ${s.color}` }} onClick={() => setSelectedLead(l)}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <Phone size={11} /> {l.contact || 'No contact'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-info" style={{ fontSize: 10 }}>{l.source}</span>
                        {l.value ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--success)' }}>₹{l.value / 100}</span> : null}
                      </div>

                      {/* Stage quick actions */}
                      {l.stage !== 'converted' && l.stage !== 'lost' && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                          <select 
                            className="input" 
                            style={{ padding: '2px 8px', fontSize: 11, height: 26, flex: 1 }}
                            value={l.stage}
                            onChange={(e) => updateStage(l.id, e.target.value as LeadStage)}
                          >
                            {STAGES.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
                          </select>
                        </div>
                      )}
                      {l.stage === 'converted' && l.convertedStudentId && (
                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                          <Link href="/students" className="btn btn-ghost btn-sm" style={{ width: '100%', fontSize: 11 }}>View Student →</Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>New Lead</h2></div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Name</label>
                <input required className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Contact (Phone/Email)</label>
                <input required className="input" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Source</label>
                  <select className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as LeadSource }))}>
                    <option value="referral">Referral</option>
                    <option value="website">Website</option>
                    <option value="ad">Advertisement</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Expected Value (₹/mo)</label>
                  <input type="number" min="0" className="input" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 5000" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert to Student Modal */}
      {showConvert && (
        <div className="modal-overlay" onClick={() => setShowConvert(null)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Convert to Student</h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Creating profile for {showConvert.name}</div>
            </div>
            <form onSubmit={handleConvert}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label>Student Name</label><input required className="input" value={convertForm.name} onChange={e => setConvertForm(f => ({...f, name: e.target.value}))} /></div>
                <div className="form-group"><label>Student Email</label><input type="email" className="input" value={convertForm.email} onChange={e => setConvertForm(f => ({...f, email: e.target.value}))} /></div>
                
                <div className="form-group"><label>Parent Name</label><input required className="input" value={convertForm.parentName} onChange={e => setConvertForm(f => ({...f, parentName: e.target.value}))} /></div>
                <div className="form-group"><label>Parent Phone</label><input required className="input" value={convertForm.parentPhone} onChange={e => setConvertForm(f => ({...f, parentPhone: e.target.value}))} /></div>
                
                <div className="form-group"><label>Parent Email</label><input type="email" required className="input" value={convertForm.parentEmail} onChange={e => setConvertForm(f => ({...f, parentEmail: e.target.value}))} /></div>
                <div className="form-group"><label>Admission Date</label><input type="date" required className="input" value={convertForm.admissionDate} onChange={e => setConvertForm(f => ({...f, admissionDate: e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowConvert(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--success)' }} disabled={converting}>
                  {converting ? 'Converting…' : 'Complete Conversion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer */}
      {selectedLead && (
        <div className="modal-overlay" style={{ justifyContent: 'flex-end', padding: 0 }} onClick={() => setSelectedLead(null)}>
          <div className="modal" style={{ height: '100%', margin: 0, borderRadius: 0, width: 400, maxWidth: '100%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 20 }}>{selectedLead.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {STAGES.find(s => s.id === selectedLead.stage)?.label} · {selectedLead.source}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(null)}><X size={18} /></button>
            </div>
            
            <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
              <div className="form-group">
                <label>Contact Info</label>
                <div style={{ fontSize: 14, background: 'var(--surface-alt)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {selectedLead.contact}
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 20 }}>
                <label>Notes & History</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedLead.notes?.map((n, i) => (
                    <div key={i} style={{ background: 'var(--surface-alt)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 13 }}>{n.text}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 6 }}>
                        <span>{dayjs(n.at).format('MMM D, h:mm A')}</span>
                      </div>
                    </div>
                  ))}
                  {(!selectedLead.notes || selectedLead.notes.length === 0) && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No notes yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Add note input fixed at bottom */}
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: 8 }}>
                <input 
                  className="input" 
                  placeholder="Add a note..." 
                  value={noteText} 
                  onChange={e => setNoteText(e.target.value)} 
                  style={{ flex: 1 }} 
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!noteText.trim()}>Post</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
