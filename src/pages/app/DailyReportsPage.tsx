import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  deleteReport,
  exportToExcel,
  getDailyReports,
  getTodayDailyReportStatus,
  type DailyReportItem,
} from '../../services/dailyReportService';
import { formatDateBR, formatDateTimeBR, todayDateISO } from '../../utils/dateTime';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import { Skeleton } from '../../components/Skeleton';

export default function DailyReportsPage() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const isManager = hasRole('root', 'admin');

  const [reports, setReports] = useState<DailyReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySubmitted, setTodaySubmitted] = useState<boolean | null>(null);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<DailyReportItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, today] = await Promise.all([
        getDailyReports(),
        getTodayDailyReportStatus(),
      ]);
      setReports(list);
      setTodaySubmitted(today.submitted);
    } catch (err: any) {
      toastError(err.message || 'Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleReports = useMemo(() => {
    const base = isManager ? reports : reports.filter((r) => r.userId === user?.id || r.colaboradora === user?.name);
    if (!isManager || !search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((r) => r.colaboradora.toLowerCase().includes(q));
  }, [reports, isManager, user?.id, user?.name, search]);

  const myReports = visibleReports;

  const todayIso = todayDateISO();
  const hasToday = myReports.some((r) => r.data === todayIso);

  const handleDelete = async (report: DailyReportItem) => {
    const own = report.userId === user?.id;
    if (!own && !isManager) {
      toastError('Você não pode excluir este registro');
      return;
    }
    const ok = window.confirm(
      isManager && !own
        ? `Excluir o registro de ${report.colaboradora} em ${report.dataLabel || report.data}?`
        : 'Excluir este registro? Esta ação não pode ser desfeita.'
    );
    if (!ok) return;

    setDeletingId(report.id);
    try {
      await deleteReport(report.id);
      success('Registro excluído');
      setDetail(null);
      await load();
    } catch (err: any) {
      toastError(err.message || 'Erro ao excluir');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = () => {
    try {
      exportToExcel(isManager ? reports : myReports);
      success('Planilha exportada');
    } catch (err: any) {
      toastError(err.message || 'Erro ao exportar');
    }
  };

  if (loading && reports.length === 0) {
    return <Loading message="Carregando registros diários..." />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-brand-dark-brown">Registro diário</h2>
          <p className="mt-1 text-sm text-brand-olive">
            {isManager
              ? 'Acompanhamento da equipe — preenchimento ao final do expediente'
              : 'Seu registro de atendimento ao final do expediente'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager && (
            <AppButton variant="secondary" onClick={handleExport} disabled={reports.length === 0}>
              <Download className="h-4 w-4" />
              Exportar XLSX
            </AppButton>
          )}
          <AppButton
            onClick={() => navigate('/app/registro-diario/novo')}
            disabled={!isManager && (todaySubmitted || hasToday)}
          >
            <Plus className="h-4 w-4" />
            {todaySubmitted || hasToday ? 'Registro de hoje feito' : 'Novo registro'}
          </AppButton>
        </div>
      </div>

      {!isManager && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            todaySubmitted || hasToday
              ? 'border-brand-forest/30 bg-brand-forest/5'
              : 'border-amber-300/50 bg-amber-50/80'
          }`}
        >
          {todaySubmitted || hasToday ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-forest" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="font-medium text-brand-dark-brown">
              {todaySubmitted || hasToday
                ? 'Registro de hoje concluído'
                : 'Registro de hoje pendente'}
            </p>
            <p className="mt-0.5 text-sm text-brand-olive">
              {todaySubmitted || hasToday
                ? 'Obrigado por registrar seu atendimento.'
                : 'Preencha o formulário antes de encerrar o expediente.'}
            </p>
          </div>
        </div>
      )}

      {isManager && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por colaboradora..."
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label={isManager ? 'Total da equipe' : 'Meus registros'}
          value={String(isManager ? visibleReports.length : myReports.length)}
        />
        <StatCard
          icon={Calendar}
          label="Último registro"
          value={
            (isManager ? visibleReports : myReports)[0]
              ? formatDateBR((isManager ? visibleReports : myReports)[0].data)
              : '—'
          }
        />
        <StatCard
          icon={ClipboardList}
          label="Status hoje"
          value={todaySubmitted || hasToday ? 'OK' : 'Pendente'}
        />
      </div>

      <section className="rounded-2xl border border-brand-beige bg-white shadow-card">
        <div className="border-b border-brand-beige px-4 py-3 sm:px-5">
          <h3 className="font-semibold text-brand-dark-brown">
            {isManager ? 'Todos os registros' : 'Meu histórico'}
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-16 w-full" rounded="xl" />
            <Skeleton className="h-16 w-full" rounded="xl" />
          </div>
        ) : (isManager ? visibleReports : myReports).length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <FileText className="mx-auto h-12 w-12 text-brand-olive/30" />
            <p className="mt-3 text-sm text-brand-olive">Nenhum registro encontrado.</p>
            {!isManager && (
              <Link
                to="/app/registro-diario/novo"
                className="mt-2 inline-block text-sm font-medium text-brand-brown hover:underline"
              >
                Fazer primeiro registro
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-brand-beige/70">
            {(isManager ? visibleReports : myReports).map((report) => (
              <li key={report.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-dark-brown">
                      {report.dataLabel || formatDateBR(report.data)}
                    </span>
                    {report.data === todayIso && (
                      <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-brown">
                        Hoje
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-olive">
                    {isManager && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {report.colaboradora}
                      </span>
                    )}
                    <span>Atendimentos: {report.numAtendimentos}</span>
                    <span>Autoavaliação: {report.autoavaliacao}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDetail(report)}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-beige px-2.5 py-1.5 text-xs text-brand-brown hover:bg-brand-off-white"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver
                  </button>
                  {(isManager || report.userId === user?.id) && (
                    <button
                      type="button"
                      disabled={deletingId === report.id}
                      onClick={() => handleDelete(report)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={!!detail}
        title="Detalhe do registro"
        subtitle={detail ? `${detail.colaboradora} · ${detail.dataLabel || formatDateBR(detail.data)}` : undefined}
        onClose={() => setDetail(null)}
        size="lg"
      >
        {detail && (
          <div className="space-y-4 text-sm">
            <DetailRow label="Atendimentos" value={detail.numAtendimentos} />
            <DetailRow label="Autoavaliação" value={detail.autoavaliacao} />
            <DetailRow
              label="Clientes respondidos"
              value={detail.todosClientesRespondidos ? 'Sim' : 'Não'}
            />
            {detail.clientesPendentes && (
              <DetailRow label="Pendências" value={detail.clientesPendentes} />
            )}
            <DetailRow
              label="Ocorrências"
              value={
                detail.ocorrencias.nenhumaCritica
                  ? 'Nenhuma situação crítica'
                  : [
                      detail.ocorrencias.clienteIrritado && 'Cliente irritado',
                      detail.ocorrencias.cobrancaIndevida && 'Cobrança indevida',
                      detail.ocorrencias.questionamentoFinanceiro && 'Questionamento financeiro',
                      detail.ocorrencias.contestacaoRegras && 'Contestação de regras',
                      detail.ocorrencias.escaladoGestao && 'Escalado à gestão',
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
              }
            />
            {(detail.suporteGestao || detail.suporteColegas) && (
              <DetailRow
                label="Suporte acionado"
                value={`${detail.suporteGestao ? 'Gestão' : ''}${detail.suporteGestao && detail.suporteColegas ? ' · ' : ''}${detail.suporteColegas ? 'Colegas' : ''}${detail.motivoSuporte ? ` — ${detail.motivoSuporte}` : ''}`}
              />
            )}
            {detail.compromissosAmanha && (
              <DetailRow label="Compromissos amanhã" value={detail.compromissosAmanha} />
            )}
            <DetailRow
              label="Registrado em"
              value={detail.timestamp ? formatDateTimeBR(detail.timestamp) : '—'}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</span>
        <Icon className="h-4 w-4 text-brand-olive/60" />
      </div>
      <p className="text-xl font-semibold text-brand-dark-brown">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</dt>
      <dd className="mt-1 text-brand-dark-brown">{value}</dd>
    </div>
  );
}
