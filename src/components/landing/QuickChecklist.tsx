import { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ClipboardCheck, FileText, Building2, Clock, ArrowRight } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  icon: typeof ClipboardCheck;
  description: string;
}

const checklistItems: ChecklistItem[] = [
  {
    id: 'registros',
    label: 'Registros',
    icon: ClipboardCheck,
    description: 'Todos os animais estão registrados e atualizados?',
  },
  {
    id: 'contratos',
    label: 'Contratos',
    icon: FileText,
    description: 'Contratos de compra, venda e condomínios organizados?',
  },
  {
    id: 'associacoes',
    label: 'Associações',
    icon: Building2,
    description: 'Comunicação ativa e em dia com as associações?',
  },
  {
    id: 'prazos',
    label: 'Prazos',
    icon: Clock,
    description: 'Todos os prazos das associações estão sendo cumpridos?',
  },
];

export default function QuickChecklist() {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showResult, setShowResult] = useState(false);

  const handleToggle = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCheck = () => {
    setShowResult(true);
    // Scroll suave para o resultado
    setTimeout(() => {
      const resultElement = document.getElementById('checklist-result');
      resultElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalItems = checklistItems.length;
  const percentage = Math.round((checkedCount / totalItems) * 100);

  const getStatus = () => {
    if (percentage === 100) {
      return {
        label: 'Excelente!',
        message: 'Parabéns! Você está em dia com todos os itens essenciais.',
        color: 'green',
        icon: CheckCircle2,
      };
    }
    if (percentage >= 50) {
      return {
        label: 'Atenção Necessária',
        message: 'Alguns itens precisam de atenção. Considere uma assessoria para organizar tudo.',
        color: 'yellow',
        icon: AlertCircle,
      };
    }
    return {
      label: 'Ação Urgente',
      message: 'É essencial regularizar essas pendências. Recomendamos assessoria especializada.',
      color: 'red',
      icon: XCircle,
    };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <section id="checklist" className="py-16 md:py-24 bg-gradient-to-b from-white via-brand-off-white to-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
              Checklist Rápido
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-4">
              Você está em dia com isso?
            </h2>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
            <p className="text-brand-dark-brown/70 text-base md:text-lg max-w-2xl mx-auto">
              Verifique rapidamente se está em dia com os itens essenciais da sua criação
            </p>
          </div>

          {!showResult ? (
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-soft-lg depth-effect glass-effect">
              <div className="space-y-4 mb-8">
                {checklistItems.map((item) => {
                  const Icon = item.icon;
                  const isChecked = checkedItems[item.id] || false;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleToggle(item.id)}
                      className={`w-full text-left p-5 md:p-6 rounded-xl border-2 transition-all duration-300 transform ${
                        isChecked
                          ? 'border-brand-olive bg-brand-beige/50 shadow-soft scale-[1.01]'
                          : 'border-brand-beige/40 bg-brand-off-white hover:border-brand-olive/60 hover:bg-brand-beige/30 hover:-translate-y-1 hover:shadow-soft'
                      } group`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                          isChecked
                            ? 'bg-brand-olive text-white'
                            : 'bg-brand-brown/10 text-brand-brown group-hover:bg-brand-olive/20'
                        }`}>
                          <Icon className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-display text-lg md:text-xl font-semibold text-brand-brown">
                              {item.label}
                            </h3>
                            {isChecked && (
                              <CheckCircle2 className="w-5 h-5 text-brand-olive flex-shrink-0" strokeWidth={2} />
                            )}
                          </div>
                          <p className="text-sm md:text-base text-brand-dark-brown/70">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-brand-beige/40">
                <button
                  onClick={handleCheck}
                  className="w-full group px-8 py-4 bg-brand-olive text-white rounded-full font-semibold text-base md:text-lg hover:bg-brand-brown transition-all duration-300 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 inline-flex items-center justify-center gap-3 glow-effect"
                >
                  Verificar Status
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <div id="checklist-result" className="space-y-6">
              {/* Resultado */}
              <div className={`bg-white rounded-2xl p-6 md:p-8 shadow-soft-lg depth-effect ${
                status.color === 'green' ? 'border-2 border-green-200 bg-green-50/50' :
                status.color === 'yellow' ? 'border-2 border-yellow-200 bg-yellow-50/50' :
                'border-2 border-red-200 bg-red-50/50'
              }`}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    status.color === 'green' ? 'bg-green-100' :
                    status.color === 'yellow' ? 'bg-yellow-100' :
                    'bg-red-100'
                  }`}>
                    <StatusIcon className={`w-8 h-8 ${
                      status.color === 'green' ? 'text-green-600' :
                      status.color === 'yellow' ? 'text-yellow-600' :
                      'text-red-600'
                    }`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className={`font-display text-2xl md:text-3xl font-bold ${
                      status.color === 'green' ? 'text-green-700' :
                      status.color === 'yellow' ? 'text-yellow-700' :
                      'text-red-700'
                    }`}>
                      {status.label}
                    </h3>
                    <p className="text-sm md:text-base text-brand-dark-brown/70 mt-1">
                      {checkedCount} de {totalItems} itens em dia ({percentage}%)
                    </p>
                  </div>
                </div>
                <p className="text-base md:text-lg text-brand-dark-brown/80 leading-relaxed">
                  {status.message}
                </p>
              </div>

              {/* Barra de progresso */}
              <div className="bg-white rounded-xl p-6 shadow-soft-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm md:text-base text-brand-dark-brown/70 font-medium">Progresso</span>
                  <span className="font-display text-xl md:text-2xl font-bold text-brand-brown">{percentage}%</span>
                </div>
                <div className="relative w-full h-4 bg-brand-beige/30 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
                      status.color === 'green' ? 'bg-gradient-to-r from-green-500 to-green-600' :
                      status.color === 'yellow' ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                      'bg-gradient-to-r from-red-500 to-red-600'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setShowResult(false);
                    setCheckedItems({});
                  }}
                  className="flex-1 px-6 py-3 bg-brand-brown text-white rounded-full font-semibold hover:bg-brand-olive transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1"
                >
                  Refazer Checklist
                </button>
                <button
                  onClick={() => document.getElementById('diagnostico')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex-1 px-6 py-3 bg-transparent border-2 border-brand-brown text-brand-brown rounded-full font-semibold hover:bg-brand-brown hover:text-white transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1"
                >
                  Fazer Diagnóstico Completo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

