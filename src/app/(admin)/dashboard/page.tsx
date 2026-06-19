'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ClassSession } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';
import { Users, GraduationCap, AlertTriangle, CalendarCheck } from 'lucide-react';

interface DashboardStats {
  activeStudents: number;
  activeTutors: number;
  sessionsToday: number;
  pendingReviews: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ activeStudents: 0, activeTutors: 0, sessionsToday: 0, pendingReviews: 0 });
  const [recentSessions, setRecentSessions] = useState<ClassSession[]>([]);
  const [flaggedSessions, setFlaggedSessions] = useState<ClassSession[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function load() {
      try {
        const [
          studentsSnap,
          tutorsSnap,
          todaySnap,
          pendingSnap,
          recentSnap,
          flaggedSnap,
        ] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('active', '==', true))),
          getDocs(query(collection(db, 'tutors'), where('active', '==', true))),
          getDocs(query(collection(db, 'class_sessions'), where('date', '==', today))),
          getDocs(query(collection(db, 'class_sessions'), where('attendanceStatus', '==', 'pending_review'), orderBy('date', 'desc'), limit(50))),
          getDocs(query(collection(db, 'class_sessions'), orderBy('date', 'desc'), limit(10))),
          getDocs(query(collection(db, 'class_sessions'), where('flaggedUnderMin', '==', true), where('attendanceStatus', '==', 'pending_review'), orderBy('date', 'desc'), limit(8))),
        ]);

        setStats({
          activeStudents: studentsSnap.size,
          activeTutors: tutorsSnap.size,
          sessionsToday: todaySnap.size,
          pendingReviews: pendingSnap.size,
        });
        setRecentSessions(recentSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)));
        setFlaggedSessions(flaggedSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassSession)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today]);

  if (loading) {
    return <div className="loading-full"><div className="spinner" /></div>;
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="subtitle">Overview of tutoring activity — {format(new Date(), 'EEEE, MMMM d yyyy')}</div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-icon"><Users size={18} /></div>
          <div className="stat-label">Active Students</div>
          <div className="stat-value">{stats.activeStudents}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon"><GraduationCap size={18} /></div>
          <div className="stat-label">Active Tutors</div>
          <div className="stat-value">{stats.activeTutors}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon"><CalendarCheck size={18} /></div>
          <div className="stat-label">Sessions Today</div>
          <div className="stat-value">{stats.sessionsToday}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon"><AlertTriangle size={18} /></div>
          <div className="stat-label">Pending Review</div>
          <div className="stat-value">{stats.pendingReviews}</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

        {/* Recent Sessions */}
        <div className="table-wrap">
          <div className="table-toolbar">
            <div className="table-title">Recent Class Sessions</div>
            <a href="/sessions" className="btn btn-ghost btn-sm">View all →</a>
          </div>
          <table>
            <thead>
              <tr>
                <th>Meeting Code</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.length === 0 ? (
                <tr><td colSpan={4} className="table-empty">No sessions yet</td></tr>
              ) : recentSessions.map((s) => (
                <tr key={s.id}>
                  <td><span className="code">{s.meetingCode}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{s.date}</td>
                  <td style={{ color: s.flaggedUnderMin ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {s.attendedMin != null ? `${s.attendedMin} min` : '—'}
                  </td>
                  <td><StatusBadge status={s.attendanceStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Flagged Sessions Panel */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-header">
            <div>
              <div className="card-title">⚠ Flagged Sessions</div>
              <div className="card-subtitle">Under minimum attendance</div>
            </div>
            <a href="/sessions?flagged=1" className="btn btn-ghost btn-sm">See all</a>
          </div>

          {flaggedSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              ✓ No flagged sessions
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flaggedSessions.map((s) => (
                <a
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  style={{
                    display: 'block',
                    background: 'var(--warning-bg)',
                    border: '1px solid rgba(240,180,41,0.2)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="code" style={{ fontSize: 11 }}>{s.meetingCode}</span>
                    <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>
                      {s.attendedMin} min
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.date}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
