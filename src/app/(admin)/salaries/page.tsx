'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { SalaryRecord } from '@/lib/types';
import dayjs from 'dayjs';

export default function AdminSalariesPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  // Default to current month
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

  const formatPaise = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Salaries Dashboard</h1>
        
        <div className="flex items-center gap-4">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded"
          />
          <button
            onClick={handleCalcSalaries}
            disabled={calculating}
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {calculating ? 'Calculating...' : 'Calculate Salaries'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading salaries...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 text-sm">
                <th className="p-4">Tutor</th>
                <th className="p-4">Classes Conducted</th>
                <th className="p-4">Earnings</th>
                <th className="p-4">Paid</th>
                <th className="p-4">Pending</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No salaries calculated for this month.
                  </td>
                </tr>
              ) : (
                salaries.map((salary) => (
                  <tr key={salary.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{salary.tutorName || salary.tutorId}</td>
                    <td className="p-4 text-center">{salary.classesConducted}</td>
                    <td className="p-4 font-medium">{formatPaise(salary.earnings)}</td>
                    <td className="p-4 text-green-600">{formatPaise(salary.paid)}</td>
                    <td className="p-4 font-bold text-red-600">{formatPaise(salary.pending)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        salary.status === 'paid' ? 'bg-green-100 text-green-800' :
                        salary.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {salary.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setSelectedSalary(salary);
                          setPayoutAmount((salary.pending / 100).toString());
                          setPayoutModalOpen(true);
                        }}
                        disabled={salary.status === 'paid' || salary.pending <= 0}
                        className="text-sm text-indigo-600 hover:underline disabled:opacity-30"
                      >
                        Record Payout
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {payoutModalOpen && selectedSalary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Record Payout</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tutor: {selectedSalary.tutorName} <br />
              Pending: {formatPaise(selectedSalary.pending)}
            </p>
            <form onSubmit={handleRecordPayout}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(selectedSalary.pending / 100).toString()}
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Reference / Note (optional)</label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPayoutModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={payoutLoading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">
                  {payoutLoading ? 'Saving...' : 'Save Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
