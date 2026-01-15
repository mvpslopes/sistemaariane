import { Zap } from 'lucide-react';

export default function Execution() {
  return (
    <section id="execucao" className="py-24 bg-gradient-to-tr from-black via-brand-dark-brown to-brand-brown text-white relative overflow-hidden reveal" data-reveal>
      <div className="absolute inset-0 opacity-25">
        <div className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-brand-brown to-transparent" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-shrink-0">
              <div className="w-32 h-32 bg-white/10 border border-white/25 backdrop-blur-md rounded-full flex items-center justify-center shadow-soft-lg transition-all duration-500 hover:scale-110 hover:rotate-6 hover:bg-white/15">
                <Zap className="w-16 h-16 text-brand-beige transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
              </div>
            </div>

            <div className="flex-1 md:text-right">
              <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/5 text-xs md:text-sm uppercase tracking-[0.25em] text-brand-beige/80 mb-4">
                Etapa 2
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
                Execução
              </h2>
              <div className="w-20 h-[2px] bg-gradient-to-l from-brand-olive to-transparent ml-auto mb-5 decorative-line" />
              <p className="text-lg md:text-xl text-white/90 leading-relaxed">
                Oferecemos um atendimento humanizado, ágil e prático, solucionando as necessidades do cliente e do
                criatório conforme a demanda.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
