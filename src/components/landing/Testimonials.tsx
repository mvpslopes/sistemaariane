import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'João Silva',
    haras: 'Haras Coroado',
    text: 'A assessoria da Ariane transformou completamente a organização do nosso criatório. Agora temos total controle e tranquilidade com os prazos e documentações.',
    rating: 5,
  },
  {
    name: 'Maria Santos',
    haras: 'Haras Juparanã',
    text: 'Profissionalismo e dedicação incomparáveis. A equipe sempre está disponível e nos ajuda a evitar multas e problemas com as associações.',
    rating: 5,
  },
  {
    name: 'Carlos Oliveira',
    haras: 'Haras Lubrelo',
    text: 'Mais de 10 anos trabalhando juntos e nunca tivemos problemas. A assessoria é essencial para quem quer ter um criatório bem estruturado.',
    rating: 5,
  },
];

export default function Testimonials() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
              Depoimentos
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-4">
              O Que Nossos Clientes Dizem
            </h2>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
            <p className="text-brand-dark-brown/70 text-base md:text-lg max-w-2xl mx-auto">
              A confiança e satisfação dos nossos clientes é o nosso maior orgulho
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-brand-beige/60 depth-effect card-transition hover-lift glow-effect glass-effect animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Ícone de aspas decorativo */}
                <div className="absolute top-4 right-4 w-12 h-12 bg-brand-olive/10 rounded-full flex items-center justify-center">
                  <Quote className="w-6 h-6 text-brand-olive" strokeWidth={1.5} />
                </div>

                {/* Avaliação com estrelas */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-brand-olive text-brand-olive"
                      strokeWidth={1.5}
                    />
                  ))}
                </div>

                {/* Texto do depoimento */}
                <p className="text-brand-dark-brown/80 leading-relaxed text-sm md:text-base mb-6 pr-4">
                  "{testimonial.text}"
                </p>

                {/* Informações do cliente */}
                <div className="pt-4 border-t border-brand-beige/40">
                  <p className="font-display font-semibold text-brand-brown text-sm md:text-base">
                    {testimonial.name}
                  </p>
                  <p className="text-xs md:text-sm text-brand-dark-brown/60">
                    {testimonial.haras}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

