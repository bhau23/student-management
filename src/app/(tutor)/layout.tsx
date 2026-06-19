'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
    // If logged in but not a tutor, send to the admin dashboard
    if (!loading && user && role !== 'tutor') {
      router.replace('/dashboard');
    }
  }, [user, loading, role, router]);

  if (loading) {
    return (
      <div className="loading-full" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user || role !== 'tutor') return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
