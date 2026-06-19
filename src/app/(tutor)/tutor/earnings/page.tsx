'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { SalaryRecord } from '@/lib/types';
import dayjs from 'dayjs';
import { Coins, CheckCircle, Clock } from 'lucide-react';

export default function TutorEarningsPage() {
  const { linkedId } = useAuth();
  const tutorId = linkedId;

  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'salaries'),
          where('tutorId', '==', tutorId)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data() as SalaryRecord);
        data.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth));
        setSalaries(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [tutorId]);

  const formatPaise = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

  if (loading) {
    return <div className="p-6">Loading earnings...</div>;
  }

  const currentMonth = dayjs().format('YYYY-MM');
  const currentSalary = salaries.find(s => s.billingMonth === currentMonth);

  return (
    <div className="page-body p-6 max-w-4xl mx-auto">
      <div className="page-header mb-8">
        <div>
          <h1 className="text-3xl font-bold">Earnings & Payouts</h1>
          <p className="subtitle">Your monthly salary breakdown</p>
        </div>
      </div>

      {currentSalary ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-full ${
              currentSalary.status === 'paid' ? 'bg-green-100 text-green-600' :
              currentSalary.status === 'partial' ? 'bg-blue-100 text-blue-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {currentSalary.status === 'paid' ? <CheckCircle size={32} /> : 
               currentSalary.status === 'partial' ? <Coins size={32} /> : 
               <Clock size={32} />}
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Current Month Earnings</p>
              <h2 className="text-3xl font-bold">{formatPaise(currentSalary.earnings)}</h2>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-600">Pending: <span className="font-bold text-red-600">{formatPaise(currentSalary.pending)}</span></p>
            <p className="text-sm text-gray-500 mt-1">
              Classes Conducted: <span className="font-medium text-gray-900">{currentSalary.classesConducted}</span>
            </p>
            <span className={`inline-block mt-2 px-3 py-1 text-sm rounded-full font-medium ${
              currentSalary.status === 'paid' ? 'bg-green-100 text-green-800' :
              currentSalary.status === 'partial' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {currentSalary.status.toUpperCase()}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500 mb-8">
          No earnings calculated for the current month yet.
        </div>
      )}

      <h3 className="text-xl font-bold mb-4">Past Earnings</h3>
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 text-sm">
              <th className="p-4">Month</th>
              <th className="p-4 text-center">Classes</th>
              <th className="p-4">Earnings</th>
              <th className="p-4">Paid</th>
              <th className="p-4">Pending</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {salaries.filter(s => s.billingMonth !== currentMonth).length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">No past salary records.</td>
              </tr>
            ) : (
              salaries.filter(s => s.billingMonth !== currentMonth).map(salary => (
                <tr key={salary.id} className="border-b">
                  <td className="p-4 font-medium">{dayjs(salary.billingMonth).format('MMMM YYYY')}</td>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
