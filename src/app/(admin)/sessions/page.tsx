'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  collection, query, where, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClassSession } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { Filter, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function SessionsPage() {
  const sp = useSearchParams();
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(sp.get('status') ?? '');
  const [filterFlagged, setFilterFlagged] = useState(sp.get('flagged') === '1');
  const [filterDate, setFilterDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ref = collection(db, 'class_sessions');
      const constraints: any[] = [];

      if (filterFlagged) constraints.push(where('flaggedUnderMin', '==', true));
      if (filterStatus) constraints.push(where('attendanceStatus', '==', filterStatus));
      if (filterDate) constraints.push(where('date', '==', filterDate));

      constraints.push(orderBy('date', 'desc'), limit(100));
      const snap = await getDocs(query(ref, ...constraints));
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterFlagged, filterDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Class Sessions</h1>
          <div className="subtitle">Auto-ingested from Google Meet attendance reports</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} color="var(--text-muted)" />
        <select
          className="form-select"
          style={{ width: 180 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="present">Present</option>
          <option value="pending_review">Pending Review</option>
          <option value="absent">Absent</option>
        </select>
        <input
          type="date"
          className="form-input"
          style={{ width: 160 }}
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filterFlagged}
            onChange={(e) => setFilterFlagged(e.target.checked)}
          />
          Flagged only
        </label>
        {(filterStatus || filterDate || filterFlagged) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterFlagged(false); setFilterDate(''); }}>
            Clear filters
          </button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {loading ? 'Loading…' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Date</th>
                <th>Meeting Code</th>
                <th>Attended</th>
                <th>Attendance</th>
                <th>Session</th>
                <th>Source</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No sessions found. Adjust filters or run ingestion.</td></tr>
              ) : sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{s.id}</td>
                  <td style={{ fontWeight: 500 }}>{s.date}</td>
                  <td><span className="code">{s.meetingCode}</span></td>
                  <td style={{ color: s.flaggedUnderMin ? 'var(--warning)' : 'var(--text-primary)', fontWeight: s.flaggedUnderMin ? 600 : 400 }}>
                    {s.attendedMin ?? '—'} min
                    {s.flaggedUnderMin && <span style={{ marginLeft: 4, fontSize: 10 }}>⚠</span>}
                  </td>
                  <td><StatusBadge status={s.attendanceStatus} /></td>
                  <td><StatusBadge status={s.status} size="sm" /></td>
                  <td>
                    <span className={`badge ${s.source === 'auto' ? 'badge-accent' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                      {s.source}
                    </span>
                  </td>
                  <td>
                    <Link href={`/sessions/${s.id}`} className="btn-icon" title="View detail">
                      <ExternalLink size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
