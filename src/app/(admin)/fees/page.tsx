'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { FeeRecord } from '@/lib/types';
import dayjs from 'dayjs';

export default function AdminFeesPage() {
  const { user } = useAuth();
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Default to current month
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
      
      // Client-side sort by status to keep rules simple for now
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
      // user enters rupees, we send paise
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

  const formatPaise = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fees Dashboard</h1>
        
        <div className="flex items-center gap-4">
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded"
          />
          <button
            onClick={handleGenerateFees}
            disabled={generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Fees'}
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading fees...</p>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 text-sm">
                <th className="p-4">Student</th>
                <th className="p-4">Total Fee</th>
                <th className="p-4">Paid</th>
                <th className="p-4">Balance</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    No fees generated for this month.
                  </td>
                </tr>
              ) : (
                fees.map((fee) => (
                  <tr key={fee.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">{fee.studentName || fee.studentId}</td>
                    <td className="p-4">{formatPaise(fee.totalFee)}</td>
                    <td className="p-4 text-green-600">{formatPaise(fee.paid)}</td>
                    <td className="p-4 font-bold text-red-600">{formatPaise(fee.balance)}</td>
                    <td className="p-4">{dayjs(fee.dueDate).format('MMM D, YYYY')}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        fee.status === 'paid' ? 'bg-green-100 text-green-800' :
                        fee.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        fee.status === 'partial' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {fee.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setSelectedFee(fee);
                          setPaymentAmount((fee.balance / 100).toString());
                          setPaymentModalOpen(true);
                        }}
                        disabled={fee.status === 'paid'}
                        className="text-sm text-indigo-600 hover:underline disabled:opacity-30"
                      >
                        Record Payment
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {paymentModalOpen && selectedFee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold mb-4">Record Payment</h2>
            <p className="text-sm text-gray-600 mb-4">
              Student: {selectedFee.studentName} <br />
              Balance: {formatPaise(selectedFee.balance)}
            </p>
            <form onSubmit={handleRecordPayment}>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium mb-1">Payer Name (optional)</label>
                <input
                  type="text"
                  value={paymentPayer}
                  onChange={(e) => setPaymentPayer(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Reference / Cheque (optional)</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={paymentLoading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">
                  {paymentLoading ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
