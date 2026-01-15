import { Award, Clock, Heart } from 'lucide-react';

export default function About() {
  const values = [
    {
      icon: Heart,
      title: 'Atendimento Personalizado',
      description: 'Cada cliente recebe atenção individualizada',
    },
    {
      icon: Clock,
      title: 'Cumprimento de Prazos',
      description: 'Organização e pontualidade em cada etapa',
    },
    {
      icon: Award,
      title: 'Excelência',
      description: 'Qualidade e profissionalismo garantidos',
    },
  ];

  return (
    <section id="sobre" className="py-24 bg-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-6 -left-6 w-24 h-24 bg-brand-beige rounded-3xl -z-10" />
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-off-white rounded-full -z-10" />
            <img
              src="/imagem-ariane.PNG"
              alt="Ariane Andrade em atendimento a criadores"
              className="w-full rounded-3xl object-cover depth-effect max-h-[420px] transition-transform duration-700 hover:scale-[1.02]"
            />
          </div>

          <div className="space-y-8">
            <div className="text-left">
              <h2 className="font-display text-4xl md:text-5xl lg:text-[3.1rem] font-bold text-brand-brown mb-4 leading-tight">
            Sobre a Assessoria
          </h2>
              <p className="text-base md:text-lg text-brand-dark-brown/80 leading-relaxed max-w-xl">
                Oferecemos aos criadores um atendimento de qualidade, personalizado de acordo com as demandas de cada cliente,
                garantindo organização, cumprimento de prazos e excelência em cada etapa da criação.
          </p>
        </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 items-stretch">
          {values.map((value, index) => (
            <div
              key={index}
                  className="group bg-brand-off-white rounded-xl p-6 text-left depth-effect card-transition hover-lift border border-brand-beige flex flex-col h-full glow-effect animate-scale-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
            >
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center mb-4 shadow-soft-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <value.icon className="w-7 h-7 text-brand-off-white transition-transform duration-300 group-hover:scale-110" strokeWidth={1.5} />
              </div>
                  <h3 className="font-display text-base md:text-lg font-semibold text-brand-brown mb-2 transition-colors duration-300 group-hover:text-brand-olive">
                {value.title}
              </h3>
                  <p className="text-brand-dark-brown/70 text-xs md:text-sm leading-relaxed flex-1">
                {value.description}
              </p>
            </div>
          ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
