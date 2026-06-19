'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import StatusBadge from '@/components/StatusBadge';

interface Session {
  id: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  date: string;
  attendedMin: number;
  attendanceStatus: string;
  status: string;
}

export default function StudentAttendance() {
  const { linkedId } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('all');

  // Fetch all sessions for this student
  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const snap = await getDocs(query(
        collection(db, 'class_sessions'),
        where('studentId', '==', linkedId),
        orderBy('date', 'desc'),
      ));
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
      setLoading(false);
    })();
  }, [linkedId]);

  // Unique subjects for filter
  const subjectIds = useMemo(() => {
    const ids = new Set(sessions.map(s => s.subjectId));
    return Array.from(ids);
  }, [sessions]);

  // Filtered sessions
  const filtered = useMemo(() => {
    if (filterSubject === 'all') return sessions;
    return sessions.filter(s => s.subjectId === filterSubject);
  }, [sessions, filterSubject]);

  // Summary stats
  const stats = useMemo(() => {
    const conducted = filtered.filter(s => s.status === 'conducted');
    const present = conducted.filter(s => s.attendanceStatus === 'present').length;
    const absent = conducted.filter(s => s.attendanceStatus === 'absent').length;
    const underReview = conducted.filter(s => s.attendanceStatus === 'pending_review').length;
    const denominator = present + absent;
    const pct = denominator > 0 ? Math.round((present / denominator) * 100) : 100;
    return { total: conducted.length, present, absent, underReview, pct };
  }, [filtered]);

  if (loading) {
    return (
      <div className="page-body">
        <div className="loading-full"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Attendance History</h1>
          <p className="subtitle">Your complete class attendance record</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="attendance-summary-strip">
        <div className="att-summary-item">
          <span className="att-summary-label">Total</span>
          <span className="att-summary-value">{stats.total}</span>
        </div>
        <div className="att-summary-divider" />
        <div className="att-summary-item">
          <span className="att-summary-label">Present</span>
          <span className="att-summary-value text-success">{stats.present}</span>
        </div>
        <div className="att-summary-divider" />
        <div className="att-summary-item">
          <span className="att-summary-label">Absent</span>
          <span className="att-summary-value text-danger">{stats.absent}</span>
        </div>
        <div className="att-summary-divider" />
        <div className="att-summary-item">
          <span className="att-summary-label">Under Review</span>
          <span className="att-summary-value text-warning">{stats.underReview}</span>
        </div>
        <div className="att-summary-divider" />
        <div className="att-summary-item">
          <span className="att-summary-label">Attendance %</span>
          <span className="att-summary-value">{stats.pct}%</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-title">All Sessions ({filtered.length})</div>
          <div className="table-actions">
            <select
              className="form-select"
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              style={{ width: 180 }}
            >
              <option value="all">All Subjects</option>
              {subjectIds.map(id => {
                const s = sessions.find(x => x.subjectId === id);
                return (
                  <option key={id} value={id}>{s?.subjectName || id}</option>
                );
              })}
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Subject</th>
              <th>Tutor</th>
              <th>Attended</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No sessions found</td></tr>
            ) : (
              filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td>{s.subjectName || s.subjectId}</td>
                  <td>{s.tutorName || s.tutorId}</td>
                  <td>
                    <span className="font-mono">{s.attendedMin}</span>
                    <span className="text-muted"> min</span>
                  </td>
                  <td><StatusBadge status={s.attendanceStatus} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
