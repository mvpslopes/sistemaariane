import { ArrowRight, Sparkles } from 'lucide-react';

export default function CTA() {
  const scrollToContact = () => {
    document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="cta" className="py-32 bg-gradient-to-br from-black via-brand-dark-brown to-brand-brown relative overflow-hidden reveal" data-reveal>
      {/* Background image do cavalo */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35]"
        style={{
          backgroundImage: "url('/ai-gerou-uma-imagem-de-cavalos.jpg')",
        }}
      />
      
      {/* Overlay escuro para manter legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-brand-dark-brown/70 to-brand-brown/65" />
      
      {/* Elementos decorativos */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 bg-brand-olive/40 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-brown/60 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/20 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:scale-105 hover:border-white/30">
              <Sparkles className="w-5 h-5 text-brand-beige animate-pulse transition-transform duration-300 hover:rotate-180" strokeWidth={1.5} />
              <span className="text-xs md:text-sm uppercase tracking-[0.35em] text-brand-beige">
                Assessoria premium
              </span>
            </div>
          </div>

          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Excelência e sucesso na sua criação!
          </h2>

          <p className="text-xl md:text-2xl text-white/85 mb-10 leading-relaxed">
            Junte-se aos criadores que confiam na nossa assessoria especializada e elevam o padrão
            de suas operações.
          </p>

          <button
            onClick={scrollToContact}
            className="group px-12 py-5 bg-white text-brand-brown rounded-full font-bold text-xl hover:bg-brand-beige transition-all duration-300 inline-flex items-center gap-3 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-2 hover:scale-105 mx-auto glow-effect"
          >
            Faça Parte
            <ArrowRight className="w-6 h-6 group-hover:translate-x-3 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
}
