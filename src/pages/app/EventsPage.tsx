import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuctionsPage from './AuctionsPage';
import AssessorEventsPage from './AssessorEventsPage';

/** Staff vê gestão de leilões; assessor no portal vê seus eventos. */
export default function EventsPage() {
  const { user, hasRole } = useAuth();
  const isAssessorPortal = hasRole('cliente') && !!user?.isAssessor;

  if (isAssessorPortal) return <AssessorEventsPage />;
  if (hasRole('root', 'admin', 'user')) return <AuctionsPage />;
  return <Navigate to="/app" replace />;
}
