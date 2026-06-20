'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import dayjs from 'dayjs';
import { Download, FileText, AlertTriangle } from 'lucide-react';
import InfoGuide from '@/components/InfoGuide';

const REPORT_TYPES = [
  { id: 'students', label: 'Students Roster', desc: 'All current and past students.' },
  { id: 'attendance', label: 'Attendance Records', desc: 'Session-level attendance data for the period.' },
  { id: 'leads', label: 'CRM Leads', desc: 'Prospective students and conversion tracking.' },
  { id: 'fees', label: 'Fee Payments', desc: 'Fee invoices and payment statuses.', finance: true },
  { id: 'salaries', label: 'Tutor Salaries', desc: 'Salary payouts to tutors.', finance: true },
];

export default function ReportsPage() {
  const { user, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [type, setType] = useState('attendance');
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, period, format: 'csv' }),
      });

      if (!res.ok) {
        let errStr = 'Export failed';
        try {
          const data = await res.json();
          errStr = data.error || errStr;
        } catch {
          errStr = `Server Error: ${res.status} ${res.statusText}. Please check Firebase credentials.`;
        }
        throw new Error(errStr);
      }

      // Handle file download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-body">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1>
            Reports & Exports
            <InfoGuide title="Reports Guide">
              <p style={{ marginBottom: 12 }}>Download raw platform data in CSV format for analysis in Excel or Google Sheets.</p>
              <ul style={{ paddingLeft: 20, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong>Students Roster:</strong> Contains all registered students regardless of the selected period.</li>
                <li><strong>Attendance Records:</strong> A row for every class session conducted within the selected month. Useful for auditing tutor hours.</li>
                <li><strong>Finance Reports:</strong> Only available to the Super Admin. Contains highly sensitive revenue and payroll data.</li>
              </ul>
            </InfoGuide>
          </h1>
          <div className="subtitle">Download platform data as CSV</div>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 32 }}>
        
        {/* Main form */}
        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleDownload} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 12 }}>1. Select Report Type</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {REPORT_TYPES.map(rt => {
                  const disabled = rt.finance && !isSuperAdmin;
                  return (
                    <label key={rt.id} style={{ 
                      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', 
                      border: `1px solid ${type === rt.id ? 'var(--primary)' : 'var(--border)'}`, 
                      borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                      background: type === rt.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                      opacity: disabled ? 0.6 : 1
                    }}>
                      <input 
                        type="radio" 
                        name="report_type" 
                        value={rt.id} 
                        checked={type === rt.id} 
                        onChange={() => setType(rt.id)}
                        disabled={disabled}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{rt.label} {disabled && <span style={{ fontSize: 10, background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: 4, marginLeft: 8 }}>Super Admin Only</span>}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rt.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: 20, background: 'var(--surface-alt)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>2. Select Period</label>
              <input 
                type="month" 
                className="input" 
                value={period} 
                onChange={e => setPeriod(e.target.value)} 
                style={{ width: 200 }}
                disabled={type === 'students'} // students report is non-periodic
              />
              {type === 'students' && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>The students roster is not bound to a specific month.</div>}
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '10px 24px' }} disabled={loading}>
              <Download size={18} /> {loading ? 'Generating CSV...' : 'Download CSV'}
            </button>
          </form>
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
              <FileText size={18} color="var(--primary)" /> Format Information
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              All reports are currently exported in <strong>CSV format</strong>. This allows you to open them directly in Excel, Google Sheets, or Apple Numbers for further analysis.
            </p>
          </div>
          
          <div className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#b45309', marginBottom: 8 }}>
              <AlertTriangle size={18} /> Access Restrictions
            </div>
            <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
              Finance reports (Fees and Salaries) contain sensitive data and are strictly restricted to <strong>Super Admin</strong> roles. Operations admins cannot export financial data.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
