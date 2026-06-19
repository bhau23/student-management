'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UnmappedQueueEntry } from '@/lib/types';
import { Trash2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function UnmappedPage() {
  const [entries, setEntries] = useState<(UnmappedQueueEntry & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, '_system/unmappedQueue'), orderBy('createdAt', 'desc')));
    // unmappedQueue is a sub-doc under _system — handled via direct collection path
    setLoading(false);
  };

  // Note: _system/unmappedQueue is a collection under a document — we need its sub-path
  const loadFixed = async () => {
    setLoading(true);
    try {
      // The unmapped queue entries are docs in the collection path: _system -> unmappedQueue (sub-collection doesn't exist)
      // Per spec: doc id = `${code}_${date}` under `_system/unmappedQueue` — this is a collection
      const snap = await getDocs(collection(db, 'unmappedQueue'));
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFixed(); }, []);

  const handleDismiss = async (id: string) => {
    if (!confirm('Dismiss this unmapped entry?')) return;
    await deleteDoc(doc(db, 'unmappedQueue', id));
    await loadFixed();
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Unmapped Queue</h1>
          <div className="subtitle">Attendance files with no matching enrollment — needs action</div>
        </div>
      </div>

      {entries.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          ⚠ {entries.length} unmatched meeting code{entries.length !== 1 ? 's' : ''}. Create enrollments for these codes, then re-run ingestion.
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Meeting Code</th>
                <th>Date</th>
                <th>Reason</th>
                <th>Sample File</th>
                <th>Detected</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">✓ No unmapped codes. All meeting codes are enrolled.</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td><span className="code">{e.meetingCode}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>{e.date}</td>
                  <td>
                    <span className="badge badge-danger" style={{ fontSize: 10 }}>{e.reason}</span>
                  </td>
                  <td>
                    {e.sampleFileId ? (
                      <a
                        href={`https://drive.google.com/file/d/${e.sampleFileId}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        <ExternalLink size={11} /> View File
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {e.createdAt ? format((e.createdAt as any).toDate(), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td>
                    <button className="btn-icon" title="Dismiss" onClick={() => handleDismiss(e.id)}
                      style={{ color: 'var(--danger)', borderColor: 'rgba(248,81,73,0.3)' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>How to resolve unmapped codes</div>
        <ol style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 2 }}>
          <li>Go to <a href="/enrollments">Enrollments</a> → Create a new enrollment for this meeting code</li>
          <li>The ingestion function runs every 15 minutes — it will automatically retry unprocessed files</li>
          <li>Once a session is created, dismiss the unmapped entry here</li>
        </ol>
      </div>
    </div>
  );
}
