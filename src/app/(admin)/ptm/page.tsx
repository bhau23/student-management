'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { PTM } from '@/lib/types';
import dayjs from 'dayjs';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_ICON: Record<string, React.ReactNode> = {
  scheduled: <Clock size={13} />,
  completed: <CheckCircle size={13} />,
  cancelled: <XCircle size={13} />,
};
const STATUS_COLOR: Record<string, string> = {
  scheduled: 'var(--warning)', completed: 'var(--success)', cancelled: 'var(--danger)',
};

export default function AdminPTMPage() {
  const [ptms, setPtms] = useState<PTM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'ptms'), orderBy('date', 'desc')));
      setPtms(snap.docs.map(d => ({ id: d.id, ...d.data() } as PTM)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const filtered = ptms.filter(p => {
    const matchSearch = !search || [p.studentName, p.tutorName].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="page-body">
      <div className="page-header">
        <div><h1>PTM — Overview</h1><div className="subtitle">All parent-teacher meetings</div></div>
      </div>
      <div className="table-toolbar" style={{ marginBottom: 16 }}>
        <input className="input" placeholder="Search student or tutor…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 240 }} />
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} records</div>
      </div>
      {loading ? <div className="loading-full"><div className="spinner" /></div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Tutor</th><th>Date</th><th>Time</th><th>Status</th><th>Summary</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={6} className="table-empty">No PTMs found.</td></tr>
                : filtered.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.studentName}</td>
                    <td>{p.tutorName}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{dayjs(p.date).format('MMM D, YYYY')}</td>
                    <td>{p.time}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: STATUS_COLOR[p.status], fontWeight: 600, textTransform: 'capitalize' }}>
                        {STATUS_ICON[p.status]}{p.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                      {p.summary || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
