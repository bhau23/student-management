'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { FeeRecord } from '@/lib/types';
import dayjs from 'dayjs';
import { Wallet, IndianRupee, CreditCard, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import InfoGuide from '@/components/InfoGuide';

export default function AdminFeesPage() {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPayer, setPaymentPayer] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    fetchFees();
  }, [selectedMonth]);

  async function fetchFees() {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'fees'),
        where('billingMonth', '==', selectedMonth)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(d => d.data() as FeeRecord);
      data.sort((a, b) => a.status.localeCompare(b.status));
      setFees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFees() {
    if (!confirm(`Generate fees for ${selectedMonth}?`)) return;
    setGenerating(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/finance/generate-fees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ billingMonth: selectedMonth })
      });
      if (!res.ok) throw new Error('Failed to generate fees');
      const data = await res.json();
      alert(`Generated: ${data.created} new records, updated ${data.updated}.`);
      fetchFees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFee) return;
    
    setPaymentLoading(true);
    try {
      const token = await user?.getIdToken();
      const amountPaise = Math.round(parseFloat(paymentAmount) * 100);
      
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studentId: selectedFee.studentId,
          billingMonth: selectedFee.billingMonth,
          amount: amountPaise,
          source: 'manual',
          payerName: paymentPayer,
          txnRef: paymentRef,
        })
      });
      if (!res.ok) throw new Error('Payment failed');
      
      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentPayer('');
      setPaymentRef('');
      fetchFees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPaymentLoading(false);
    }
  }

  const formatPaise = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const totalInvoiced = fees.reduce((acc, f) => acc + f.totalFee, 0);
  const totalCollected = fees.reduce((acc, f) => acc + f.paid, 0);
  const totalOutstanding = fees.reduce((acc, f) => acc + f.balance, 0);

  return (
    <div className="page-body" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>
            Fees Dashboard
            <InfoGuide title="Fees Management Guide">
              <p style={{ marginBottom: 12 }}>Manage all student billing and fee collection.</p>
              <ul style={{ paddingLeft: 20, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <li><strong>Generating Fees:</strong> At the end of the month, click "Generate Fees". This automatically calculates each student's fee based on their rate and classes conducted, and creates invoices.</li>
                <li><strong>Recording Payments:</strong> When a student pays via cash/bank, click "Record Payment" and enter the exact amount paid. The balance will automatically update.</li>
                <li><strong>Overdue:</strong> If a fee is not paid in full by the 5th of the following month, its status becomes Overdue.</li>
              </ul>
            </InfoGuide>
          </h1>
          <div className="subtitle">Track generated invoices and record payments</div>
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
            onClick={handleGenerateFees}
            disabled={generating}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Generating...' : 'Generate Fees'}
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card info">
          <div className="stat-icon"><Wallet size={18} /></div>
          <div className="stat-label">Total Invoiced</div>
          <div className="stat-value">{formatPaise(totalInvoiced)}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon"><TrendingUp size={18} /></div>
          <div className="stat-label">Total Collected</div>
          <div className="stat-value">{formatPaise(totalCollected)}</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon"><AlertCircle size={18} /></div>
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value">{formatPaise(totalOutstanding)}</div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Due Date</th>
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
              ) : fees.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No fees generated for this month.
                  </td>
                </tr>
              ) : (
                fees.map((fee) => (
                  <tr key={fee.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fee.studentName || fee.studentId}</td>
                    <td style={{ fontWeight: 500 }}>{formatPaise(fee.totalFee)}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>{formatPaise(fee.paid)}</td>
                    <td style={{ color: fee.balance > 0 ? '#dc2626' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {formatPaise(fee.balance)}
                    </td>
                    <td>{dayjs(fee.dueDate).format('MMM D, YYYY')}</td>
                    <td>
                      <span className={`badge badge-${fee.status === 'paid' ? 'success' : fee.status === 'overdue' ? 'danger' : fee.status === 'partial' ? 'info' : 'warning'}`}>
                        {fee.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setSelectedFee(fee);
                          setPaymentAmount((fee.balance / 100).toString());
                          setPaymentModalOpen(true);
                        }}
                        disabled={fee.status === 'paid'}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--primary)' }}
                      >
                        <CreditCard size={14} style={{ marginRight: 6, display: 'inline' }} />
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paymentModalOpen && selectedFee && (
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
                Record Payment
              </h2>
            </div>
            
            <form onSubmit={handleRecordPayment}>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'rgba(79, 70, 229, 0.05)', padding: 16, borderRadius: 8, border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Student</div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>{selectedFee.studentName}</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Balance</span>
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatPaise(selectedFee.balance)}</span>
                  </div>
                </div>

                <div>
                  <label className="label">Payment Amount (₹)</label>
                  <input
                    type="number" step="0.01" min="0.01" required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="input"
                    style={{ fontSize: 18, fontWeight: 600, color: 'var(--primary)' }}
                  />
                </div>
                <div>
                  <label className="label">Payer Name (optional)</label>
                  <input
                    type="text" value={paymentPayer} onChange={(e) => setPaymentPayer(e.target.value)}
                    className="input" placeholder="e.g. Father's Name"
                  />
                </div>
                <div>
                  <label className="label">Reference / Cheque (optional)</label>
                  <input
                    type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)}
                    className="input" placeholder="e.g. UTR / Cheque No."
                  />
                </div>
              </div>
              
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" disabled={paymentLoading} className="btn btn-primary">
                  {paymentLoading ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
