import { useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, TrendingUp, Award, MessageSquare, ArrowRight, ArrowLeft, Play, Clock, CheckCircle, Send, Shield } from 'lucide-react';
import { saveDiagnosticToSheets } from '../../services/googleSheets';
import PrivacyPolicy from './PrivacyPolicy';

interface Question {
  id: string;
  category: string;
  question: string;
  options: {
    value: number;
    label: string;
  }[];
}

const questions: Question[] = [
  {
    id: 'prazos',
    category: 'Controle de prazos',
    question: 'Como você avalia o controle de prazos junto às associações?',
    options: [
      { value: 100, label: 'Sempre cumpro todos os prazos sem atrasos' },
      { value: 70, label: 'Cumpro a maioria dos prazos, com alguns atrasos ocasionais' },
      { value: 40, label: 'Tenho dificuldades frequentes com prazos' },
      { value: 10, label: 'Frequentemente perco prazos e recebo multas' },
    ],
  },
  {
    id: 'registro',
    category: 'Registro de animais',
    question: 'Como está a situação dos registros dos seus animais?',
    options: [
      { value: 100, label: 'Todos os animais estão registrados e atualizados' },
      { value: 70, label: 'Maioria registrada, alguns pendências menores' },
      { value: 40, label: 'Muitos animais sem registro ou com pendências' },
      { value: 10, label: 'Registros desatualizados ou incompletos' },
    ],
  },
  {
    id: 'gestao',
    category: 'Gestão de compra/venda',
    question: 'Como você avalia a gestão de compra e venda de animais?',
    options: [
      { value: 100, label: 'Tenho controle total e organizado de todas as transações' },
      { value: 70, label: 'Tenho controle básico, mas poderia melhorar a organização' },
      { value: 40, label: 'Controle parcial, com algumas informações faltando' },
      { value: 10, label: 'Controle insuficiente ou desorganizado' },
    ],
  },
  {
    id: 'comunicacao',
    category: 'Comunicação com associações',
    question: 'Como está a comunicação com as associações?',
    options: [
      { value: 100, label: 'Comunicação fluida e proativa com todas as associações' },
      { value: 70, label: 'Boa comunicação, mas poderia ser mais frequente' },
      { value: 40, label: 'Comunicação esporádica ou reativa' },
      { value: 10, label: 'Comunicação deficiente ou inexistente' },
    ],
  },
];

