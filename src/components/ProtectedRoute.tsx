import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../services/apiService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: Role[];
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
