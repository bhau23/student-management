'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { ExternalLink } from 'lucide-react';

interface Enrollment {
  id: string;
  subjectId: string;
  subjectName?: string;
  tutorId: string;
  tutorName?: string;
  meetingCode: string;
  scheduleDays: string[];
  scheduleTime: string;
  active: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayShort(): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

export default function StudentSchedule() {
  const { linkedId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch enrollments
  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const snap = await getDocs(query(
        collection(db, 'enrollments'),
        where('studentId', '==', linkedId),
        where('active', '==', true),
      ));
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      setLoading(false);
    })();
  }, [linkedId]);

  // Build schedule grid data: day → list of classes
  const grid = useMemo(() => {
    const dayMap: Record<string, Enrollment[]> = {};
    for (const day of WEEKDAYS) {
      dayMap[day] = enrollments
        .filter(e => e.scheduleDays?.includes(day))
        .sort((a, b) => (a.scheduleTime || '').localeCompare(b.scheduleTime || ''));
    }
    return dayMap;
  }, [enrollments]);

  const today = todayShort();

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
          <h1>Weekly Schedule</h1>
          <p className="subtitle">Your class timetable for the week</p>
        </div>
      </div>

      <div className="schedule-grid">
        {WEEKDAYS.map(day => (
          <div key={day} className={`schedule-day-col ${day === today ? 'schedule-today' : ''}`}>
            <div className="schedule-day-header">
              <span className="schedule-day-name">{day}</span>
              {day === today && <span className="badge badge-accent" style={{ fontSize: 9 }}>Today</span>}
            </div>
            <div className="schedule-day-body">
              {grid[day].length === 0 ? (
                <div className="schedule-empty">No classes</div>
              ) : (
                grid[day].map(e => (
                  <div key={e.id} className="schedule-class-card">
                    <div className="schedule-class-subject">
                      {e.subjectName || e.subjectId}
                    </div>
                    <div className="schedule-class-time">{e.scheduleTime}</div>
                    <div className="schedule-class-tutor text-muted">
                      {e.tutorName || e.tutorId}
                    </div>
                    {day === today && (
                      <a
                        href={`https://meet.google.com/${e.meetingCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                      >
                        <ExternalLink size={12} /> Join
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
