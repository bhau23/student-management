import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that don't require auth
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API routes to handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for Firebase session cookie
  // Note: Firebase Auth is client-side; we use a session cookie set by the app.
  // For full SSR protection, implement a session cookie with the Admin SDK.
  // For now, client-side AuthProvider handles redirects.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
