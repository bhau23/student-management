'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';

interface Enrollment {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  active: boolean;
}

interface Session {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  date: string;
  attendanceStatus: string;
  status: string;
}

interface StudentKPI {
  studentId: string;
  studentName: string;
  enrollments: number;
  totalClasses: number;
  present: number;
  absent: number;
  attendancePct: number;
}

export default function TutorStudents() {
  const { linkedId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!linkedId) return;
    (async () => {
      const [enrSnap, sessSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'enrollments'),
          where('tutorId', '==', linkedId),
          where('active', '==', true)
        )),
        getDocs(query(
          collection(db, 'class_sessions'),
          where('tutorId', '==', linkedId)
        )),
      ]);

      setEnrollments(enrSnap.docs.map(d => ({ id: d.id, ...d.data() } as Enrollment)));
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() } as Session)));
      setLoading(false);
    })();
  }, [linkedId]);

  const students = useMemo(() => {
    const map = new Map<string, StudentKPI>();

    // First pass: create entry for each unique student based on enrollments
    enrollments.forEach(e => {
      if (!map.has(e.studentId)) {
        map.set(e.studentId, {
          studentId: e.studentId,
          studentName: e.studentName || e.studentId,
          enrollments: 0,
          totalClasses: 0,
          present: 0,
          absent: 0,
          attendancePct: 100,
        });
      }
      map.get(e.studentId)!.enrollments++;
    });

    // Second pass: tally attendance
    sessions.forEach(s => {
      if (s.status !== 'conducted') return;
      if (!map.has(s.studentId)) return; // Only count students actively enrolled
      
      const st = map.get(s.studentId)!;
      if (s.attendanceStatus === 'present') st.present++;
      else if (s.attendanceStatus === 'absent') st.absent++;
    });

    // Calculate percentages
    Array.from(map.values()).forEach(st => {
      st.totalClasses = st.present + st.absent;
      st.attendancePct = st.totalClasses > 0 
        ? Math.round((st.present / st.totalClasses) * 100) 
        : 100;
    });

    return Array.from(map.values()).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [enrollments, sessions]);

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
          <h1>My Students</h1>
          <p className="subtitle">Overview of students assigned to your classes</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Active Subjects</th>
              <th>Total Classes</th>
              <th>Attendance (Your Classes)</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">No students assigned yet</td></tr>
            ) : (
              students.map(st => (
                <tr key={st.studentId}>
                  <td className="font-medium">{st.studentName}</td>
                  <td>{st.enrollments}</td>
                  <td>{st.totalClasses}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ width: 100, background: 'var(--border)' }}>
                        <div 
                          className="progress-fill" 
                          style={{ 
                            width: `${st.attendancePct}%`,
                            background: st.attendancePct >= 80 ? 'var(--success)' : 
                                        st.attendancePct >= 60 ? 'var(--warning)' : 'var(--danger)'
                          }} 
                        />
                      </div>
                      <span className="text-sm">{st.attendancePct}%</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
