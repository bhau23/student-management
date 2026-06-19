'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Enrollment {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  scheduleDays: string[];
  scheduleTime: string;
  meetingCode: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TutorSchedule() {
  const { linkedId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const snap = await getDocs(query(
        collection(db, 'enrollments'),
        where('tutorId', '==', linkedId),
        where('active', '==', true)
      ));
      setEnrollments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      setLoading(false);
    })();
  }, [linkedId]);

  const scheduleGrid = useMemo(() => {
    const grid: Record<string, Enrollment[]> = {};
    DAYS.forEach(d => (grid[d] = []));

    enrollments.forEach(e => {
      if (!e.scheduleDays) return;
      e.scheduleDays.forEach(day => {
        if (grid[day]) {
          grid[day].push(e);
        }
      });
    });

    DAYS.forEach(d => {
      grid[d].sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));
    });

    return grid;
  }, [enrollments]);

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
          <h1>My Schedule</h1>
          <p className="subtitle">Your weekly recurring classes</p>
        </div>
      </div>

      <div className="schedule-grid">
        {DAYS.map(day => (
          <div key={day} className="schedule-column">
            <div className="schedule-column-header">{day}</div>
            <div className="schedule-column-body">
              {scheduleGrid[day].length === 0 ? (
                <div className="schedule-empty">No classes</div>
              ) : (
                scheduleGrid[day].map(e => (
                  <div key={`${e.id}-${day}`} className="schedule-card">
                    <div className="schedule-time">{e.scheduleTime}</div>
                    <div className="schedule-subject">{e.subjectName || e.subjectId}</div>
                    <div className="schedule-tutor text-muted">{e.studentName || e.studentId}</div>
                    <a 
                      href={`https://meet.google.com/${e.meetingCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: 8, width: '100%', display: 'flex', justifyContent: 'center' }}
                    >
                      Join Meet
                    </a>
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
