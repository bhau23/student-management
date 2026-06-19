'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import dayjs from 'dayjs';
import Link from 'next/link';
import {
  Users, GraduationCap, CalendarCheck, AlertTriangle,
  TrendingUp, Wallet, Coins, BarChart3, ShieldAlert,
  CheckCircle, Clock, XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FinanceBlock {
  revenue: number;
  outstanding: number;
  salaryLiability: number;
  payoutsMade: number;
  net: number;
  grossMargin: number;
}
interface StatsPayload {
  period: string;
  students: { totalActive: number; newThisMonth: number; atRisk: { studentId: string; studentName: string; attendancePct: number | null; hasOverdueFee: boolean }[] };
  tutors: { totalActive: number; utilization: { tutorId: string; tutorName: string; classesConducted: number; attendancePct: number | null }[] };
  academic: { conducted: number; missed: number; cancelled: number; attendancePct: number | null; pendingReviews: number; avgTestPct: number | null; ptm: { scheduled: number; completed: number; cancelled: number } };
  crm: { totalLeads: number; convertedLeads: number; conversionRate: number; expectedValue: number; leadsBySource: Record<string, number> };
  alerts: { overdueFees: number; pendingReviews: number; unmappedSessions: number; unpaidSalaries?: number };
  finance?: FinanceBlock;
}

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function KpiCard({
  label, value, sub, color, icon: Icon,
}: { label: string; value: string | number; sub?: string; color: 'accent' | 'success' | 'warning' | 'danger' | 'info'; icon: React.ElementType }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon"><Icon size={18} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function AlertCard({ count, label, href, icon: Icon, color }: { count: number; label: string; href: string; icon: React.ElementType; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)', border: `1px solid var(--border)`,
        borderRadius: 10, padding: '14px 18px',
        transition: 'border-color 0.15s',
        cursor: 'pointer',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{count}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
        </div>
      </div>
    </Link>
  );
}

