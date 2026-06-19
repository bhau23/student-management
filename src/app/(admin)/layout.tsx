'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    // If logged in but a student, send them to student dashboard
    if (!loading && user && role === 'student') {
      router.replace('/student');
    }
    // If logged in but a tutor, send them to tutor dashboard
    if (!loading && user && role === 'tutor') {
      router.replace('/tutor');
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <div className="loading-full" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
