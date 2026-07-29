import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import SystemWrapper from './components/SystemWrapper';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import AppDashboard from './pages/app/AppDashboard';
import ClientsPage from './pages/app/ClientsPage';
import AnimalsPage from './pages/app/AnimalsPage';
import UsersPage from './pages/app/UsersPage';
import ChangePassword from './pages/ChangePassword';
import SessionWarning from './components/SessionWarning';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/app' : '/login'} replace />;
}

function AppContent() {
  const { isAuthenticated, timeRemaining, resetInactivityTimer, logout } = useAuth();
  const navigate = useNavigate();

  const handleExtendSession = () => {
    resetInactivityTimer();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <Routes>
        {/* Subdomínio sistema: entrada = login (não landing) */}
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <SystemWrapper>
              <Login />
            </SystemWrapper>
          }
        />

        <Route
          path="/app"
          element={
            <SystemWrapper>
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            </SystemWrapper>
          }
        >
          <Route index element={<AppDashboard />} />
          <Route
            path="clientes"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route path="clientes/:id" element={<Navigate to="/app/clientes" replace />} />
          <Route path="animais" element={<AnimalsPage />} />
          <Route path="animais/:id" element={<Navigate to="/app/animais" replace />} />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute roles={['root', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route path="alterar-senha" element={<ChangePassword />} />
        </Route>

        {/* Compatibilidade com rotas antigas */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/alterar-senha" element={<Navigate to="/app/alterar-senha" replace />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

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
      <ToastProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