export default function CommandCenterPage() {
  const { user, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async (p: string) => {
    setLoading(true);
    setError('');
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/dashboard-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ period: p }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load stats');
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchStats(period); }, [period, fetchStats]);

  return (
    <div className="page-body">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>Command Center</h1>
          <div className="subtitle">
            {isSuperAdmin ? 'Director view — full finance + operations' : 'Operations view — academic & student metrics'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="input"
            style={{ width: 160 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => fetchStats(period)} disabled={loading}>
            {loading ? '↻ Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 20 }}>{error}</div>}

      {loading && !data ? (
        <div className="loading-full"><div className="spinner" /></div>
      ) : data && (
        <>
          {/* ── Finance Block (super_admin only) ─────────────────────────── */}
          {isSuperAdmin && data.finance && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
                Finance — {dayjs(period).format('MMMM YYYY')}
              </h2>
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <KpiCard label="Revenue" value={fmt(data.finance.revenue)} sub="Total payments received" color="success" icon={TrendingUp} />
                <KpiCard label="Outstanding" value={fmt(data.finance.outstanding)} sub="Unpaid fee balances" color="warning" icon={Wallet} />
                <KpiCard label="Salary Liability" value={fmt(data.finance.salaryLiability)} sub="Pending tutor payouts" color="danger" icon={Coins} />
                <KpiCard label="Payouts Made" value={fmt(data.finance.payoutsMade)} sub="Tutor salary disbursed" color="accent" icon={CheckCircle} />
                <KpiCard label="Net" value={fmt(data.finance.net)} sub="Revenue − Payouts" color={data.finance.net >= 0 ? 'success' : 'danger'} icon={BarChart3} />
                <KpiCard label="Gross Margin" value={fmt(data.finance.grossMargin)} sub="Revenue − Total salary cost" color={data.finance.grossMargin >= 0 ? 'success' : 'danger'} icon={TrendingUp} />
              </div>
            </section>
          )}

          {/* ── Operational KPIs ──────────────────────────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
              Operations — {dayjs(period).format('MMMM YYYY')}
            </h2>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <KpiCard label="Active Students" value={data.students.totalActive} sub={`+${data.students.newThisMonth} new this month`} color="accent" icon={Users} />
              <KpiCard label="Active Tutors" value={data.tutors.totalActive} color="success" icon={GraduationCap} />
              <KpiCard label="Classes Conducted" value={data.academic.conducted} sub={`${data.academic.missed} missed · ${data.academic.cancelled} cancelled`} color="info" icon={CalendarCheck} />
              
              <KpiCard
                label="Attendance"
                value={data.academic.attendancePct !== null ? `${data.academic.attendancePct}%` : '—'}
                sub="Present / (Present + Absent)"
                color={data.academic.attendancePct !== null && data.academic.attendancePct < 70 ? 'danger' : 'success'}
                icon={BarChart3}
              />
              <KpiCard
                label="Test Average"
                value={data.academic.avgTestPct !== null ? `${data.academic.avgTestPct}%` : '—'}
                sub="Mean score on graded tests"
                color={data.academic.avgTestPct !== null && data.academic.avgTestPct < 60 ? 'danger' : 'success'}
                icon={TrendingUp}
              />
              <KpiCard
                label="PTMs Completed"
                value={data.academic.ptm.completed}
                sub={`${data.academic.ptm.scheduled} scheduled · ${data.academic.ptm.cancelled} cancelled`}
                color="info"
                icon={Users}
              />
            </div>
          </section>

          {/* ── Alerts row ────────────────────────────────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
              Alerts — Action Required
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <AlertCard count={data.alerts.overdueFees} label="Overdue Fees" href="/fees" icon={AlertTriangle} color="#ef4444" />
              <AlertCard count={data.alerts.pendingReviews} label="Pending Attendance Reviews" href="/sessions" icon={Clock} color="#f59e0b" />
              <AlertCard count={data.alerts.unmappedSessions} label="Unmapped Sessions" href="/unmapped" icon={XCircle} color="#8b5cf6" />
              {isSuperAdmin && data.alerts.unpaidSalaries !== undefined && (
                <AlertCard count={data.alerts.unpaidSalaries} label="Unpaid Salaries" href="/salaries" icon={Coins} color="#3b82f6" />
              )}
            </div>
          </section>

          {/* ── CRM Funnel ────────────────────────────────────────────────── */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 14 }}>
              Lead Funnel — {dayjs(period).format('MMMM YYYY')}
            </h2>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <KpiCard label="Total Leads" value={data.crm.totalLeads} sub="Active this month" color="info" icon={Users} />
              <KpiCard label="Converted" value={data.crm.convertedLeads} color="success" icon={CheckCircle} />
              <KpiCard label="Conversion Rate" value={`${data.crm.conversionRate}%`} color={data.crm.conversionRate >= 20 ? 'success' : 'warning'} icon={TrendingUp} />
              <KpiCard label="Expected Value" value={fmt(data.crm.expectedValue)} sub="From converted leads" color="accent" icon={Wallet} />
            </div>
          </section>

          {/* ── Two-column: At-Risk Students + Tutor Utilization ─────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* At-Risk Students */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">⚠ At-Risk Students</div>
                  <div className="card-subtitle">Attendance &lt; 70% or overdue fee</div>
                </div>
                <Link href="/students" className="btn btn-ghost btn-sm">View all →</Link>
              </div>
              {data.students.atRisk.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>✓ No at-risk students</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.students.atRisk.slice(0, 8).map((s: any) => (
                    <div key={s.studentId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', background: 'var(--warning-bg)',
                      border: '1px solid rgba(240,180,41,0.2)', borderRadius: 8,
                    }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{s.studentName}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {s.attendancePct !== null && (
                          <span style={{ fontSize: 11, background: s.attendancePct < 70 ? '#fee2e2' : '#dcfce7', color: s.attendancePct < 70 ? '#b91c1c' : '#166534', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                            {s.attendancePct}%
                          </span>
                        )}
                        {s.hasOverdueFee && (
                          <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tutor Utilization */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Tutor Utilization</div>
                  <div className="card-subtitle">Classes conducted · attendance health</div>
                </div>
                <Link href="/tutors" className="btn btn-ghost btn-sm">View all →</Link>
              </div>
              {data.tutors.utilization.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>No sessions this month</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.tutors.utilization.map(t => (
                    <div key={t.tutorId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', background: 'var(--surface-alt)',
                      border: '1px solid var(--border)', borderRadius: 8,
                    }}>
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{t.tutorName}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.classesConducted} classes</span>
                        {t.attendancePct !== null && (
                          <span style={{
                            fontSize: 11,
                            background: t.attendancePct >= 70 ? '#dcfce7' : '#fee2e2',
                            color: t.attendancePct >= 70 ? '#166534' : '#b91c1c',
                            padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                          }}>
                            {t.attendancePct}% att.
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
