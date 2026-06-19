'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Test, TestResult } from '@/lib/types';
import dayjs from 'dayjs';

export default function AdminTestsPage() {
  const [tests, setTests] = useState<(Test & { result?: TestResult })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [testSnap, resultSnap] = await Promise.all([
        getDocs(query(collection(db, 'tests'), orderBy('date', 'desc'))),
        getDocs(collection(db, 'test_results')),
      ]);
      const results: Record<string, TestResult> = {};
      resultSnap.docs.forEach(d => { const r = d.data() as TestResult; results[r.testId] = r; });
      setTests(testSnap.docs.map(d => ({ id: d.id, ...d.data(), result: results[d.id] } as Test & { result?: TestResult })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const filtered = tests.filter(t =>
    !search || [t.studentName, t.tutorName, t.subjectName, t.title].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="page-body">
      <div className="page-header">
        <div><h1>Tests — Overview</h1><div className="subtitle">All assessments across all tutors and students</div></div>
      </div>
      <div className="table-toolbar" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search student, tutor, subject…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} records</div>
      </div>
      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Title</th><th>Student</th><th>Tutor</th><th>Subject</th><th>Type</th><th>Date</th><th>Marks</th><th>%</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={8} className="table-empty">No tests found.</td></tr>
                : filtered.map(t => (
                  <tr key={t.id}>
                    <td className="font-medium">{t.title}</td>
                    <td>{t.studentName}</td>
                    <td>{t.tutorName}</td>
                    <td>{t.subjectName}</td>
                    <td><span className="badge badge-info">{t.type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.date}</td>
                    <td>{t.result ? `${t.result.marks}/${t.result.maxMarks}` : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}</td>
                    <td>{t.result ? (
                      <span style={{ fontWeight: 700, color: t.result.percentage >= 60 ? 'var(--success)' : 'var(--danger)' }}>{t.result.percentage}%</span>
                    ) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
