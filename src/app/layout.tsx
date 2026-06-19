import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import SetupBanner from '@/components/SetupBanner';

export const metadata: Metadata = {
  title: 'Tutrain — Tutoring Management Platform',
  description: 'Admin portal for managing 1:1 tutoring sessions, students, tutors, enrollments, and attendance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <AuthProvider>
          {children}
          <SetupBanner />
        </AuthProvider>
      </body>
    </html>
  );
}

