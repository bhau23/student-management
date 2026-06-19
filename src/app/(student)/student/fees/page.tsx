'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { FeeRecord, Payment } from '@/lib/types';
import dayjs from 'dayjs';
import { Wallet, Clock, CheckCircle } from 'lucide-react';

export default function StudentFeesPage() {
  const { user, linkedId } = useAuth();
  const studentId = linkedId;

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch fees
        const feesQ = query(
          collection(db, 'fees'),
          where('studentId', '==', studentId)
        );
        const feesSnap = await getDocs(feesQ);
        const feesData = feesSnap.docs.map(d => d.data() as FeeRecord);
        feesData.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
        setFees(feesData);

        // Fetch payments
        const paymentsQ = query(
          collection(db, 'payments'),
          where('studentId', '==', studentId)
        );
        const paymentsSnap = await getDocs(paymentsQ);
        const paymentsData = paymentsSnap.docs.map(d => d.data() as Payment);
        paymentsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        setPayments(paymentsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [studentId]);

  const formatPaise = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  if (loading) {
    return <div className="p-6">Loading fees...</div>;
  }

  const currentMonth = dayjs().format('YYYY-MM');
  const currentFee = fees.find(f => f.billingMonth === currentMonth);

  return (
    <div className="page-body p-6 max-w-4xl mx-auto">
      <div className="page-header mb-8">
        <div>
          <h1 className="text-3xl font-bold">Fees & Payments</h1>
          <p className="subtitle">Your fee summary and payment history</p>
        </div>
      </div>

      {currentFee ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${
              currentFee.status === 'paid' ? 'bg-green-100 text-green-600' :
              currentFee.status === 'overdue' ? 'bg-red-100 text-red-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              {currentFee.status === 'paid' ? <CheckCircle size={32} /> : 
               currentFee.status === 'overdue' ? <Clock size={32} /> : 
               <Wallet size={32} />}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Current Month Balance</p>
              <h2 className="text-3xl font-bold">{formatPaise(currentFee.balance)}</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Total: {formatPaise(currentFee.totalFee)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Due Date: <span className="font-medium text-gray-900">{dayjs(currentFee.dueDate).format('MMM D, YYYY')}</span>
            </p>
            <span className={`inline-block mt-2 px-3 py-1 text-sm rounded-full font-medium ${
              currentFee.status === 'paid' ? 'bg-green-100 text-green-800' :
              currentFee.status === 'overdue' ? 'bg-red-100 text-red-800' :
              currentFee.status === 'partial' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {currentFee.status.toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 mb-8">
          No fee generated for the current month yet.
        </div>
      )}

      <h3 className="text-xl font-bold mb-4">Past Fee Records</h3>
      <div className="bg-white rounded shadow overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 text-sm">
              <th className="p-4">Month</th>
              <th className="p-4">Total</th>
              <th className="p-4">Paid</th>
              <th className="p-4">Balance</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {fees.filter(f => f.billingMonth !== currentMonth).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-500">No past fee records.</td>
              </tr>
            ) : (
              fees.filter(f => f.billingMonth !== currentMonth).map(fee => (
                <tr key={fee.id} className="border-b">
                  <td className="p-4 font-medium">{dayjs(fee.billingMonth).format('MMMM YYYY')}</td>
                  <td className="p-4">{formatPaise(fee.totalFee)}</td>
                  <td className="p-4 text-green-600">{formatPaise(fee.paid)}</td>
                  <td className="p-4 font-medium">{formatPaise(fee.balance)}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="text-xl font-bold mb-4">Payment History</h3>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 text-sm">
              <th className="p-4">Date</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Billing Month</th>
              <th className="p-4">Reference</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">No payments found.</td>
              </tr>
            ) : (
              payments.map(payment => (
                <tr key={payment.id} className="border-b">
                  <td className="p-4">{dayjs(payment.paidAt?.toDate?.() || payment.createdAt?.toDate?.()).format('MMM D, YYYY h:mm A')}</td>
                  <td className="p-4 font-medium text-green-600">{formatPaise(payment.amount)}</td>
                  <td className="p-4">{dayjs(payment.billingMonth).format('MMMM YYYY')}</td>
                  <td className="p-4 text-gray-500 text-sm">
                    {payment.txnRef || payment.source}
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
