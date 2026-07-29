import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import * as api from '../services/apiService';
import type { AuthUser, Role } from '../services/apiService';

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: Role[]) => boolean;
  canWrite: boolean;
  canManageUsers: boolean;
  resetInactivityTimer: () => void;
  timeRemaining: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT / 1000);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setTimeRemaining(0);
  };

  const resetInactivityTimer = () => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);

    if (user) {
      lastActivityRef.current = Date.now();
      setTimeRemaining(INACTIVITY_TIMEOUT / 1000);

      inactivityTimerRef.current = setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, INACTIVITY_TIMEOUT);

      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
        setTimeRemaining(Math.floor(remaining / 1000));
        if (remaining <= 0 && countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      }, 1000);
    } else {
      setTimeRemaining(0);
    }
  };

  const login = async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const response = await api.login(username, password);
      if (response.success && response.user && response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        return { ok: true };
      }
      return { ok: false, error: 'Usuário ou senha incorretos. Tente novamente.' };
    } catch (error) {
      console.error('Erro no login:', error);
      const message =
        error instanceof Error ? error.message : 'Erro ao fazer login. Tente novamente.';
      return { ok: false, error: message };
    }
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);
  const canWrite = hasRole('root', 'admin', 'user');
  const canManageUsers = hasRole('root', 'admin');

  useEffect(() => {
    if (!user) return;

    resetInactivityTimer();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handleActivity));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        hasRole,
        canWrite,
        canManageUsers,
        resetInactivityTimer,
        timeRemaining,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
