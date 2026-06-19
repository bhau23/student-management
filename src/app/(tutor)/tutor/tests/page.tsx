'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs, addDoc, doc,
  setDoc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { Test, TestResult, Subject } from '@/lib/types';
import { calcTestPct } from '@/lib/academicHelpers';
import dayjs from 'dayjs';
import { Plus, ClipboardList, CheckCircle } from 'lucide-react';

interface StudentOption { id: string; name: string; }

export default function TutorTestsPage() {
  const { user, linkedId } = useAuth();
  const tutorId = linkedId;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [tests, setTests] = useState<(Test & { result?: TestResult })[]>([]);
  const [loading, setLoading] = useState(true);

  // Create test form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ studentId: '', subjectId: '', title: '', type: 'unit', date: dayjs().format('YYYY-MM-DD'), maxMarks: '100' });
  const [saving, setSaving] = useState(false);

  // Enter marks modal
  const [markTest, setMarkTest] = useState<Test | null>(null);
  const [marks, setMarks] = useState('');
  const [remarks, setRemarks] = useState('');
  const [markSaving, setMarkSaving] = useState(false);

  useEffect(() => {
    if (!tutorId) return;
    loadData();
  }, [tutorId]);

  async function loadData() {
    setLoading(true);
    try {
      const [subSnap, enrSnap, testSnap] = await Promise.all([
        getDocs(collection(db, 'subjects')),
        getDocs(query(collection(db, 'enrollments'), where('tutorId', '==', tutorId), where('active', '==', true))),
        getDocs(query(collection(db, 'tests'), where('tutorId', '==', tutorId), orderBy('date', 'desc'))),
      ]);
      setSubjects(subSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));

      // Unique students from active enrollments
      const seenIds = new Set<string>();
      const stList: StudentOption[] = [];
      enrSnap.docs.forEach(d => {
        const e = d.data();
        if (!seenIds.has(e.studentId)) {
          seenIds.add(e.studentId);
          stList.push({ id: e.studentId, name: e.studentName || e.studentId });
        }
      });
      setStudents(stList);

      const testList = testSnap.docs.map(d => ({ id: d.id, ...d.data() } as Test));
      // Fetch results for all tests
      const resultIds = testList.map(t => t.id);
      const results: Record<string, TestResult> = {};
      if (resultIds.length > 0) {
        // Fetch in chunks of 10 (Firestore 'in' limit)
        for (let i = 0; i < resultIds.length; i += 10) {
          const chunk = resultIds.slice(i, i + 10);
          const rSnap = await getDocs(query(collection(db, 'test_results'), where('testId', 'in', chunk)));
          rSnap.docs.forEach(d => { const r = d.data() as TestResult; results[r.testId] = r; });
        }
      }
      setTests(testList.map(t => ({ ...t, result: results[t.id] })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const subj = subjects.find(s => s.id === form.subjectId);
      const stud = students.find(s => s.id === form.studentId);
      const tutorSnap = await getDocs(query(collection(db, 'tutors'), where('authUid', '==', user?.uid)));
      const tutorName = tutorSnap.docs[0]?.data().name || '';

      await addDoc(collection(db, 'tests'), {
        studentId: form.studentId,
        studentName: stud?.name || '',
        subjectId: form.subjectId,
        subjectName: subj?.name || '',
        tutorId,
        tutorName,
        title: form.title,
        type: form.type,
        date: form.date,
        maxMarks: parseInt(form.maxMarks),
        createdBy: user?.uid,
        createdAt: serverTimestamp(),
      });
      setShowCreate(false);
      setForm({ studentId: '', subjectId: '', title: '', type: 'unit', date: dayjs().format('YYYY-MM-DD'), maxMarks: '100' });
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function handleEnterMarks(e: React.FormEvent) {
    e.preventDefault();
    if (!markTest) return;
    setMarkSaving(true);
    try {
      const marksNum = parseInt(marks);
      const pct = calcTestPct(marksNum, markTest.maxMarks) ?? 0;
      await setDoc(doc(db, 'test_results', markTest.id), {
        id: markTest.id,
        testId: markTest.id,
        studentId: markTest.studentId,
        subjectId: markTest.subjectId,
        tutorId: markTest.tutorId,
        marks: marksNum,
        maxMarks: markTest.maxMarks,
        percentage: pct,
        remarks: remarks || null,
        gradedBy: user?.uid,
        gradedAt: serverTimestamp(),
      });
      setMarkTest(null);
      setMarks('');
      setRemarks('');
      loadData();
    } catch (err: any) { alert(err.message); }
    finally { setMarkSaving(false); }
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Tests & Assessments</h1>
          <div className="subtitle">Create tests and enter marks for your students</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Test
        </button>
      </div>

      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th><th>Student</th><th>Subject</th><th>Type</th>
                <th>Date</th><th>Max Marks</th><th>Marks</th><th>%</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No tests yet. Create your first test above.</td></tr>
              ) : tests.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{t.title}</td>
                  <td>{t.studentName}</td>
                  <td>{t.subjectName}</td>
                  <td><span className="badge badge-info">{t.type}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.date}</td>
                  <td>{t.maxMarks}</td>
                  <td>{t.result ? t.result.marks : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>
                    {t.result ? (
                      <span style={{ fontWeight: 700, color: t.result.percentage >= 60 ? 'var(--success)' : 'var(--danger)' }}>
                        {t.result.percentage}%
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setMarkTest(t); setMarks(t.result ? String(t.result.marks) : ''); setRemarks(t.result?.remarks || ''); }}
                    >
                      {t.result ? <><CheckCircle size={13} /> Update Marks</> : <><ClipboardList size={13} /> Enter Marks</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Test Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>New Test</h2></div>
            <form onSubmit={handleCreateTest}>
              <div className="form-group">
                <label>Student</label>
                <select required value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))} className="input">
                  <option value="">Select student…</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Subject</label>
                <select required value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))} className="input">
                  <option value="">Select subject…</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Title</label>
                <input required className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Unit 3 Test" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="unit">Unit</option>
                    <option value="monthly">Monthly</option>
                    <option value="mock">Mock</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" required className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Max Marks</label>
                  <input type="number" required min="1" className="input" value={form.maxMarks} onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Test'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enter Marks Modal */}
      {markTest && (
        <div className="modal-overlay" onClick={() => setMarkTest(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enter Marks — {markTest.title}</h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{markTest.studentName} · Max {markTest.maxMarks}</div>
            </div>
            <form onSubmit={handleEnterMarks}>
              <div className="form-group">
                <label>Marks (out of {markTest.maxMarks})</label>
                <input type="number" required min="0" max={markTest.maxMarks} className="input" value={marks} onChange={e => setMarks(e.target.value)} />
                {marks && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  = {calcTestPct(parseInt(marks), markTest.maxMarks)}%
                </div>}
              </div>
              <div className="form-group">
                <label>Remarks (optional)</label>
                <textarea className="input" rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Feedback for student…" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setMarkTest(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={markSaving}>{markSaving ? 'Saving…' : 'Save Marks'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
