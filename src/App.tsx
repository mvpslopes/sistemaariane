import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SystemWrapper from './components/SystemWrapper';
import LandingPage from './pages/LandingPage';
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
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Sistema Interno - com Splash Screen */}
        <Route
          path="/login"
          element={
            <SystemWrapper>
              <Login />
            </SystemWrapper>
          }
        />
        
        {/* Rotas protegidas - com Splash Screen */}
        <Route
          path="/dashboard"
          element={
            <SystemWrapper>
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            </SystemWrapper>
          }
        />
        <Route
          path="/registro"
          element={
            <SystemWrapper>
              <ProtectedRoute>
                <DailyReportForm />
              </ProtectedRoute>
            </SystemWrapper>
          }
        />
        <Route
          path="/alterar-senha"
          element={
            <SystemWrapper>
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            </SystemWrapper>
          }
        />
        
        {/* Redirecionar rotas não encontradas para landing page */}
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

