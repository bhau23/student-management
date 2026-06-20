'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { SalaryRecord } from '@/lib/types';
import dayjs from 'dayjs';
import { IndianRupee, RefreshCw, HandCoins, AlertCircle, Coins } from 'lucide-react';
import InfoGuide from '@/components/InfoGuide';

export default function AdminSalariesPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));

  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [selectedSalary, setSelectedSalary] = useState<SalaryRecord | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth]);

  async function fetchSalaries() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'salaries'),
        where('billingMonth', '==', selectedMonth)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => d.data() as SalaryRecord);
      
      data.sort((a, b) => a.tutorName?.localeCompare(b.tutorName || '') || 0);
      setSalaries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalcSalaries() {
    if (!confirm(`Calculate salaries for ${selectedMonth}?`)) return;
    setCalculating(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/finance/calc-salaries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ billingMonth: selectedMonth })
      });
      if (!res.ok) throw new Error('Failed to calculate salaries');
      const data = await res.json();
      alert(`Calculated: ${data.created} new records, updated ${data.updated}.`);
      fetchSalaries();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCalculating(false);
    }
  }

  async function handleRecordPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSalary) return;
    
    setPayoutLoading(true);
    try {
      const token = await user?.getIdToken();
      const amountPaise = Math.round(parseFloat(payoutAmount) * 100);
      
      const res = await fetch('/api/finance/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tutorId: selectedSalary.tutorId,
          billingMonth: selectedSalary.billingMonth,
          amount: amountPaise,
          ref: payoutRef,
        })
      });
      if (!res.ok) throw new Error('Payout failed');
      
      setPayoutModalOpen(false);
      setPayoutAmount('');
      setPayoutRef('');
      fetchSalaries();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPayoutLoading(false);
    }
  }

  const formatPaise = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const totalEarnings = salaries.reduce((acc, s) => acc + s.earnings, 0);
  const totalPaid = salaries.reduce((acc, s) => acc + s.paid, 0);
  const totalPending = salaries.reduce((acc, s) => acc + s.pending, 0);

  return (
    <div className="page-body" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>
            Salaries Dashboard
            <InfoGuide title="Tutor Salaries Guide">
              <p style={{ marginBottom: 12 }}>Manage payroll and payouts for your tutors.</p>
              <ul style={{ paddingLeft: 20, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong>Calculating Salaries:</strong> At the end of the month, click "Calculate Salaries". This cross-references the tutor's agreed hourly rate with the duration of classes they successfully conducted.</li>
                <li><strong>Recording Payouts:</strong> When you transfer money to a tutor's bank account, click "Record Payout" to log the transaction against their pending balance.</li>
                <li><strong>Validation:</strong> The system ensures you cannot accidentally pay a tutor more than their pending balance.</li>
              </ul>
            </InfoGuide>
          </h1>
          <div className="subtitle">Track tutor earnings and manage payouts</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input"
            style={{ width: 160 }}
          />
          <button
            onClick={handleCalcSalaries}
            disabled={calculating}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={16} className={calculating ? 'animate-spin' : ''} />
            {calculating ? 'Calculating...' : 'Calculate Salaries'}
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card info">
          <div className="stat-icon"><Coins size={18} /></div>
          <div className="stat-label">Total Earnings Computed</div>
          <div className="stat-value">{formatPaise(totalEarnings)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon"><HandCoins size={18} /></div>
          <div className="stat-label">Total Paid Out</div>
          <div className="stat-value">{formatPaise(totalPaid)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon"><AlertCircle size={18} /></div>
          <div className="stat-label">Total Pending Liability</div>
          <div className="stat-value">{formatPaise(totalPending)}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tutor</th>
                <th style={{ textAlign: 'center' }}>Classes Conducted</th>
                <th>Earnings</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : salaries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No salaries calculated for this month.
                  </td>
                </tr>
              ) : (
                salaries.map((salary) => (
                  <tr key={salary.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{salary.tutorName || salary.tutorId}</td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <span style={{ background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)' }}>
                        {salary.classesConducted}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{formatPaise(salary.earnings)}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>{formatPaise(salary.paid)}</td>
                    <td style={{ color: salary.pending > 0 ? '#dc2626' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {formatPaise(salary.pending)}
                    </td>
                    <td>
                      <span className={`badge badge-${salary.status === 'paid' ? 'success' : salary.status === 'partial' ? 'info' : 'warning'}`}>
                        {salary.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedSalary(salary);
                          setPayoutAmount((salary.pending / 100).toString());
                          setPayoutModalOpen(true);
                        }}
                        disabled={salary.status === 'paid' || salary.pending <= 0}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--primary)' }}
                      >
                        <HandCoins size={14} style={{ marginRight: 6, display: 'inline' }} />
                        Record Payout
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payoutModalOpen && selectedSalary && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', padding: 20
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 420,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden',
            animation: 'fadeInUp 0.2s ease-out forwards'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <IndianRupee size={20} color="var(--primary)" />
                Record Payout
              </h2>
            </div>
            
            <form onSubmit={handleRecordPayout}>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'rgba(79, 70, 229, 0.05)', padding: 16, borderRadius: 8, border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tutor</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>{selectedSalary.tutorName}</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pending Balance</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatPaise(selectedSalary.pending)}</span>
                  </div>
                </div>

                <div>
                  <label className="label">Payout Amount (₹)</label>
                  <input
                    type="number" step="0.01" min="0.01" max={(selectedSalary.pending / 100).toString()} required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="input"
                    style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Cannot exceed pending balance.</div>
                </div>
                <div>
                  <label className="label">Reference / Note (optional)</label>
                  <input
                    type="text" value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)}
                    className="input" placeholder="e.g. UTR / Bank Transfer Ref"
                  />
                </div>
              </div>
              
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setPayoutModalOpen(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={payoutLoading} className="btn btn-primary">
                  {payoutLoading ? 'Saving...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
