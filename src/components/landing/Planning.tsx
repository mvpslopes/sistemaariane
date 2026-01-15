import { Target } from 'lucide-react';

export default function Planning() {
  return (
    <section id="planejamento" className="py-24 bg-gradient-to-br from-brand-brown via-brand-dark-brown to-black text-white relative overflow-hidden reveal" data-reveal>
      <div className="absolute inset-0 opacity-20">
        <div className="absolute -top-20 -left-10 w-72 h-72 bg-brand-olive rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-brown/60 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-white/10 border border-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-soft-lg transition-all duration-500 hover:scale-110 hover:rotate-6 hover:bg-white/15">
                <Target className="w-16 h-16 text-brand-beige transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
              </div>
            </div>

            <div className="flex-1">
              <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 text-xs md:text-sm uppercase tracking-[0.25em] text-brand-beige/80 mb-4">
                Etapa 1
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
                Planejamento
              </h2>
              <div className="w-20 h-[2px] bg-gradient-to-r from-brand-olive to-transparent mb-5 decorative-line" />
              <p className="text-lg md:text-xl text-brand-off-white/90 leading-relaxed">
                Analisar e definir os objetivos do criador e do criatório, direcionando todas as pendências e demandas
                para o setor operacional, cumprindo prazos estipulados pelas associações.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