export default function Diagnostic() {
  const [showIntro, setShowIntro] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Dados do cliente
  const [clientName, setClientName] = useState('');
  const [clientWhatsApp, setClientWhatsApp] = useState('');
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  const handleAnswer = (questionId: string, value: number) => {
    if (isTransitioning) return; // Previne múltiplos cliques
    
    setAnswers({ ...answers, [questionId]: value });
    setIsTransitioning(true);
    
    setTimeout(() => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        // Mostrar resultado imediatamente e salvar dados em background
        setShowResult(true);
        // Salvar dados no Google Sheets em background (não bloqueia a UI)
        saveDiagnosticData().catch(error => {
          console.error('Erro ao salvar dados em background:', error);
        });
      }
      setIsTransitioning(false);
      setSelectedAnswer(null);
    }, 300);
  };

  const saveDiagnosticData = async () => {
    if (!lgpdConsent) return; // Não salvar se não houver consentimento

    setIsSaving(true);
    const score = calculateScore();
    const level = getLevel(score);
    const recommendations = getRecommendations(score);

    try {
      await saveDiagnosticToSheets({
        nome: clientName,
        whatsapp: clientWhatsApp,
        score,
        nivel: level.label,
        respostas: answers,
        recomendacoes: recommendations,
      });
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const sendDiagnosticByWhatsApp = () => {
    const score = calculateScore();
    const level = getLevel(score);
    const recommendations = getRecommendations(score);
    
    const whatsappNumber = '5521999293866';
    
    // Formatar mensagem com o resultado
    const message = `*Diagnóstico da Criação - ${clientName}*\n\n` +
      `*Score de Maturidade:* ${score}/100\n` +
      `*Nível:* ${level.label}\n\n` +
      `*Recomendações:*\n${recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}\n\n` +
      `_Este diagnóstico foi gerado automaticamente pelo site._`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
  };

  const handleNext = () => {
    if (selectedAnswer !== null) {
      const currentQuestion = questions[currentStep];
      handleAnswer(currentQuestion.id, selectedAnswer);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsTransitioning(false);
        setSelectedAnswer(null);
      }, 300);
    }
  };

  const startDiagnostic = () => {
    // Mostrar formulário de coleta de dados
    setShowForm(true);
    setShowIntro(false);
    
    // Scroll suave para manter a seção visível após a mudança
    setTimeout(() => {
      const element = document.getElementById('diagnostico');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientName.trim() || !clientWhatsApp.trim()) {
      alert('Por favor, preencha todos os campos.');
      return;
    }

    if (!lgpdConsent) {
      alert('É necessário aceitar o consentimento para prosseguir.');
      return;
    }

    // Validar formato do WhatsApp (básico)
    const whatsappRegex = /^[\d\s\(\)\-\+]+$/;
    if (!whatsappRegex.test(clientWhatsApp)) {
      alert('Por favor, insira um número de WhatsApp válido.');
      return;
    }

    // Iniciar o diagnóstico
    setShowForm(false);
    setCurrentStep(0);
    setAnswers({});
    setSelectedAnswer(null);
    setShowResult(false);
    setIsTransitioning(false);
  };

  const calculateScore = () => {
    const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
    const maxScore = questions.length * 100;
    return Math.round((totalScore / maxScore) * 100);
  };

  const getLevel = (score: number) => {
    if (score >= 75) return { label: 'Estruturada', color: 'green', icon: CheckCircle2, bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' };
    if (score >= 50) return { label: 'Em crescimento', color: 'yellow', icon: AlertCircle, bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-700' };
    return { label: 'Necessita assessoria urgente', color: 'red', icon: XCircle, bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' };
  };

  const getRecommendations = (score: number) => {
    if (score >= 75) {
      return [
        'Parabéns! Sua criação está bem estruturada. Continue mantendo a organização e considere otimizações para elevar ainda mais o padrão.',
        'Mantenha o controle rigoroso de prazos e documentações.',
        'Considere implementar ferramentas de gestão avançadas para otimizar processos.',
      ];
    }
    if (score >= 50) {
      return [
        'Sua criação está em crescimento e tem potencial. Com organização adequada, pode alcançar excelência.',
        'Priorize o cumprimento de prazos e a organização de documentos.',
        'Considere uma assessoria para estruturar processos e evitar multas.',
      ];
    }
    return [
      'Sua criação precisa de atenção imediata para evitar problemas maiores e multas.',
      'É essencial regularizar pendências junto às associações o quanto antes.',
      'Recomendamos fortemente uma assessoria especializada para estruturar e organizar todos os processos.',
    ];
  };

  const resetDiagnostic = () => {
    setCurrentStep(0);
    setAnswers({});
    setSelectedAnswer(null);
    setShowResult(false);
    setShowIntro(true);
    setShowForm(false);
    // Manter dados do cliente para não precisar preencher novamente
  };

  const score = showResult ? calculateScore() : 0;
  const level = getLevel(score);
  const recommendations = getRecommendations(score);
  const LevelIcon = level.icon;

  // Tela de formulário de coleta de dados
  if (showForm) {
    return (
      <>
        <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
        <section id="diagnostico" className="py-16 md:py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8 md:mb-12">
              <div className="mb-4 md:mb-6 flex justify-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg animate-scale-in">
                  <MessageSquare className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-3 md:mb-4 px-2">
                Antes de Começar
              </h2>
              <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 md:mb-6 decorative-line" />
              <p className="text-brand-dark-brown/70 text-base md:text-lg">
                Precisamos de algumas informações para personalizar seu diagnóstico
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl p-6 md:p-8 lg:p-12 shadow-soft-lg depth-effect">
              <div className="space-y-6 mb-6">
                <div>
                  <label htmlFor="clientName" className="block text-sm font-semibold text-brand-brown mb-2">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-brand-beige/40 focus:border-brand-olive focus:outline-none transition-colors text-brand-dark-brown"
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="clientWhatsApp" className="block text-sm font-semibold text-brand-brown mb-2">
                    WhatsApp *
                  </label>
                  <input
                    type="tel"
                    id="clientWhatsApp"
                    value={clientWhatsApp}
                    onChange={(e) => setClientWhatsApp(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-brand-beige/40 focus:border-brand-olive focus:outline-none transition-colors text-brand-dark-brown"
                    placeholder="(21) 99999-9999"
                    required
                  />
                  <p className="text-xs text-brand-dark-brown/60 mt-1">
                    Inclua o código do país e DDD (ex: 5521999999999)
                  </p>
                </div>
              </div>

              {/* Aviso LGPD */}
              <div className="mb-6 p-4 bg-brand-beige/20 rounded-xl border border-brand-olive/30">
                <div className="flex items-start gap-3 mb-3">
                  <Shield className="w-5 h-5 text-brand-brown flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1">
                    <h4 className="font-semibold text-brand-brown mb-2 text-sm">Proteção de Dados (LGPD)</h4>
                    <p className="text-xs text-brand-dark-brown/70 leading-relaxed mb-3">
                      Seus dados serão utilizados exclusivamente para:
                    </p>
                    <ul className="text-xs text-brand-dark-brown/70 space-y-1 mb-3 ml-4 list-disc">
                      <li>Envio do resultado do diagnóstico por WhatsApp</li>
                      <li>Melhoria dos nossos serviços</li>
                      <li>Contato sobre serviços de assessoria (se autorizado)</li>
                    </ul>
                    <p className="text-xs text-brand-dark-brown/70 leading-relaxed mb-2">
                      Seus dados serão armazenados de forma segura e não serão compartilhados com terceiros.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPrivacyPolicy(true);
                      }}
                      className="text-xs text-brand-olive hover:text-brand-brown underline font-medium transition-colors"
                    >
                      Leia nossa Política de Privacidade completa
                    </button>
                  </div>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lgpdConsent}
                    onChange={(e) => setLgpdConsent(e.target.checked)}
                    className="mt-1 w-4 h-4 text-brand-olive border-brand-brown/40 rounded focus:ring-brand-olive focus:ring-2"
                    required
                  />
                  <span className="text-sm text-brand-dark-brown/80">
                    Eu concordo com a coleta e uso dos meus dados pessoais conforme descrito acima e li a{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPrivacyPolicy(true);
                      }}
                      className="text-brand-olive hover:text-brand-brown underline font-medium"
                    >
                      Política de Privacidade
                    </button>
                    . *
                  </span>
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setShowIntro(true);
                  }}
                  className="px-6 py-3 bg-transparent border-2 border-brand-brown/40 text-brand-brown rounded-full font-semibold hover:bg-brand-brown/10 transition-all duration-300"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand-olive text-white rounded-full font-semibold hover:bg-brand-brown transition-all duration-300 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 inline-flex items-center justify-center gap-2"
                >
                  Iniciar Diagnóstico
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </form>
            </div>
          </div>
        </section>
      </>
    );
  }

  // Tela de introdução
  if (showIntro) {
    return (
      <>
        <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
        <section id="diagnostico" className="py-16 md:py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8 md:mb-12">
                <div className="mb-4 md:mb-6 flex justify-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg animate-scale-in">
                    <TrendingUp className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
                  </div>
                </div>
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-3 md:mb-4 px-2">
                  Diagnóstico da Sua Criação
                </h2>
                <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 md:mb-6 decorative-line" />
              </div>

              <div className="bg-white rounded-2xl p-6 md:p-8 lg:p-12 shadow-soft-lg depth-effect mb-6 md:mb-8">
                <div className="space-y-4 md:space-y-6 mb-6 md:mb-8">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-olive/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-brand-brown" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg md:text-xl font-bold text-brand-brown mb-1 md:mb-2">Tempo estimado: 2 minutos</h3>
                      <p className="text-sm md:text-base text-brand-dark-brown/70">Apenas 4 perguntas rápidas sobre sua criação</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-olive/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 md:w-6 md:h-6 text-brand-brown" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg md:text-xl font-bold text-brand-brown mb-1 md:mb-2">Resultado personalizado</h3>
                      <p className="text-sm md:text-base text-brand-dark-brown/70">Receba um score de maturidade e recomendações específicas para sua criação</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-brand-olive/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-brand-brown" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg md:text-xl font-bold text-brand-brown mb-1 md:mb-2">100% gratuito</h3>
                      <p className="text-sm md:text-base text-brand-dark-brown/70">Sem cadastro necessário, apenas responda as perguntas</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 md:pt-6 border-t border-brand-beige/40">
                  <h4 className="font-display text-base md:text-lg font-semibold text-brand-brown mb-3 md:mb-4">O que será avaliado:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {questions.map((q, index) => (
                      <div key={q.id} className="flex items-center gap-2 text-xs md:text-sm text-brand-dark-brown/70">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-olive flex-shrink-0" />
                        <span>{q.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center px-2">
                <button
                  onClick={startDiagnostic}
                  className="group w-full sm:w-auto px-8 md:px-10 py-3 md:py-4 bg-brand-olive text-white rounded-full font-semibold text-base md:text-lg hover:bg-brand-brown transition-all duration-300 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 inline-flex items-center justify-center gap-3 glow-effect"
                >
                  Começar Diagnóstico
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (showResult) {
    return (
      <>
        <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
        <section id="diagnostico" className="py-12 md:py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8 md:mb-12">
              <div className="mb-4 md:mb-6 flex justify-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg">
                  <Award className="w-7 h-7 md:w-8 md:h-8 text-white" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-3 md:mb-4 px-2">
                Resultado do Diagnóstico
              </h2>
              <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 md:mb-6 decorative-line" />
            </div>

            {/* Nível da Criação */}
            <div className={`${level.bgColor} ${level.borderColor} border-2 rounded-xl md:rounded-2xl p-6 md:p-8 mb-6 md:mb-8 depth-effect`}>
              <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4 flex-wrap">
                <LevelIcon className={`w-7 h-7 md:w-8 md:h-8 ${level.textColor} flex-shrink-0`} strokeWidth={1.5} />
                <h3 className={`font-display text-xl md:text-2xl font-bold ${level.textColor}`}>
                  Nível da Criação: {level.label}
                </h3>
              </div>
            </div>

            {/* Score e Barra de Progresso */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-soft-lg mb-6 md:mb-8 depth-effect">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <span className="text-sm md:text-base text-brand-dark-brown/70 font-medium">Score de Maturidade</span>
                <span className="font-display text-2xl md:text-3xl font-bold text-brand-brown">{score}/100</span>
              </div>
              <div className="relative w-full h-5 md:h-6 bg-brand-beige/30 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                    score >= 75 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                    score >= 50 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                    'bg-gradient-to-r from-red-500 to-red-600'
                  }`}
                  style={{ width: `${score}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white drop-shadow-sm">{score}%</span>
                </div>
              </div>
            </div>

            {/* Recomendações */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-soft-lg mb-6 md:mb-8 depth-effect">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-brand-brown flex-shrink-0" strokeWidth={1.5} />
                <h3 className="font-display text-lg md:text-xl font-bold text-brand-brown">Recomendações Personalizadas</h3>
              </div>
              <ul className="space-y-3 md:space-y-4">
                {recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 md:gap-3">
                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-brand-olive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-brand-olive" />
                    </div>
                    <p className="text-sm md:text-base text-brand-dark-brown/80 leading-relaxed">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Botões de ação */}
            <div className="text-center space-y-3 md:space-y-0 md:space-x-4 flex flex-col sm:flex-row sm:justify-center">
              <button
                onClick={sendDiagnosticByWhatsApp}
                className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-green-500 text-white rounded-full font-semibold hover:bg-green-600 transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 text-sm md:text-base inline-flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar por WhatsApp
              </button>
              <button
                onClick={resetDiagnostic}
                className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-brand-brown text-white rounded-full font-semibold hover:bg-brand-olive transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 text-sm md:text-base"
              >
                Refazer Diagnóstico
              </button>
              <button
                onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full sm:w-auto px-6 md:px-8 py-2.5 md:py-3 bg-transparent border-2 border-brand-brown text-brand-brown rounded-full font-semibold hover:bg-brand-brown hover:text-white transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 text-sm md:text-base"
              >
                Falar com Especialista
              </button>
            </div>
            
            {isSaving && (
              <div className="mt-4 text-center">
                <p className="text-sm text-brand-dark-brown/60">Salvando seus dados...</p>
              </div>
            )}
          </div>
        </div>
      </section>
      </>
    );
  }

  // Garantir que currentStep está dentro dos limites válidos
  const validStep = Math.max(0, Math.min(currentStep, questions.length - 1));
  const currentQuestion = questions[validStep];
  
  // Debug: verificar se a pergunta existe
  if (!currentQuestion) {
    console.error('Pergunta não encontrada no índice:', validStep, 'Total de perguntas:', questions.length);
    // Resetar para a primeira pergunta
    if (currentStep !== 0) {
      setCurrentStep(0);
    }
    return (
      <section id="diagnostico" className="py-8 md:py-16 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p style={{ color: '#4F3E32', fontSize: '18px' }}>Carregando pergunta...</p>
          </div>
        </div>
      </section>
    );
  }
  
  // Debug: verificar se as opções existem
  if (!currentQuestion.options || currentQuestion.options.length === 0) {
    console.error('Opções não encontradas para a pergunta:', currentQuestion.id);
  }
  
  // Garantir que sempre renderiza algo
  console.log('Renderizando questionário - Step:', validStep, 'Pergunta:', currentQuestion.id);

  const progress = ((validStep + 1) / questions.length) * 100;
  const hasAnswer = answers[currentQuestion.id] !== undefined;

  return (
    <>
      <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
      <section id="diagnostico" className="py-8 md:py-16 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white" style={{ minHeight: '400px' }}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Título da seção mantido visível - mais compacto */}
          <div className="text-center mb-4 md:mb-6">
            <h2 className="font-display text-xl md:text-2xl lg:text-3xl font-bold mb-2" style={{ color: '#4F3E32' }}>
              Diagnóstico da Sua Criação
            </h2>
            <div className="w-16 md:w-20 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto" />
          </div>

          {/* Barra de progresso melhorada */}
          <div className="mb-4 md:mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs md:text-sm font-medium" style={{ color: '#4F3E32' }}>
                Pergunta {validStep + 1} de {questions.length}
              </span>
              <span className="text-xs md:text-sm font-bold" style={{ color: '#81705F' }}>{Math.round(progress)}%</span>
            </div>
            <div className="relative w-full h-2.5 md:h-3 bg-brand-beige/30 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-brown to-brand-olive rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
              {/* Marcadores de progresso */}
              <div className="absolute inset-0 flex items-center justify-between px-0.5 md:px-1">
                {questions.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full transition-all duration-300 ${
                      index <= validStep ? 'bg-white shadow-sm' : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Card da pergunta */}
          <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-6 lg:p-8 shadow-soft-lg depth-effect" style={{ minHeight: '400px', visibility: 'visible', opacity: 1, display: 'block' }}>
            <div className="mb-4 md:mb-5">
              <div className="flex items-center gap-2 md:gap-3 mb-3 flex-wrap">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-brand-brown to-brand-olive rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm md:text-lg">{validStep + 1}</span>
                </div>
                <span className="inline-block px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-brand-beige/40 text-xs font-semibold" style={{ color: '#4F3E32' }}>
                  {currentQuestion.category}
                </span>
              </div>
              <h3 className="font-display text-lg md:text-xl lg:text-2xl font-bold leading-tight" style={{ color: '#4F3E32' }}>
                {currentQuestion.question}
              </h3>
            </div>

            <div className="space-y-2 md:space-y-3 mb-4">
              {currentQuestion.options && currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswer === option.value || answers[currentQuestion.id] === option.value;
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isTransitioning && currentQuestion) {
                        handleAnswer(currentQuestion.id, option.value);
                      }
                    }}
                    disabled={isTransitioning}
                    className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all duration-300 transform ${
                      isSelected
                        ? 'border-brand-olive bg-brand-beige/50 shadow-soft scale-[1.01] md:scale-[1.02]'
                        : 'border-brand-beige/40 bg-brand-off-white hover:border-brand-olive/60 hover:bg-brand-beige/30 hover:-translate-y-0.5 md:hover:-translate-y-1 hover:shadow-soft'
                    } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} group`}
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                        isSelected
                          ? 'border-brand-olive bg-brand-olive'
                          : 'border-brand-brown/40 group-hover:border-brand-olive'
                      }`}>
                        {isSelected && (
                          <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" strokeWidth={3} />
                        )}
                        {!isSelected && (
                          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-brand-olive opacity-0 group-hover:opacity-50 transition-opacity" />
                        )}
                      </div>
                      <span className="leading-relaxed flex-1 text-sm md:text-base font-medium" style={{ 
                        color: '#4F3E32'
                      }}>
                        {option.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Botões de navegação */}
            <div className="flex items-center justify-between pt-4 md:pt-6 border-t border-brand-beige/40 gap-4">
              <button
                onClick={handleBack}
                disabled={currentStep === 0 || isTransitioning}
                className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-2.5 rounded-full border-2 border-brand-brown/40 text-brand-brown font-medium transition-all duration-300 text-sm md:text-base ${
                  currentStep === 0 || isTransitioning
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-brand-brown hover:text-white hover:border-brand-brown hover:shadow-soft'
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
              
              <div className="text-xs md:text-sm text-center" style={{ color: '#4F3E32' }}>
                {validStep + 1} de {questions.length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}

