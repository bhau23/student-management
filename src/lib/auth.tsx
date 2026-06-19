'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { UserRole } from '@/lib/types';

interface AuthUser extends User {
  role?: UserRole;
  linkedId?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  role: UserRole | null;
  linkedId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTutor: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Always force-refresh to get latest custom claims
        const tokenResult = await getIdTokenResult(firebaseUser, true);
        const claims = tokenResult.claims as { role?: UserRole; linkedId?: string };
        const enriched = firebaseUser as AuthUser;
        enriched.role = claims.role;
        enriched.linkedId = claims.linkedId;
        setUser(enriched);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        role,
        linkedId: user?.linkedId ?? null,
        login,
        logout,
        isAdmin: role === 'admin' || role === 'super_admin',
        isSuperAdmin: role === 'super_admin',
        isTutor: role === 'tutor',
        isStudent: role === 'student',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
