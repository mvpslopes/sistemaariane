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
import ReceivablesCollectionPage from './pages/app/ReceivablesCollectionPage';
import CompanyFinancePage from './pages/app/CompanyFinancePage';
import SubscriptionsPage from './pages/app/SubscriptionsPage';
import AnimalDetailPage from './pages/app/AnimalDetailPage';
import ReproductionPage from './pages/app/ReproductionPage';
import DailyReportsPage from './pages/app/DailyReportsPage';
import DailyReportFormPage from './pages/app/DailyReportFormPage';
import ChatPage from './pages/app/ChatPage';
import RootPanelPage from './pages/app/RootPanelPage';
import HarasModulePage from './pages/app/HarasModulePage';
import HelpPage from './pages/app/HelpPage';
import { Warehouse, Home, Stethoscope, Wallet } from 'lucide-react';
import ChangePassword from './pages/ChangePassword';
import ProfilePage from './pages/app/ProfilePage';
import SessionWarning from './components/SessionWarning';
import ProtectedRoute from './components/ProtectedRoute';
import SystemWrapper from './components/SystemWrapper';
import AppShell from './components/AppShell';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import SignPage from './pages/SignPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { isPublicSiteHost, redirectToSistema } from './constants/systemUrls';
import { AI_ASSISTANT_ENABLED } from './constants/featureFlags';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/app' : '/login'} replace />;
}

function HomeRoute() {
  if (isPublicSiteHost()) {
    return <LandingPage />;
  }
  return <RootRedirect />;
}

function SistemaExternalRedirect({ path }: { path: string }) {
  useEffect(() => {
    redirectToSistema(path);
  }, [path]);
  return null;
}

function RequireSistemaHost({ children }: { children: React.ReactNode }) {
  if (isPublicSiteHost()) {
    const path = window.location.pathname || '/login';
    return <SistemaExternalRedirect path={path} />;
  }
  return <>{children}</>;
}

function LoginRoute() {
  if (isPublicSiteHost()) {
    return <SistemaExternalRedirect path="/login" />;
  }
  return (
    <SystemWrapper>
      <Login />
    </SystemWrapper>
  );
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
        <Route path="/" element={<HomeRoute />} />

        <Route path="/login" element={<LoginRoute />} />

        {/* Assinatura incorporada Clicksign — pública, sem login */}
        <Route path="/assinar/:signerKey" element={<SignPage />} />

        <Route
          path="/app/contratos/imprimir/:id"
          element={
            <RequireSistemaHost>
              <SystemWrapper>
                <ProtectedRoute>
                  <ContractPrintView />
                </ProtectedRoute>
              </SystemWrapper>
            </RequireSistemaHost>
          }
        />

        <Route
          path="/app"
          element={
            <RequireSistemaHost>
              <SystemWrapper>
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              </SystemWrapper>
            </RequireSistemaHost>
          }
        >
          <Route index element={<AppDashboard />} />
          <Route
            path="root"
            element={
              <ProtectedRoute roles={['root']}>
                <RootPanelPage />
              </ProtectedRoute>
            }
          />
          <Route path="mensagens" element={<ChatPage />} />
          <Route path="mensagens/:threadId" element={<ChatPage />} />
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
          <Route
            path="haras/estoque"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <HarasModulePage
                  title="Controle de estoque"
                  description="Medicamentos, insumos, ração e materiais do haras — em breve neste módulo."
                  icon={Warehouse}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="haras/hospedagem"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <HarasModulePage
                  title="Controle de hospedagem"
                  description="Animais hospedados, diárias e ocupação de baias — em breve neste módulo."
                  icon={Home}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="haras/financeiro"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <HarasModulePage
                  title="Controle financeiro do haras"
                  description="Receitas, despesas e fluxo de caixa por propriedade — em breve neste módulo."
                  icon={Wallet}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="haras/veterinario"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <HarasModulePage
                  title="Controle veterinário"
                  description="Vacinas, vermífugos, exames e histórico sanitário — em breve neste módulo."
                  icon={Stethoscope}
                />
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
            path="relatorio-cobranca"
            element={
              <ProtectedRoute roles={['root', 'admin', 'user']}>
                <ReceivablesCollectionPage />
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
          <Route
            path="ajuda"
            element={
              AI_ASSISTANT_ENABLED ? (
                <Navigate to="/app?assistente=1" replace />
              ) : (
                <HelpPage />
              )
            }
          />
          <Route path="alterar-senha" element={<ChangePassword />} />
        </Route>

        {/* Compatibilidade com rotas antigas */}
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/alterar-senha" element={<Navigate to="/app/alterar-senha" replace />} />

        <Route
          path="*"
          element={
            isPublicSiteHost() ? <Navigate to="/" replace /> : <Navigate to="/login" replace />
          }
        />
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
