import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DailyReportForm from './pages/DailyReportForm';
import ChangePassword from './pages/ChangePassword';
import SessionWarning from './components/SessionWarning';

function AppContent() {
  const { isAuthenticated, timeRemaining, resetInactivityTimer, logout } = useAuth();
  const navigate = useNavigate();

  const handleExtendSession = () => {
    resetInactivityTimer();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <Routes>
        {/* Login */}
        <Route path="/" element={<Login />} />
        
        {/* Rotas protegidas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/registro"
          element={
            <ProtectedRoute>
              <DailyReportForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/alterar-senha"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        
        {/* Redirecionar rotas não encontradas para login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Aviso de sessão expirando */}
      {isAuthenticated && (
        <SessionWarning
          onExtend={handleExtendSession}
          onLogout={handleLogout}
          timeRemaining={timeRemaining}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

