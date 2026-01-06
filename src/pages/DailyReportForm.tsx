import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { saveDailyReport, DailyReport } from '../services/dailyReportService';
import { Calendar, User, CheckCircle, AlertCircle, FileText, Save, ArrowLeft } from 'lucide-react';

export default function DailyReportForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Estado do formulário
  const [formData, setFormData] = useState<Partial<DailyReport>>({
    data: new Date().toLocaleDateString('pt-BR'),
    colaboradora: user?.name || '',
    numAtendimentos: '',
    todosClientesRespondidos: true,
    clientesPendentes: '',
    ocorrencias: {
      clienteIrritado: false,
      cobrancaIndevida: false,
      questionamentoFinanceiro: false,
      contestacaoRegras: false,
      escaladoGestao: false,
      nenhumaCritica: true,
    },
    suporteGestao: false,
    suporteColegas: false,
    motivoSuporte: '',
    autoavaliacao: '',
    compromissosAmanha: '',
    declaracao: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    if (!formData.numAtendimentos) {
      alert('Por favor, informe o número de atendimentos realizados.');
      return;
    }

    if (!formData.autoavaliacao) {
      alert('Por favor, avalie seu atendimento hoje.');
      return;
    }

    if (!formData.declaracao) {
      alert('Por favor, confirme a declaração para finalizar o registro.');
      return;
    }

    setIsSubmitting(true);

    try {
      const report: DailyReport = {
        data: formData.data || new Date().toLocaleDateString('pt-BR'),
        colaboradora: formData.colaboradora || user?.name || '',
        numAtendimentos: formData.numAtendimentos || '',
        todosClientesRespondidos: formData.todosClientesRespondidos ?? true,
        clientesPendentes: formData.clientesPendentes || '',
        ocorrencias: formData.ocorrencias || {
          clienteIrritado: false,
          cobrancaIndevida: false,
          questionamentoFinanceiro: false,
          contestacaoRegras: false,
          escaladoGestao: false,
          nenhumaCritica: true,
        },
        suporteGestao: formData.suporteGestao || false,
        suporteColegas: formData.suporteColegas || false,
        motivoSuporte: formData.motivoSuporte || '',
        autoavaliacao: formData.autoavaliacao || '',
        compromissosAmanha: formData.compromissosAmanha || '',
        declaracao: formData.declaracao || false,
      };

      await saveDailyReport(report);
      setIsSuccess(true);
      
      // Voltar ao dashboard após 2 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Erro ao salvar registro:', error);
      alert('Erro ao salvar o registro. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOcorrenciaChange = (key: keyof DailyReport['ocorrencias'], value: boolean) => {
    setFormData({
      ...formData,
      ocorrencias: {
        ...formData.ocorrencias!,
        [key]: value,
        nenhumaCritica: key === 'nenhumaCritica' ? value : false,
      },
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-beige via-brand-off-white to-white flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft-lg p-8 md:p-12 max-w-md text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-brand-brown mb-4">
            Registro Salvo com Sucesso!
          </h2>
          <p className="text-brand-olive/70">
            Seu registro diário foi salvo. Obrigado pelo preenchimento!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-beige via-brand-off-white to-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-soft-lg p-6 md:p-10 border border-brand-olive/20">
          {/* Botão Voltar */}
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-6 flex items-center gap-2 text-brand-olive hover:text-brand-brown transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Voltar ao Dashboard</span>
          </button>

          {/* Cabeçalho */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <FileText className="w-8 h-8 text-brand-olive" />
              <h1 className="text-3xl font-bold text-brand-brown">
                Registro Diário de Atendimento
              </h1>
            </div>
            <p className="text-brand-olive/70 text-sm">
              Preenchimento obrigatório ao final do expediente
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* IDENTIFICAÇÃO */}
            <section className="bg-brand-beige/30 rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6 flex items-center gap-2">
                <User className="w-6 h-6" />
                Identificação
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-brand-brown mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Data
                  </label>
                  <input
                    type="text"
                    value={formData.data}
                    readOnly
                    className="w-full px-4 py-2 border border-brand-olive/30 rounded-lg bg-white/50 text-brand-brown"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-brand-brown mb-2">
                    Nome da Colaboradora
                  </label>
                  <input
                    type="text"
                    value={formData.colaboradora}
                    readOnly
                    className="w-full px-4 py-2 border border-brand-olive/30 rounded-lg bg-white/50 text-brand-brown"
                  />
                </div>
              </div>
            </section>

            {/* REGISTRO DO DIA */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Registro do Dia
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-4">
                  Nº de atendimentos realizados hoje: <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Até 10', '11 a 20', '21 a 30', 'Acima de 30'].map((option) => (
                    <label
                      key={option}
                      className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.numAtendimentos === option
                          ? 'border-brand-olive bg-brand-olive/10 text-brand-olive'
                          : 'border-brand-olive/30 text-brand-brown hover:border-brand-olive/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="numAtendimentos"
                        value={option}
                        checked={formData.numAtendimentos === option}
                        onChange={(e) => setFormData({ ...formData, numAtendimentos: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* CLIENTES PENDENTES */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Retornos e Prazos
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.todosClientesRespondidos}
                    onChange={(e) => setFormData({ ...formData, todosClientesRespondidos: e.target.checked, clientesPendentes: e.target.checked ? '' : formData.clientesPendentes })}
                    className="w-5 h-5 text-brand-olive border-brand-olive/30 rounded focus:ring-brand-olive"
                  />
                  <span className="text-brand-brown">Todos os clientes receberam resposta hoje</span>
                </label>
                
                {!formData.todosClientesRespondidos && (
                  <div>
                    <label className="block text-sm font-medium text-brand-brown mb-2">
                      Se sim, informe o motivo brevemente:
                    </label>
                    <textarea
                      value={formData.clientesPendentes}
                      onChange={(e) => setFormData({ ...formData, clientesPendentes: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive text-brand-brown"
                      placeholder="Descreva o motivo..."
                    />
                  </div>
                )}
              </div>
            </section>

            {/* OCORRÊNCIAS */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6 flex items-center gap-2">
                <AlertCircle className="w-6 h-6" />
                Situações de Atenção
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { key: 'clienteIrritado', label: 'Cliente irritado' },
                  { key: 'cobrancaIndevida', label: 'Cobrança indevida' },
                  { key: 'questionamentoFinanceiro', label: 'Questionamento financeiro' },
                  { key: 'contestacaoRegras', label: 'Contestação de regras / contrato' },
                  { key: 'escaladoGestao', label: 'Situação escalada para a gestão' },
                  { key: 'nenhumaCritica', label: 'Nenhuma situação crítica hoje' },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-3 border border-brand-olive/20 rounded-lg hover:bg-brand-beige/20 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={formData.ocorrencias?.[key as keyof DailyReport['ocorrencias']] || false}
                      onChange={(e) => handleOcorrenciaChange(key as keyof DailyReport['ocorrencias'], e.target.checked)}
                      className="w-5 h-5 text-brand-olive border-brand-olive/30 rounded focus:ring-brand-olive"
                    />
                    <span className="text-brand-brown text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* SUPORTE */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Suporte da Gestão ou de Colegas
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-brand-brown mb-3">
                    Foi necessário acionar a gestão hoje?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="suporteGestao"
                        checked={!formData.suporteGestao}
                        onChange={() => setFormData({ ...formData, suporteGestao: false, motivoSuporte: '' })}
                        className="w-4 h-4 text-brand-olive"
                      />
                      <span className="text-brand-brown">Não</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="suporteGestao"
                        checked={formData.suporteGestao}
                        onChange={() => setFormData({ ...formData, suporteGestao: true })}
                        className="w-4 h-4 text-brand-olive"
                      />
                      <span className="text-brand-brown">Sim</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-brand-brown mb-3">
                    Foi necessário acionar algum colega hoje?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="suporteColegas"
                        checked={!formData.suporteColegas}
                        onChange={() => setFormData({ ...formData, suporteColegas: false, motivoSuporte: '' })}
                        className="w-4 h-4 text-brand-olive"
                      />
                      <span className="text-brand-brown">Não</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="suporteColegas"
                        checked={formData.suporteColegas}
                        onChange={() => setFormData({ ...formData, suporteColegas: true })}
                        className="w-4 h-4 text-brand-olive"
                      />
                      <span className="text-brand-brown">Sim</span>
                    </label>
                  </div>
                </div>
                
                {(formData.suporteGestao || formData.suporteColegas) && (
                  <div>
                    <label className="block text-sm font-medium text-brand-brown mb-2">
                      Se sim, por qual motivo?
                    </label>
                    <textarea
                      value={formData.motivoSuporte}
                      onChange={(e) => setFormData({ ...formData, motivoSuporte: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-2 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive text-brand-brown"
                      placeholder="Descreva o motivo..."
                    />
                  </div>
                )}
              </div>
            </section>

            {/* AUTOAVALIAÇÃO */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Autoavaliação do Atendimento
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-4">
                  Como você avalia seu atendimento hoje? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Excelente', 'Bom', 'Regular', 'Precisa melhorar'].map((option) => (
                    <label
                      key={option}
                      className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.autoavaliacao === option
                          ? 'border-brand-olive bg-brand-olive/10 text-brand-olive'
                          : 'border-brand-olive/30 text-brand-brown hover:border-brand-olive/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="autoavaliacao"
                        value={option}
                        checked={formData.autoavaliacao === option}
                        onChange={(e) => setFormData({ ...formData, autoavaliacao: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* COMPROMISSOS */}
            <section className="bg-white rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Compromissos para o Dia Seguinte
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-2">
                  Pendências ou retornos já agendados para amanhã:
                </label>
                <textarea
                  value={formData.compromissosAmanha}
                  onChange={(e) => setFormData({ ...formData, compromissosAmanha: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-brand-olive/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-olive/50 focus:border-brand-olive text-brand-brown"
                  placeholder="Descreva os compromissos para amanhã..."
                />
              </div>
            </section>

            {/* DECLARAÇÃO */}
            <section className="bg-brand-beige/30 rounded-lg p-6 border border-brand-olive/20">
              <h2 className="text-xl font-semibold text-brand-brown mb-6">
                Declaração
              </h2>
              
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.declaracao}
                  onChange={(e) => setFormData({ ...formData, declaracao: e.target.checked })}
                  className="w-5 h-5 mt-1 text-brand-olive border-brand-olive/30 rounded focus:ring-brand-olive"
                />
                <span className="text-brand-brown text-sm">
                  Declaro que realizei meus atendimentos seguindo o Manual de Boas Práticas do Escritório, mantendo postura profissional, clareza e respeito ao cliente. <span className="text-red-500">*</span>
                </span>
              </label>
            </section>

            {/* Botão Submit */}
            <div className="flex justify-end gap-4 pt-6 border-t border-brand-olive/20">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-brand-brown to-brand-olive text-white rounded-lg font-semibold hover:from-brand-brown/90 hover:to-brand-olive/90 transition-all duration-200 shadow-soft-lg hover:shadow-soft-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salvar Registro
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

