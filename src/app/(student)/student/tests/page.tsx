'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Test, TestResult } from '@/lib/types';
import dayjs from 'dayjs';

export default function StudentTestsPage() {
  const { linkedId } = useAuth();
  const studentId = linkedId;

  const [tests, setTests] = useState<(Test & { result?: TestResult })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (studentId) loadData(); }, [studentId]);

  async function loadData() {
    setLoading(true);
    try {
      const testSnap = await getDocs(query(collection(db, 'tests'), where('studentId', '==', studentId), orderBy('date', 'desc')));
      const testList = testSnap.docs.map(d => ({ id: d.id, ...d.data() } as Test));

      const results: Record<string, TestResult> = {};
      for (let i = 0; i < testList.length; i += 10) {
        const chunk = testList.slice(i, i + 10).map(t => t.id);
        const rSnap = await getDocs(query(collection(db, 'test_results'), where('testId', 'in', chunk)));
        rSnap.docs.forEach(d => { const r = d.data() as TestResult; results[r.testId] = r; });
      }
      setTests(testList.map(t => ({ ...t, result: results[t.id] })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Group by subject for trend view
  const bySubject: Record<string, (Test & { result?: TestResult })[]> = {};
  tests.forEach(t => {
    const k = t.subjectName || t.subjectId;
    if (!bySubject[k]) bySubject[k] = [];
    bySubject[k].push(t);
  });

  return (
    <div className="page-body">
      <div className="page-header">
        <div><h1>My Tests</h1><div className="subtitle">Assessments and performance</div></div>
      </div>

      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <>
          {tests.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              No tests recorded yet.
            </div>
          ) : (
            <>
              {/* Subject-wise trend cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
                {Object.entries(bySubject).map(([subj, ts]) => {
                  const graded = ts.filter(t => t.result);
                  const avg = graded.length > 0 ? Math.round(graded.reduce((a, t) => a + (t.result?.percentage || 0), 0) / graded.length) : null;
                  return (
                    <div key={subj} className="card">
                      <div className="card-header">
                        <div className="card-title">{subj}</div>
                        {avg !== null && (
                          <span style={{ fontSize: 22, fontWeight: 800, color: avg >= 60 ? 'var(--success)' : 'var(--danger)' }}>{avg}%</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {ts.map(t => (
                          <div key={t.id} style={{
                            padding: '6px 10px', borderRadius: 8,
                            background: t.result ? (t.result.percentage >= 60 ? '#dcfce7' : '#fee2e2') : 'var(--surface-alt)',
                            border: '1px solid var(--border)', fontSize: 12,
                          }}>
                            <div style={{ fontWeight: 600 }}>{t.title}</div>
                            <div style={{ color: 'var(--text-muted)' }}>{dayjs(t.date).format('MMM D')}</div>
                            {t.result ? (
                              <div style={{ fontWeight: 700, color: t.result.percentage >= 60 ? '#166534' : '#b91c1c' }}>
                                {t.result.marks}/{t.result.maxMarks} ({t.result.percentage}%)
                              </div>
                            ) : <div style={{ color: 'var(--text-muted)' }}>Pending</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full list */}
              <div className="table-wrap">
                <div className="table-toolbar"><div className="table-title">All Tests</div></div>
                <table>
                  <thead>
                    <tr><th>Title</th><th>Subject</th><th>Type</th><th>Date</th><th>Marks</th><th>%</th><th>Remarks</th></tr>
                  </thead>
                  <tbody>
                    {tests.map(t => (
                      <tr key={t.id}>
                        <td className="font-medium">{t.title}</td>
                        <td>{t.subjectName}</td>
                        <td><span className="badge badge-info">{t.type}</span></td>
                        <td style={{ color: 'var(--text-secondary)' }}>{t.date}</td>
                        <td>{t.result ? `${t.result.marks}/${t.result.maxMarks}` : '—'}</td>
                        <td>
                          {t.result ? (
                            <span style={{ fontWeight: 700, color: t.result.percentage >= 60 ? 'var(--success)' : 'var(--danger)' }}>
                              {t.result.percentage}%
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.result?.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
