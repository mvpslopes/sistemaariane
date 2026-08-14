import AppDashboard from './pages/app/AppDashboard';
import ClientsPage from './pages/app/ClientsPage';
import AnimalsPage from './pages/app/AnimalsPage';
import UsersPage from './pages/app/UsersPage';
import ContractsPage from './pages/app/ContractsPage';
import ChargesPage from './pages/app/ChargesPage';
import PayoutsPage from './pages/app/PayoutsPage';
import ContractTemplatesPage from './pages/app/ContractTemplatesPage';
import ContractPrintView from './pages/app/ContractPrintView';
import EventsPage from './pages/app/EventsPage';
import AuditPage from './pages/app/AuditPage';
import ReceivablesPage from './pages/app/ReceivablesPage';
import CompanyFinancePage from './pages/app/CompanyFinancePage';
import SubscriptionsPage from './pages/app/SubscriptionsPage';
import AnimalDetailPage from './pages/app/AnimalDetailPage';
import ReproductionPage from './pages/app/ReproductionPage';
import DailyReportsPage from './pages/app/DailyReportsPage';
import DailyReportFormPage from './pages/app/DailyReportFormPage';
import HelpPage from './pages/app/HelpPage';
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
import { ThemeProvider } from './contexts/ThemeContext';
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
          <Route path="animais/:id" element={<AnimalDetailPage />} />
          <Route
            path="reproducao"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ReproductionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="registro-diario"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <DailyReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="registro-diario/novo"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <DailyReportFormPage />
              </ProtectedRoute>
            }
          />
          <Route path="leiloes" element={<EventsPage />} />
          <Route path="eventos" element={<Navigate to="/app/leiloes" replace />} />
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
            path="recebiveis"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ReceivablesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="financeiro-empresa"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <CompanyFinancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="assinaturas"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <SubscriptionsPage />
              </ProtectedRoute>
            }
          />
          <Route path="repasses" element={<PayoutsPage />} />
          <Route
            path="usuarios"
            element={
              <ProtectedRoute roles={['root', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="auditoria"
            element={
              <ProtectedRoute roles={['root', 'admin']}>
                <AuditPage />
              </ProtectedRoute>
            }
          />
          <Route path="perfil" element={<ProfilePage />} />
          <Route path="ajuda" element={<HelpPage />} />
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
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
