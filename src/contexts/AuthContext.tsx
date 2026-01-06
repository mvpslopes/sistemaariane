import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import * as apiService from '../services/apiService';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Em produção, isso seria hash
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
  resetInactivityTimer: () => void;
  timeRemaining: number; // Tempo restante em segundos
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Tempo de inatividade para logout automático (30 minutos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos em milissegundos

// Usuários hardcoded removidos - agora sempre busca do banco de dados via API

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    // Verificar se há usuário salvo no localStorage
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [timeRemaining, setTimeRemaining] = useState(INACTIVITY_TIMEOUT / 1000);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setTimeRemaining(0);
  };

  const resetInactivityTimer = () => {
    // Limpar timers anteriores
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // Se o usuário estiver autenticado, criar novo timer
    if (user) {
      lastActivityRef.current = Date.now();
      setTimeRemaining(INACTIVITY_TIMEOUT / 1000);

      // Timer de logout
      inactivityTimerRef.current = setTimeout(() => {
        logout();
        window.location.href = '/';
      }, INACTIVITY_TIMEOUT);

      // Timer de contagem regressiva
      countdownTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastActivityRef.current;
        const remaining = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
        setTimeRemaining(Math.floor(remaining / 1000));

        if (remaining <= 0) {
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
          }
        }
      }, 1000);
    } else {
      setTimeRemaining(0);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const API_URL = import.meta.env.VITE_API_URL;
    
    // Sempre tentar login via API (MySQL) - sem fallback para dados hardcoded
    if (API_URL) {
      try {
        const response = await apiService.login(email, password);
        if (response.success && response.user) {
          const user: User = {
            id: response.user.id,
            name: response.user.name,
            email: response.user.email,
            password: '', // Não armazenar senha
          };
          setUser(user);
          localStorage.setItem('user', JSON.stringify(user));
          resetInactivityTimer();
          return true;
        }
      } catch (error) {
        console.error('Erro no login via API:', error);
        return false;
      }
    }

    // Se não houver API configurada, retornar erro
    console.error('API não configurada. Configure VITE_API_URL no .env');
    return false;
  };

  // Configurar eventos de atividade do usuário
  useEffect(() => {
    if (user) {
      resetInactivityTimer();

      // Eventos que indicam atividade do usuário
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        resetInactivityTimer();
      };

      events.forEach((event) => {
        window.addEventListener(event, handleActivity);
      });

      return () => {
        events.forEach((event) => {
          window.removeEventListener(event, handleActivity);
        });
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
        }
      };
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, resetInactivityTimer, timeRemaining }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

