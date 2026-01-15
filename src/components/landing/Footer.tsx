import { useState } from 'react';
import { MapPin, Phone, Mail, Instagram, Facebook, Linkedin, Youtube, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import PrivacyPolicy from './PrivacyPolicy';

export default function Footer() {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  return (
    <footer id="contato" className="bg-brand-off-white text-brand-dark-brown">
      <div className="container mx-auto px-6 py-14">
        <div className="grid gap-10 lg:gap-16 mb-10 md:grid-cols-2 items-start">
          {/* Bloco de informações */}
          <div className="space-y-6">
            {/* Card Telefones */}
            <div className="relative bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-brand-beige/50 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-beige/40">
                <div className="w-10 h-10 rounded-full bg-brand-brown/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-brand-brown" />
            </div>
                <h3 className="font-display text-xl font-semibold text-brand-brown">Telefones</h3>
          </div>
              <div className="space-y-3 text-sm md:text-base">
                <div className="pb-3 border-b border-brand-beige/20 last:border-0 last:pb-0">
                  <span className="text-brand-brown font-semibold block mb-0.5">Escritório</span>
                  <a href="tel:+552133289772" className="text-brand-dark-brown/80 hover:text-brand-brown transition-colors">
                    (21) 3328-9772
                  </a>
            </div>
                <div className="pb-3 border-b border-brand-beige/20 last:border-0 last:pb-0">
                  <span className="text-brand-brown font-semibold block mb-0.5">Ariane Andrade</span>
                  <a href="tel:+5521981972847" className="text-brand-dark-brown/80 hover:text-brand-brown transition-colors">
                (21) 98197-2847
                  </a>
                </div>
                <div className="pb-3 border-b border-brand-beige/20 last:border-0 last:pb-0">
                  <span className="text-brand-brown font-semibold block mb-0.5">Atendimento Geral</span>
                  <a href="tel:+5521999293866" className="text-brand-dark-brown/80 hover:text-brand-brown transition-colors">
                (21) 99929-3866
                  </a>
                </div>
                <div>
                  <span className="text-brand-brown font-semibold block mb-0.5">Assessoria ao Criador</span>
                  <a href="tel:+5531990790604" className="text-brand-dark-brown/80 hover:text-brand-brown transition-colors">
                (31) 99079-0604
                  </a>
            </div>
          </div>
            </div>

            {/* Card E-mail */}
            <div className="relative bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-brand-beige/50 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-beige/40">
                <div className="w-10 h-10 rounded-full bg-brand-brown/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-brand-brown" />
                </div>
                <h3 className="font-display text-xl font-semibold text-brand-brown">E-mail</h3>
            </div>
            <a
              href="mailto:contato@arianeandradeassessoria.com.br"
                className="text-sm md:text-base text-brand-dark-brown/80 hover:text-brand-brown transition-colors break-words inline-block"
            >
              contato@arianeandradeassessoria.com.br
            </a>
            </div>

            {/* Card Endereço */}
            <div className="relative bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-brand-beige/50 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-beige/40">
                <div className="w-10 h-10 rounded-full bg-brand-brown/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-brand-brown" />
          </div>
                <h3 className="font-display text-xl font-semibold text-brand-brown">Endereço</h3>
        </div>
              <p className="text-sm md:text-base text-brand-dark-brown/80 leading-relaxed">
                Rua Campo Grande, nº 1014, SL 223<br />
                Passeio Empresarial<br />
                Campo Grande, Rio de Janeiro | RJ<br />
                CEP 23.080-000
              </p>
            </div>
          </div>

          {/* Formulário de contato */}
          <div className="bg-brand-dark-brown text-white border border-brand-brown/40 rounded-2xl p-6 md:p-8 space-y-4">
            <h3 className="font-display text-xl md:text-2xl font-semibold text-brand-beige mb-2">
              Envie uma mensagem
            </h3>
            <p className="text-xs md:text-sm text-white/85 mb-2">
              Preencha os campos abaixo e entraremos em contato o mais breve possível.
            </p>
            <form
              className="space-y-4 text-sm md:text-base"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="space-y-1">
                <label htmlFor="contato-nome" className="block text-white/90">
                  Nome
                </label>
                <input
                  id="contato-nome"
                  type="text"
                  className="w-full rounded-lg border border-brand-brown/30 bg-white px-3 py-2 text-sm text-brand-dark-brown placeholder-brand-dark-brown/50 focus:outline-none focus:ring-2 focus:ring-brand-beige focus:border-transparent"
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="contato-email" className="block text-white/90">
                  E-mail
                </label>
                <input
                  id="contato-email"
                  type="email"
                  className="w-full rounded-lg border border-brand-brown/30 bg-white px-3 py-2 text-sm text-brand-dark-brown placeholder-brand-dark-brown/50 focus:outline-none focus:ring-2 focus:ring-brand-beige focus:border-transparent"
                  placeholder="seuemail@exemplo.com"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="contato-mensagem" className="block text-white/90">
                  Mensagem
                </label>
                <textarea
                  id="contato-mensagem"
                  rows={3}
                  className="w-full rounded-lg border border-brand-brown/30 bg-white px-3 py-2 text-sm text-brand-dark-brown placeholder-brand-dark-brown/50 focus:outline-none focus:ring-2 focus:ring-brand-beige focus:border-transparent resize-none"
                  placeholder="Conte um pouco sobre a sua necessidade"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-brand-beige text-brand-dark-brown font-semibold text-sm md:text-base hover:bg-white transition-colors duration-200 shadow-md"
              >
                Enviar mensagem
              </button>
            </form>
          </div>
        </div>

        {/* Redes Sociais */}
        <div className="mt-10 pt-8 border-t border-brand-beige/40">
          <div className="max-w-4xl mx-auto">
            <h3 className="font-display text-lg md:text-xl font-semibold text-brand-brown text-center mb-4">
              Siga-nos nas Redes Sociais
            </h3>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-brand-brown/10 hover:bg-brand-brown text-brand-brown hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-soft-lg"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-brand-brown/10 hover:bg-brand-brown text-brand-brown hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-soft-lg"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-brand-brown/10 hover:bg-brand-brown text-brand-brown hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-soft-lg"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" strokeWidth={1.5} />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-brand-brown/10 hover:bg-brand-brown text-brand-brown hover:text-white flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-soft-lg"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5" strokeWidth={1.5} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Faixa inferior menor e escura */}
      <div className="bg-brand-dark-brown text-white py-4">
        <div className="container mx-auto px-6 flex flex-col gap-1 text-center">
          <p className="text-xs md:text-sm text-white/90">
            <span className="font-semibold text-brand-beige">Razão Social:&nbsp;</span>
            Ariane Andrade Inteligência Agropecuária Ltda&nbsp;&nbsp;|&nbsp;&nbsp;
            <span className="font-semibold text-brand-beige">CNPJ:&nbsp;</span>
            43.507.435/0001-30
          </p>
          <p className="text-[0.7rem] md:text-xs text-white/60 mt-0.5">
            &copy; {new Date().getFullYear()} Ariane Andrade Assessoria. Todos os direitos reservados.
            {' '}
            <button
              onClick={() => setShowPrivacyPolicy(true)}
              className="underline hover:text-brand-beige transition-colors"
            >
              Política de Privacidade
            </button>
          </p>
          
          {/* Botão de acesso ao sistema interno */}
          <div className="mt-3 pt-3 border-t border-white/10">
            <Link
              to="/login"
              state={{ from: '/' }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm text-white/70 hover:text-brand-beige bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 hover:border-brand-beige/30 transition-all duration-200"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Acesso ao Sistema Interno</span>
            </Link>
          </div>
        </div>
      </div>
      <PrivacyPolicy isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
    </footer>
  );
}
