import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getDailyReports, exportToExcel } from '../services/dailyReportService';
import * as apiService from '../services/apiService';
import { LogOut, FileText, Calendar, User, TrendingUp, AlertCircle, CheckCircle, Download, Key, Trash2 } from 'lucide-react';
import Loading from '../components/Loading';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAriane = user?.name === 'Ariane';

  // Carregar relatórios quando a página é carregada
  useEffect(() => {
    const loadReports = async () => {
      try {
        // Se for Ariane, buscar todos. Caso contrário, buscar apenas da colaboradora
        const colaboradora = isAriane ? undefined : user?.name;
        const data = await getDailyReports(colaboradora);
        setReports(data);
      } catch (error) {
        console.error('Erro ao carregar relatórios:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadReports();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(() => {
      loadReports();
    }, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [user, isAriane]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const myReports = reports.filter((r: any) => r.colaboradora === user?.name);
  const allReports = reports; // Todos os registros para exportação da Ariane

  const handleExportExcel = () => {
    if (isAriane) {
      exportToExcel(allReports);
    }
  };

  const handleDeleteReport = async (reportId: string, reportColaboradora: string) => {
    // Verificar permissão: apenas o próprio autor ou Ariane pode deletar
    if (user?.name !== reportColaboradora && !isAriane) {
      alert('Você não tem permissão para deletar este registro.');
      return;
    }

    // Confirmação
    const confirmMessage = isAriane 
      ? `Tem certeza que deseja deletar o registro de ${reportColaboradora}?`
      : 'Tem certeza que deseja deletar este registro? Esta ação não pode ser desfeita.';
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await apiService.deleteReport(reportId, user?.name || '');
      // Recarregar os registros
      const colaboradora = isAriane ? undefined : user?.name;
      const data = await getDailyReports(colaboradora);
      setReports(data);
      alert('Registro deletado com sucesso!');
    } catch (error: any) {
      alert(error.message || 'Erro ao deletar registro. Tente novamente.');
    }
  };

  if (isLoading) {
    return <Loading fullScreen message="Carregando dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige via-brand-off-white to-white animate-fade-in">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm shadow-soft-lg border-b border-brand-olive/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FileText className="w-8 h-8 text-brand-olive" />
            <div>
              <h1 className="text-xl font-bold text-brand-brown">Sistema Interno</h1>
              <p className="text-sm text-brand-olive/70">Bem-vinda, {user?.name}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/alterar-senha')}
              className="flex items-center gap-2 px-4 py-2 text-brand-brown hover:bg-brand-beige/50 rounded-lg transition-all"
              title="Alterar senha"
            >
              <Key className="w-5 h-5" />
              <span className="hidden md:inline">Alterar Senha</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-brand-brown hover:bg-brand-beige/50 rounded-lg transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Cards de Estatísticas */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-soft-lg border border-brand-olive/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-brand-olive/70">Meus Registros</h3>
              <FileText className="w-5 h-5 text-brand-olive" />
            </div>
            <p className="text-3xl font-bold text-brand-brown">{myReports.length}</p>
            <p className="text-xs text-brand-olive/60 mt-2">Total de registros</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-soft-lg border border-brand-olive/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-brand-olive/70">Último Registro</h3>
              <Calendar className="w-5 h-5 text-brand-olive" />
            </div>
            <p className="text-lg font-bold text-brand-brown">
              {myReports.length > 0
                ? new Date(myReports[myReports.length - 1].timestamp).toLocaleDateString('pt-BR')
                : 'Nenhum'}
            </p>
            <p className="text-xs text-brand-olive/60 mt-2">Data do último registro</p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-soft-lg border border-brand-olive/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-brand-olive/70">Status Hoje</h3>
              {myReports.some((r: any) => {
                const today = new Date().toLocaleDateString('pt-BR');
                return r.data === today;
              }) ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-500" />
              )}
            </div>
            <p className="text-lg font-bold text-brand-brown">
              {myReports.some((r: any) => {
                const today = new Date().toLocaleDateString('pt-BR');
                return r.data === today;
              })
                ? 'Registrado'
                : 'Pendente'}
            </p>
            <p className="text-xs text-brand-olive/60 mt-2">Registro de hoje</p>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => navigate('/registro')}
            className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-brand-brown to-brand-olive text-white rounded-lg font-semibold hover:from-brand-brown/90 hover:to-brand-olive/90 transition-all duration-200 shadow-soft-lg hover:shadow-soft-xl flex items-center justify-center gap-2"
          >
            <FileText className="w-5 h-5" />
            Novo Registro Diário
          </button>
          
          {isAriane && (
            <button
              onClick={handleExportExcel}
              className="w-full md:w-auto px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-soft-lg hover:shadow-soft-xl flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Exportar Todos os Registros (XLSX)
            </button>
          )}
        </div>

        {/* Histórico de Registros */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-soft-lg border border-brand-olive/20 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-brand-brown flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              {isAriane ? 'Todos os Registros' : 'Meu Histórico de Registros'}
            </h2>
            {isAriane && (
              <span className="text-sm text-brand-olive/70 bg-brand-beige/30 px-3 py-1 rounded-full">
                {allReports.length} registros totais
              </span>
            )}
          </div>

          {(isAriane ? allReports : myReports).length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-brand-olive/30 mx-auto mb-4" />
              <p className="text-brand-olive/70">Nenhum registro encontrado.</p>
              <p className="text-sm text-brand-olive/60 mt-2">
                Clique em "Novo Registro Diário" para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(isAriane ? allReports : myReports)
                .slice()
                .reverse()
                .map((report: any) => (
                  <div
                    key={report.id}
                    className="bg-brand-beige/30 rounded-lg p-6 border border-brand-olive/20"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-brand-olive" />
                          <span className="font-semibold text-brand-brown">{report.data}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-brand-olive/70" />
                          <span className="text-sm text-brand-olive/70">{report.colaboradora}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-brand-olive/60">
                          {new Date(report.timestamp).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {/* Botão de deletar - apenas para o próprio autor ou Ariane */}
                        {(user?.name === report.colaboradora || isAriane) && (
                          <button
                            onClick={() => handleDeleteReport(report.id, report.colaboradora)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deletar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-brand-olive/70">Atendimentos: </span>
                        <span className="text-brand-brown font-medium">{report.numAtendimentos}</span>
                      </div>
                      <div>
                        <span className="text-brand-olive/70">Autoavaliação: </span>
                        <span className="text-brand-brown font-medium">{report.autoavaliacao}</span>
                      </div>
                      {report.clientesPendentes && (
                        <div className="md:col-span-2">
                          <span className="text-brand-olive/70">Pendências: </span>
                          <span className="text-brand-brown">{report.clientesPendentes}</span>
                        </div>
                      )}
                      {report.compromissosAmanha && (
                        <div className="md:col-span-2">
                          <span className="text-brand-olive/70">Compromissos: </span>
                          <span className="text-brand-brown">{report.compromissosAmanha}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

