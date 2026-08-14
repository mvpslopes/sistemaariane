import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, FileText, Save, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ATTENDANCE_BANDS,
  OCORRENCIA_OPTIONS,
  SELF_RATINGS,
  getTodayDailyReportStatus,
  saveDailyReport,
  type DailyReport,
} from '../../services/dailyReportService';
import { formatDateBR, todayDateISO } from '../../utils/dateTime';
import AppButton from '../../components/AppButton';
import Loading from '../../components/Loading';

const defaultOcorrencias = {
  clienteIrritado: false,
  cobrancaIndevida: false,
  questionamentoFinanceiro: false,
  contestacaoRegras: false,
  escaladoGestao: false,
  nenhumaCritica: true,
};

export default function DailyReportFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [checking, setChecking] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState<Partial<DailyReport>>({
    reportDate: todayDateISO(),
    colaboradora: user?.name || '',
    numAtendimentos: '',
    todosClientesRespondidos: true,
    clientesPendentes: '',
    ocorrencias: { ...defaultOcorrencias },
    suporteGestao: false,
    suporteColegas: false,
    motivoSuporte: '',
    autoavaliacao: '',
    compromissosAmanha: '',
    declaracao: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getTodayDailyReportStatus();
        if (!cancelled) setAlreadySubmitted(status.submitted);
      } catch {
        /* allow form if status check fails */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOcorrenciaChange = (key: keyof DailyReport['ocorrencias'], value: boolean) => {
    setFormData((prev) => {
      const next = { ...prev.ocorrencias! };
      if (key === 'nenhumaCritica' && value) {
        Object.keys(next).forEach((k) => {
          (next as Record<string, boolean>)[k] = k === 'nenhumaCritica';
        });
      } else {
        next[key] = value;
        if (value && key !== 'nenhumaCritica') next.nenhumaCritica = false;
      }
      return { ...prev, ocorrencias: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.numAtendimentos) {
      toastError('Informe o número de atendimentos realizados');
      return;
    }
    if (!formData.autoavaliacao) {
      toastError('Avalie seu atendimento hoje');
      return;
    }
    if (!formData.declaracao) {
      toastError('Confirme a declaração para finalizar');
      return;
    }
    if (!formData.todosClientesRespondidos && !formData.clientesPendentes?.trim()) {
      toastError('Descreva o motivo dos clientes pendentes');
      return;
    }
    if ((formData.suporteGestao || formData.suporteColegas) && !formData.motivoSuporte?.trim()) {
      toastError('Informe o motivo do suporte acionado');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: DailyReport = {
        reportDate: formData.reportDate || todayDateISO(),
        colaboradora: user?.name || '',
        numAtendimentos: formData.numAtendimentos,
        todosClientesRespondidos: formData.todosClientesRespondidos ?? true,
        clientesPendentes: formData.clientesPendentes || '',
        ocorrencias: formData.ocorrencias || { ...defaultOcorrencias },
        suporteGestao: !!formData.suporteGestao,
        suporteColegas: !!formData.suporteColegas,
        motivoSuporte: formData.motivoSuporte || '',
        autoavaliacao: formData.autoavaliacao,
        compromissosAmanha: formData.compromissosAmanha || '',
        declaracao: true,
      };
      await saveDailyReport(payload);
      setIsSuccess(true);
      success('Registro salvo com sucesso');
      window.setTimeout(() => navigate('/app/registro-diario'), 1800);
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar o registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checking) {
    return <Loading message="Verificando registro de hoje..." />;
  }

  if (alreadySubmitted && !isSuccess) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-brand-beige bg-white p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-14 w-14 text-brand-forest" />
        <h2 className="text-xl font-semibold text-brand-dark-brown">Registro de hoje já enviado</h2>
        <p className="text-sm text-brand-olive">
          Você já preencheu o registro diário de {formatDateBR(todayDateISO())}.
        </p>
        <AppButton variant="secondary" onClick={() => navigate('/app/registro-diario')}>
          Ver histórico
        </AppButton>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-brand-beige bg-white p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-14 w-14 text-brand-forest" />
        <h2 className="text-xl font-semibold text-brand-dark-brown">Registro salvo!</h2>
        <p className="text-sm text-brand-olive">Obrigado pelo preenchimento. Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link
          to="/app/registro-diario"
          className="inline-flex items-center gap-1.5 text-sm text-brand-olive hover:text-brand-dark-brown"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
      </div>

      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-brand-dark-brown">
          <FileText className="h-6 w-6 text-brand-olive" />
          Registro diário de atendimento
        </h2>
        <p className="mt-1 text-sm text-brand-olive">
          Preenchimento obrigatório ao final do expediente
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Identificação" icon={User}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <input
                readOnly
                value={formatDateBR(formData.reportDate || todayDateISO())}
                className="w-full rounded-xl border border-brand-beige bg-brand-off-white px-3 py-2.5 text-sm"
              />
            </Field>
            <Field label="Colaboradora">
              <input
                readOnly
                value={formData.colaboradora || user?.name || ''}
                className="w-full rounded-xl border border-brand-beige bg-brand-off-white px-3 py-2.5 text-sm"
              />
            </Field>
          </div>
        </Section>

        <Section title="Registro do dia">
          <Field label="Nº de atendimentos realizados hoje" required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ATTENDANCE_BANDS.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-2 py-3 text-center text-sm font-medium transition ${
                    formData.numAtendimentos === option
                      ? 'border-brand-brown bg-brand-brown/10 text-brand-dark-brown'
                      : 'border-brand-beige text-brand-olive hover:border-brand-olive/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="numAtendimentos"
                    value={option}
                    checked={formData.numAtendimentos === option}
                    onChange={(e) => setFormData((p) => ({ ...p, numAtendimentos: e.target.value }))}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Retornos e prazos">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={formData.todosClientesRespondidos}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  todosClientesRespondidos: e.target.checked,
                  clientesPendentes: e.target.checked ? '' : p.clientesPendentes,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
            />
            <span className="text-sm text-brand-dark-brown">
              Todos os clientes receberam resposta hoje
            </span>
          </label>
          {!formData.todosClientesRespondidos && (
            <Field label="Motivo das pendências" required className="mt-4">
              <textarea
                rows={3}
                value={formData.clientesPendentes}
                onChange={(e) => setFormData((p) => ({ ...p, clientesPendentes: e.target.value }))}
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                placeholder="Descreva brevemente..."
              />
            </Field>
          )}
        </Section>

        <Section title="Situações de atenção" icon={AlertCircle}>
          <div className="grid gap-2 sm:grid-cols-2">
            {OCORRENCIA_OPTIONS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-beige/80 px-3 py-2.5 hover:bg-brand-off-white/60"
              >
                <input
                  type="checkbox"
                  checked={formData.ocorrencias?.[key] || false}
                  onChange={(e) => handleOcorrenciaChange(key, e.target.checked)}
                  className="h-4 w-4 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
                />
                <span className="text-sm text-brand-dark-brown">{label}</span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Suporte da gestão ou colegas">
          <RadioPair
            label="Foi necessário acionar a gestão hoje?"
            value={!!formData.suporteGestao}
            onChange={(yes) =>
              setFormData((p) => ({
                ...p,
                suporteGestao: yes,
                motivoSuporte: yes || p.suporteColegas ? p.motivoSuporte : '',
              }))
            }
          />
          <RadioPair
            label="Foi necessário acionar algum colega hoje?"
            value={!!formData.suporteColegas}
            onChange={(yes) =>
              setFormData((p) => ({
                ...p,
                suporteColegas: yes,
                motivoSuporte: yes || p.suporteGestao ? p.motivoSuporte : '',
              }))
            }
            className="mt-4"
          />
          {(formData.suporteGestao || formData.suporteColegas) && (
            <Field label="Motivo" required className="mt-4">
              <textarea
                rows={3}
                value={formData.motivoSuporte}
                onChange={(e) => setFormData((p) => ({ ...p, motivoSuporte: e.target.value }))}
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              />
            </Field>
          )}
        </Section>

        <Section title="Autoavaliação do atendimento">
          <Field label="Como você avalia seu atendimento hoje?" required>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SELF_RATINGS.map((option) => (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border-2 px-2 py-3 text-center text-sm font-medium transition ${
                    formData.autoavaliacao === option
                      ? 'border-brand-brown bg-brand-brown/10 text-brand-dark-brown'
                      : 'border-brand-beige text-brand-olive hover:border-brand-olive/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="autoavaliacao"
                    value={option}
                    checked={formData.autoavaliacao === option}
                    onChange={(e) => setFormData((p) => ({ ...p, autoavaliacao: e.target.value }))}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Compromissos para o dia seguinte">
          <Field label="Pendências ou retornos agendados para amanhã">
            <textarea
              rows={4}
              value={formData.compromissosAmanha}
              onChange={(e) => setFormData((p) => ({ ...p, compromissosAmanha: e.target.value }))}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              placeholder="Opcional..."
            />
          </Field>
        </Section>

        <Section title="Declaração">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={formData.declaracao}
              onChange={(e) => setFormData((p) => ({ ...p, declaracao: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
            />
            <span className="text-sm text-brand-dark-brown">
              Declaro que realizei meus atendimentos seguindo o Manual de Boas Práticas do Escritório,
              mantendo postura profissional, clareza e respeito ao cliente.{' '}
              <span className="text-red-600">*</span>
            </span>
          </label>
        </Section>

        <div className="flex justify-end border-t border-brand-beige pt-4">
          <AppButton type="submit" loading={isSubmitting}>
            <Save className="h-4 w-4" />
            Salvar registro
          </AppButton>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-brand-beige bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-brand-dark-brown">
        {Icon && <Icon className="h-5 w-5 text-brand-olive" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <span className="mb-2 block text-sm font-medium text-brand-dark-brown">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
    </div>
  );
}

function RadioPair({
  label,
  value,
  onChange,
  className = '',
}: {
  label: string;
  value: boolean;
  onChange: (yes: boolean) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-brand-dark-brown">{label}</p>
      <div className="flex gap-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            checked={!value}
            onChange={() => onChange(false)}
            className="text-brand-brown focus:ring-brand-beige"
          />
          Não
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            checked={value}
            onChange={() => onChange(true)}
            className="text-brand-brown focus:ring-brand-beige"
          />
          Sim
        </label>
      </div>
    </div>
  );
}
