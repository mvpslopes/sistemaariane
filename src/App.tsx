import AppDashboard from './pages/app/AppDashboard';
import ClientsPage from './pages/app/ClientsPage';
import AnimalsPage from './pages/app/AnimalsPage';
import UsersPage from './pages/app/UsersPage';
import ContractsPage from './pages/app/ContractsPage';
import ChargesPage from './pages/app/ChargesPage';
import ContractPrintView from './pages/app/ContractPrintView';
import ChangePassword from './pages/ChangePassword';
import ProfilePage from './pages/app/ProfilePage';
import SessionWarning from './components/SessionWarning';
import ProtectedRoute from './components/ProtectedRoute';
import SystemWrapper from './components/SystemWrapper';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

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
          path="/app/contratos/imprimir/:id"
          element={
            <SystemWrapper>
              <ProtectedRoute>
                <ContractPrintView />
              </ProtectedRoute>
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
            path="compradores"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage partyRole="buyer" />
              </ProtectedRoute>
            }
          />
          <Route
            path="vendedores"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage partyRole="seller" />
              </ProtectedRoute>
            }
          />
          <Route
            path="assessores"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage partyRole="assessor" />
              </ProtectedRoute>
            }
          />
          <Route
            path="clientes"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage partyRole="all" />
              </ProtectedRoute>
            }
          />
          <Route path="clientes/:id" element={<Navigate to="/app/clientes" replace />} />
          <Route path="animais" element={<AnimalsPage />} />
          <Route path="animais/:id" element={<Navigate to="/app/animais" replace />} />
          <Route path="contratos" element={<ContractsPage />} />
          <Route path="cobrancas" element={<ChargesPage />} />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute roles={['root', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route path="perfil" element={<ProfilePage />} />
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
