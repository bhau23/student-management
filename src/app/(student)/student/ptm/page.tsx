'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { PTM } from '@/lib/types';
import dayjs from 'dayjs';
import { Clock, CheckCircle, XCircle, Calendar } from 'lucide-react';

export default function StudentPTMPage() {
  const { linkedId } = useAuth();
  const studentId = linkedId;
  const [ptms, setPtms] = useState<PTM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (studentId) load(); }, [studentId]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'ptms'), where('studentId', '==', studentId), orderBy('date', 'desc')));
      setPtms(snap.docs.map(d => ({ id: d.id, ...d.data() } as PTM)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const upcoming = ptms.filter(p => p.status === 'scheduled');
  const past = ptms.filter(p => p.status !== 'scheduled');

  return (
    <div className="page-body">
      <div className="page-header">
        <div><h1>PTM</h1><div className="subtitle">Parent-Teacher Meeting schedule and history</div></div>
      </div>

      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <>
          {/* Upcoming */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No upcoming PTMs scheduled.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upcoming.map(p => (
                  <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={20} color="var(--warning)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.tutorName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{dayjs(p.date).format('dddd, MMMM D YYYY')} at {p.time}</div>
                    </div>
                    <span style={{ fontSize: 11, background: '#fef9c3', color: '#854d0e', padding: '3px 10px', borderRadius: 12, fontWeight: 600 }}>
                      <Clock size={11} style={{ marginRight: 4 }} />Scheduled
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past PTMs */}
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              History
            </h2>
            {past.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No past PTMs.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {past.map(p => (
                  <div key={p.id} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: p.summary ? 12 : 0 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.tutorName} · {dayjs(p.date).format('MMM D, YYYY')}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.time}</div>
                      </div>
                      <span style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 600,
                        background: p.status === 'completed' ? '#dcfce7' : '#fee2e2',
                        color: p.status === 'completed' ? '#166534' : '#b91c1c',
                      }}>
                        {p.status === 'completed' ? <CheckCircle size={11} style={{ marginRight: 4 }} /> : <XCircle size={11} style={{ marginRight: 4 }} />}
                        {p.status}
                      </span>
                    </div>
                    {p.summary && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>Summary</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{p.summary}</div>
                        {p.recommendations && (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10, marginBottom: 4, color: 'var(--text-secondary)' }}>Recommendations</div>
                            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{p.recommendations}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
