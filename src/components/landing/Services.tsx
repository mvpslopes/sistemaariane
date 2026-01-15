import {
  UserPlus,
  Baby,
  ClipboardList,
  FileText,
  Stethoscope,
  Scan,
  Trophy,
  Monitor,
  Building2,
  RefreshCw,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

export default function Services() {
  const services = [
    {
      icon: UserPlus,
      title: 'Cadastros de novos associados',
    },
    {
      icon: Baby,
      title: 'Comunicados de prenhezes, embriões e nascimentos dentro do prazo estipulado pelas associações, evitando multas',
    },
    {
      icon: ClipboardList,
      title: 'Controle de plantel da gestação ao nascimento até o registro definitivo',
    },
    {
      icon: FileText,
      title: 'Contratos e controle de compra, venda e condomínios de animais',
    },
    {
      icon: Stethoscope,
      title: 'Abertura de serviços para o técnico e acompanhamento da visita',
    },
    {
      icon: Scan,
      title: 'Leitor de chip para conferência e identificação dos animais',
    },
    {
      icon: Trophy,
      title: 'Inscrições em copas e exposições',
    },
    {
      icon: Monitor,
      title: 'Sistema completo de gestão de plantel (Smart Criador)',
    },
    {
      icon: Building2,
      title: 'Toda demanda junto às associações das raças',
    },
    {
      icon: RefreshCw,
      title: 'Transferências de propriedade de animais',
    },
  ];

  return (
    <section
      id="servicos"
      className="py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white reveal"
      data-reveal
    >
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
            Serviços exclusivos
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-brand-brown mb-4">
            Nossos Serviços
          </h2>
          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
          <p className="text-brand-dark-brown/70 text-base md:text-lg leading-relaxed">
            Cuidado completo com as demandas do criador, do registro ao acompanhamento diário
            do plantel.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-7 max-w-7xl mx-auto">
          {services.map((service, index) => (
            <div
              key={index}
              className="relative group animate-scale-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-beige/50 via-white to-brand-off-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
              <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-7 border border-brand-beige/60 depth-effect card-transition hover-lift glow-effect glass-effect-strong group">
                {/* Borda dourada destacada no hover */}
                <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-brand-olive/80 transition-all duration-500 pointer-events-none" style={{
                  background: 'linear-gradient(135deg, rgba(160, 137, 106, 0.1), rgba(129, 112, 95, 0.05))',
                }} />
                
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-brown to-brand-olive rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-soft-lg">
                    <service.icon className="w-6 h-6 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
                  </div>
                  <p className="text-brand-dark-brown leading-relaxed text-sm md:text-base transition-colors duration-300 group-hover:text-brand-brown">
                    {service.title}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Banner de Diagnóstico */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="relative bg-gradient-to-r from-brand-brown via-brand-olive to-brand-brown rounded-2xl p-8 md:p-10 overflow-hidden depth-effect">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm mb-3">
                  <TrendingUp className="w-4 h-4 text-white" strokeWidth={2} />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">Diagnóstico Gratuito</span>
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-2">
                  Descubra o nível de maturidade da sua criação
                </h3>
                <p className="text-white/90 text-sm md:text-base">
                  Responda 4 perguntas rápidas e receba um diagnóstico personalizado com recomendações
                </p>
              </div>
              <button
                onClick={() => document.getElementById('diagnostico')?.scrollIntoView({ behavior: 'smooth' })}
                className="group px-8 py-4 bg-white text-brand-brown rounded-full font-bold text-base md:text-lg hover:bg-brand-beige transition-all duration-300 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1 hover:scale-105 inline-flex items-center gap-2 whitespace-nowrap"
              >
                Fazer Diagnóstico
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
