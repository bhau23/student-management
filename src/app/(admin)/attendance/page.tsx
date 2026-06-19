'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RawRow {
  id: string;
  sessionId: string;
  meetingCode: string;
  date: string;
  firstName: string;
  lastName: string;
  email: string;
  durationMin: number;
  joined: string;
  exited: string;
  isTutor: boolean;
}

export default function AttendancePage() {
  const [rows, setRows] = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCode, setFilterCode] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const load = async () => {
    setLoading(true);
    const constraints: any[] = [];
    if (filterDate) constraints.push(where('date', '==', filterDate));
    if (filterCode) constraints.push(where('meetingCode', '==', filterCode));
    constraints.push(orderBy('date', 'desc'), limit(200));
    const snap = await getDocs(query(collection(db, 'attendance_raw'), ...constraints));
    setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawRow)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate, filterCode]);

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Attendance Raw Log</h1>
          <div className="subtitle">Every row from every attendance XLSX, before aggregation</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="form-input" style={{ width: 200 }}
          placeholder="Filter by meeting code…"
          value={filterCode}
          onChange={(e) => setFilterCode(e.target.value)}
        />
        <input
          type="date" className="form-input" style={{ width: 160 }}
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        {(filterCode || filterDate) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterCode(''); setFilterDate(''); }}>Clear</button>
        )}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Duration</th>
                <th>Joined</th>
                <th>Exited</th>
                <th>Role</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="table-empty">No attendance rows found.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>{r.date}</td>
                  <td><span className="code">{r.meetingCode}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.firstName} {r.lastName}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.email}</td>
                  <td style={{ fontWeight: 600 }}>{r.durationMin} min</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.joined}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.exited}</td>
                  <td>
                    <span className={`badge ${r.isTutor ? 'badge-accent' : 'badge-success'}`} style={{ fontSize: 10 }}>
                      {r.isTutor ? 'Tutor' : 'Student'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{r.sessionId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
