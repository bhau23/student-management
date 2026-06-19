'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuditLog } from '@/lib/types';
import { format } from 'date-fns';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, 'audit_log'), orderBy('ts', 'desc'), limit(200)));
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)));
      setLoading(false);
    })();
  }, []);

  const ACTION_COLOR: Record<string, string> = {
    create: 'var(--success)',
    update: 'var(--warning)',
    delete: 'var(--danger)',
  };

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <div className="subtitle">All create / update / delete actions — last 200 entries</div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-full"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="table-empty">No audit logs yet.</td></tr>
              ) : logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {l.ts ? format((l.ts as any).toDate(), 'yyyy-MM-dd HH:mm') : '—'}
                  </td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{l.actorUid}</td>
                  <td>
                    <span className="badge" style={{
                      background: ACTION_COLOR[l.action] + '20',
                      color: ACTION_COLOR[l.action],
                      border: `1px solid ${ACTION_COLOR[l.action]}40`,
                      fontSize: 10,
                    }}>{l.action}</span>
                  </td>
                  <td style={{ fontWeight: 500, color: 'var(--accent)' }}>{l.entity}</td>
                  <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{l.entityId}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300 }}>
                    {l.after ? (
                      <code style={{ fontSize: 10, background: 'var(--bg-base)', padding: '2px 6px', borderRadius: 4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {JSON.stringify(l.after).slice(0, 120)}
                      </code>
                    ) : '—'}
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
