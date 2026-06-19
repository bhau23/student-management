'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import StatusBadge from '@/components/StatusBadge';
import {
  BookOpen, CalendarDays, BarChart3, Clock, ExternalLink,
} from 'lucide-react';

interface Enrollment {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  meetingCode: string;
  scheduleDays: string[];
  scheduleTime: string;
  active: boolean;
}

interface Session {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  date: string;
  attendedMin: number;
  attendanceStatus: string;
  status: string;
}

function todayWeekday(): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function TutorOverview() {
  const { linkedId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch enrollments + this month's sessions
  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const [enrSnap, sessSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'enrollments'),
          where('tutorId', '==', linkedId),
          where('active', '==', true),
        )),
        getDocs(query(
          collection(db, 'class_sessions'),
          where('tutorId', '==', linkedId),
          where('date', '>=', firstOfMonth()),
          orderBy('date', 'desc'),
        )),
      ]);

      setEnrollments(enrSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
      setLoading(false);
    })();
  }, [linkedId]);

  // Compute KPIs
  const kpis = useMemo(() => {
    const assignedStudents = new Set(enrollments.map(e => e.studentId)).size;
    const conducted = sessions.filter(s => s.status === 'conducted');
    const present = conducted.filter(s => s.attendanceStatus === 'present').length;
    const absent = conducted.filter(s => s.attendanceStatus === 'absent').length;
    const denominator = present + absent; // exclude pending_review
    const pct = denominator > 0 ? Math.round((present / denominator) * 100) : 100;
    
    return {
      assignedStudents,
      classesThisMonth: conducted.length,
      attendancePct: pct,
    };
  }, [enrollments, sessions]);

  // Today's classes
  const todayClasses = useMemo(() => {
    const day = todayWeekday();
    return enrollments.filter(e => e.scheduleDays?.includes(day));
  }, [enrollments]);

  // Recent 5 sessions
  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  if (loading) {
    return (
      <div className="page-body">
        <div className="loading-full"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Tutor Dashboard 👋</h1>
          <p className="subtitle">Here&apos;s your teaching overview for this month</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-icon"><BookOpen size={18} /></div>
          <div className="stat-label">Assigned Students</div>
          <div className="stat-value">{kpis.assignedStudents}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon"><CalendarDays size={18} /></div>
          <div className="stat-label">Classes This Month</div>
          <div className="stat-value">{kpis.classesThisMonth}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon"><BarChart3 size={18} /></div>
          <div className="stat-label">Student Attendance</div>
          <div className="stat-value">{kpis.attendancePct}%</div>
        </div>
      </div>

      {/* Today's Classes */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Today&apos;s Classes</div>
            <div className="card-subtitle">{todayWeekday()}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        {todayClasses.length === 0 ? (
          <div className="table-empty">No classes scheduled for today 🎉</div>
        ) : (
          <div className="today-classes-grid">
            {todayClasses.map(e => (
              <div key={e.id} className="today-class-card">
                <div className="today-class-info">
                  <div className="today-class-subject">{e.studentName || e.studentId} • {e.subjectName || e.subjectId}</div>
                  <div className="today-class-meta">
                    <span>{e.scheduleTime}</span>
                  </div>
                </div>
                <a
                  href={`https://meet.google.com/${e.meetingCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  <ExternalLink size={12} /> Join
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="table-title">Recent Sessions</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Subject</th>
              <th>Attended</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.length === 0 ? (
              <tr><td colSpan={5} className="table-empty">No sessions recorded yet</td></tr>
            ) : (
              recentSessions.map(s => (
                <tr key={s.id}>
                  <td>{new Date(s.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{s.studentName || s.studentId}</td>
                  <td>{s.subjectName || s.subjectId}</td>
                  <td>{s.attendedMin} min</td>
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
