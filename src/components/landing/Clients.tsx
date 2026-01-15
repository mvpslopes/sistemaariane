import { Users } from 'lucide-react';

const clients = [
  {
    name: 'Haras Coroado',
    logo: '/clientes/Haras-Coroado.png',
  },
  {
    name: 'Haras Juparanã',
    logo: '/clientes/Haras-Juparanã.png',
  },
  {
    name: 'Haras Lubrelo',
    logo: '/clientes/Haras-Lubrelo.png',
  },
  {
    name: 'Haras Três Lês',
    logo: '/clientes/Haras-Tres.png',
  },
  {
    name: 'FHT',
    logo: '/clientes/FHT.png',
  },
];

export default function Clients() {
  return (
    <section id="clientes" className="py-24 bg-gradient-to-b from-brand-off-white via-white to-brand-off-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center shadow-soft-lg transition-all duration-300 hover:scale-110 hover:rotate-6">
              <Users className="w-7 h-7 text-brand-off-white transition-transform duration-300 hover:scale-110" strokeWidth={1.5} />
            </div>
          </div>

          <h2 className="font-display text-4xl md:text-5xl font-bold text-brand-brown mb-3">
            Alguns Clientes
          </h2>
          <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-8 decorative-line" />
          <p className="text-brand-dark-brown/70 text-base md:text-lg mb-10">
            Parcerias que reforçam a confiança no nosso trabalho e na seriedade da assessoria.
          </p>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            {clients.map((client, index) => (
              <div
                key={client.name}
                className="relative rounded-2xl depth-effect border border-brand-brown/10 bg-white/90 backdrop-blur-sm px-6 py-10 flex items-center justify-center card-transition hover-lift glow-effect animate-scale-in"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="w-full flex items-center justify-center">
                  <img
                    src={client.logo}
                    alt={`Logo ${client.name}`}
                    className="max-h-28 md:max-h-32 w-auto object-contain transition-all duration-500 hover:scale-110 filter hover:brightness-110"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
