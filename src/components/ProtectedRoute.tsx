import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../services/apiService';
import Loading from './Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
  assessorOnly?: boolean;
}

export default function ProtectedRoute({ children, roles, assessorOnly }: ProtectedRouteProps) {
  const { isAuthenticated, user, authChecking } = useAuth();

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-off-white">
        <Loading message="Validando sessão..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login?expired=1" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  if (assessorOnly && !user.isAssessor) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
