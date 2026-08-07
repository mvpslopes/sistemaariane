import AppDashboard from './pages/app/AppDashboard';
import ClientsPage from './pages/app/ClientsPage';
import AnimalsPage from './pages/app/AnimalsPage';
import UsersPage from './pages/app/UsersPage';
import ContractsPage from './pages/app/ContractsPage';
import ChargesPage from './pages/app/ChargesPage';
import AuctionsPage from './pages/app/AuctionsPage';
import PayoutsPage from './pages/app/PayoutsPage';
import ContractTemplatesPage from './pages/app/ContractTemplatesPage';
import ContractPrintView from './pages/app/ContractPrintView';
import ChangePassword from './pages/ChangePassword';
import ProfilePage from './pages/app/ProfilePage';
import SessionWarning from './components/SessionWarning';
import ProtectedRoute from './components/ProtectedRoute';
import SystemWrapper from './components/SystemWrapper';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import SignPage from './pages/SignPage';
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

        {/* Assinatura incorporada Clicksign — pública, sem login */}
        <Route path="/assinar/:signerKey" element={<SignPage />} />

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
            path="pessoas"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          <Route path="pessoas/:id" element={<Navigate to="/app/pessoas" replace />} />
          {/* Compatibilidade com rotas antigas de papéis */}
          <Route path="clientes" element={<Navigate to="/app/pessoas" replace />} />
          <Route path="clientes/:id" element={<Navigate to="/app/pessoas" replace />} />
          <Route path="compradores" element={<Navigate to="/app/pessoas" replace />} />
          <Route path="vendedores" element={<Navigate to="/app/pessoas" replace />} />
          <Route path="assessores" element={<Navigate to="/app/pessoas" replace />} />
          <Route path="animais" element={<AnimalsPage />} />
          <Route path="animais/:id" element={<Navigate to="/app/animais" replace />} />
          <Route
            path="leiloes"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <AuctionsPage />
              </ProtectedRoute>
            }
          />
          <Route path="contratos" element={<ContractsPage />} />
          <Route
            path="modelos-contrato"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ContractTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route path="cobrancas" element={<ChargesPage />} />
          <Route
            path="repasses"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <PayoutsPage />
              </ProtectedRoute>
            }
          />
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
