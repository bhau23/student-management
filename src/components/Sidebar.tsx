'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  CalendarDays,
  BarChart3,
  ScrollText,
  AlertTriangle,
  LogOut,
  ChevronRight,
  Home,
  Video,
  Wallet,
  Coins,
  Telescope,
  PenTool,
  UsersRound,
  Funnel,
  Download,
} from 'lucide-react';

const NAV_ITEMS = [
  // Admin nav
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin','admin'] },
  { href: '/command-center', label: 'Command Center', icon: Telescope, roles: ['super_admin','admin'] },
  { href: '/crm', label: 'Lead CRM', icon: Funnel, roles: ['super_admin','admin'] },
  { href: '/students', label: 'Students', icon: Users, roles: ['super_admin','admin'] },
  { href: '/tutors', label: 'Tutors', icon: GraduationCap, roles: ['super_admin','admin'] },
  { href: '/subjects', label: 'Subjects', icon: BookOpen, roles: ['super_admin','admin'] },
  { href: '/tests', label: 'Tests', icon: PenTool, roles: ['super_admin','admin'] },
  { href: '/ptm', label: 'PTMs', icon: UsersRound, roles: ['super_admin','admin'] },
  { href: '/enrollments', label: 'Enrollments', icon: ClipboardList, roles: ['super_admin','admin'] },
  { href: '/sessions', label: 'Class Sessions', icon: CalendarDays, roles: ['super_admin','admin'] },
  { href: '/attendance', label: 'Attendance', icon: BarChart3, roles: ['super_admin','admin'] },
  { href: '/unmapped', label: 'Unmapped Queue', icon: AlertTriangle, roles: ['super_admin','admin'] },
  { href: '/reports', label: 'Reports', icon: Download, roles: ['super_admin','admin'] },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['super_admin','admin'] },
  { href: '/fees', label: 'Fees', icon: Wallet, roles: ['super_admin','admin'] },
  { href: '/salaries', label: 'Salaries', icon: Coins, roles: ['super_admin','admin'] },
  
  // Tutor nav
  { href: '/tutor', label: 'Overview', icon: Home, roles: ['tutor'] },
  { href: '/tutor/students', label: 'My Students', icon: Users, roles: ['tutor'] },
  { href: '/tutor/schedule', label: 'Schedule', icon: CalendarDays, roles: ['tutor'] },
  { href: '/tutor/classes', label: 'My Classes', icon: Video, roles: ['tutor'] },
  { href: '/tutor/tests', label: 'Tests', icon: PenTool, roles: ['tutor'] },
  { href: '/tutor/ptm', label: 'PTMs', icon: UsersRound, roles: ['tutor'] },
  { href: '/tutor/earnings', label: 'Earnings', icon: Wallet, roles: ['tutor'] },

  // Student nav
  { href: '/student', label: 'Overview', icon: Home, roles: ['student'] },
  { href: '/student/schedule', label: 'Schedule', icon: CalendarDays, roles: ['student'] },
  { href: '/student/attendance', label: 'Attendance', icon: BarChart3, roles: ['student'] },
  { href: '/student/tests', label: 'Tests', icon: PenTool, roles: ['student'] },
  { href: '/student/ptm', label: 'PTMs', icon: UsersRound, roles: ['student'] },
  { href: '/student/recordings', label: 'Recordings', icon: Video, roles: ['student'] },
  { href: '/student/fees', label: 'Fees', icon: Wallet, roles: ['student'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role ?? ''));

  const initials = (user?.displayName ?? user?.email ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark">Tutrain</div>
        <div className="logo-sub">Management Portal</div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Navigation</div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/student'
            ? pathname === '/student'
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon className="icon" size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="name truncate">{user?.email}</div>
            <div className="role-badge">{role?.replace('_', ' ')}</div>
          </div>
          <button
            className="btn-icon"
            onClick={() => logout()}
            title="Sign out"
            style={{ border: 'none', background: 'transparent', padding: 4 }}
          >
            <LogOut size={14} color="var(--text-muted)" />
          </button>
        </div>
      </div>
    </aside>
  );
}
