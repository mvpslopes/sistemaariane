import { useState, useEffect, useRef } from 'react';
import { ArrowRight, BadgeCheck, Menu, X, Users, Award, TrendingUp, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);
  const [yearsCount, setYearsCount] = useState(0);
  const [confidenceCount, setConfidenceCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('section');
      if (heroSection) {
        const rect = heroSection.getBoundingClientRect();
        const offset = Math.max(0, -rect.top) * 0.2;
        setParallaxOffset(offset);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (hasAnimated) return;

    // Função de easing (ease-out)
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const animateNumber = (
      setter: (value: number) => void,
      target: number,
      duration: number,
      delay: number = 0
    ) => {
      setTimeout(() => {
        const startTime = performance.now();
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutCubic(progress);
          const current = Math.floor(eased * target);
          
          setter(current);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        
        requestAnimationFrame(animate);
      }, delay);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            // Animar os números com delay escalonado
            animateNumber(setClientsCount, 500, 2000, 0);
            animateNumber(setYearsCount, 15, 2000, 200);
            animateNumber(setConfidenceCount, 100, 2000, 400);
          }
        });
      },
      {
        threshold: 0.2,
      }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    return () => {
      if (heroRef.current) {
        observer.unobserve(heroRef.current);
      }
    };
  }, [hasAnimated]);

  const scrollToContact = () => {
    document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToServices = () => {
    document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToAbout = () => {
    document.getElementById('sobre')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToPlanning = () => {
    document.getElementById('planejamento')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToExecution = () => {
    document.getElementById('execucao')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToClients = () => {
    document.getElementById('clientes')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToDiagnostic = () => {
    document.getElementById('diagnostico')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToChecklist = () => {
    document.getElementById('checklist')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const scrollToFAQ = () => {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden hero-background">
      {/* Formas geométricas animadas flutuantes */}
      <div className="absolute inset-0 opacity-20 overflow-hidden">
        <div className="absolute -top-16 left-16 w-72 h-72 bg-brand-brown rounded-[40px] blur-3xl floating-shape" style={{ animationDelay: '0s', animationDuration: '20s' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-olive rounded-full blur-3xl floating-shape" style={{ animationDelay: '2s', animationDuration: '25s' }} />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 bg-brand-beige rounded-2xl blur-2xl floating-shape" style={{ animationDelay: '4s', animationDuration: '18s' }} />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-brand-olive/60 rounded-full blur-3xl floating-shape" style={{ animationDelay: '6s', animationDuration: '22s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-40 h-40 bg-brand-brown/50 rounded-[30px] blur-2xl floating-shape" style={{ animationDelay: '8s', animationDuration: '15s' }} />
      </div>

      {/* Header flutuante */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full px-4 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between rounded-full bg-white/80 backdrop-blur-xl border border-white/80 shadow-soft-lg px-4 md:px-6 py-2.5 transition-all duration-300 hover:shadow-soft-lg hover:bg-white/85">
          <div className="flex items-center gap-3 logo-shimmer flex-shrink-0">
            <img
              src="/logo-ariane-wide.png"
              alt="Logo Ariane Andrade Assessoria"
              className="h-7 md:h-9 object-contain transition-transform duration-300 hover:scale-105"
            />
          </div>

          {/* Menu Desktop */}
          <div className="hidden md:flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-brand-dark-brown/80 flex-1 justify-end min-w-0">
            <button
              type="button"
              onClick={scrollToAbout}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Sobre
            </button>
            <button
              type="button"
              onClick={scrollToServices}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Serviços
            </button>
            <button
              type="button"
              onClick={scrollToChecklist}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Checklist
            </button>
            <button
              type="button"
              onClick={scrollToDiagnostic}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Diagnóstico
            </button>
            <button
              type="button"
              onClick={scrollToFAQ}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={scrollToPlanning}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Planejamento
            </button>
            <button
              type="button"
              onClick={scrollToExecution}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Execução
            </button>
            <button
              type="button"
              onClick={scrollToClients}
              className="relative px-2 py-1 hover:text-brand-brown transition-all duration-300 hover:scale-105 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-brand-brown after:transition-all after:duration-300 hover:after:w-full"
            >
              Clientes
            </button>
            <button
              type="button"
              onClick={scrollToContact}
              className="px-3 py-1.5 rounded-full bg-brand-brown text-white text-xs font-semibold hover:bg-brand-olive transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:scale-105 hover:-translate-y-0.5 whitespace-nowrap flex-shrink-0"
            >
              Contato
            </button>
            <button
              type="button"
              onClick={() => navigate('/login', { state: { from: '/' } })}
              className="px-3 py-1.5 rounded-full bg-brand-olive text-white text-xs font-semibold hover:bg-brand-brown transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:scale-105 hover:-translate-y-0.5 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
            >
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden xl:inline">Acessar Sistema</span>
              <span className="xl:hidden">Sistema</span>
            </button>
          </div>

          {/* Botão Menu Mobile */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-full bg-brand-brown/10 hover:bg-brand-brown/20 transition-colors"
            aria-label="Menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-brand-brown" />
            ) : (
              <Menu className="w-6 h-6 text-brand-brown" />
            )}
          </button>
        </div>

        {/* Menu Mobile Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden mt-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/80 shadow-soft-lg overflow-hidden animate-scale-in">
            <div className="py-2">
              <button
                type="button"
                onClick={scrollToAbout}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Sobre
              </button>
              <button
                type="button"
                onClick={scrollToServices}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Serviços
              </button>
              <button
                type="button"
                onClick={scrollToChecklist}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Checklist
              </button>
              <button
                type="button"
                onClick={scrollToDiagnostic}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Diagnóstico
              </button>
              <button
                type="button"
                onClick={scrollToFAQ}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={scrollToPlanning}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Planejamento
              </button>
              <button
                type="button"
                onClick={scrollToExecution}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Execução
              </button>
              <button
                type="button"
                onClick={scrollToClients}
                className="w-full text-left px-6 py-3 text-sm text-brand-dark-brown/80 hover:text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Clientes
              </button>
              <button
                type="button"
                onClick={scrollToContact}
                className="w-full text-left px-6 py-3 text-sm font-semibold text-brand-brown hover:bg-brand-beige/30 transition-colors"
              >
                Contato
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/login');
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-6 py-3 text-sm font-semibold text-brand-olive hover:bg-brand-beige/30 transition-colors flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Acessar Sistema
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="container mx-auto px-6 py-16 md:py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-6xl mx-auto">
          {/* Coluna esquerda – texto */}
          <div className="max-w-xl space-y-7 pt-10 md:pt-12">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/60 text-xs md:text-sm uppercase tracking-[0.25em] text-brand-dark-brown/80">
                Assessoria ao Criador
              </span>
              <h1 className="font-display text-4xl md:text-[2.9rem] lg:text-[3.4rem] font-bold text-brand-brown leading-tight">
                Organização e excelência para o seu criatório
              </h1>
            </div>

            {/* Badge de Confiança */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm border border-brand-beige/60 shadow-soft">
                <Users className="w-4 h-4 text-brand-olive" />
                <span className="text-xs md:text-sm font-semibold text-brand-brown">{clientsCount}+ Clientes</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm border border-brand-beige/60 shadow-soft">
                <Award className="w-4 h-4 text-brand-olive" />
                <span className="text-xs md:text-sm font-semibold text-brand-brown">{yearsCount} Anos</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-sm border border-brand-beige/60 shadow-soft">
                <TrendingUp className="w-4 h-4 text-brand-olive" />
                <span className="text-xs md:text-sm font-semibold text-brand-brown">{confidenceCount}% Confiança</span>
              </div>
            </div>

            <p className="text-base md:text-[1.05rem] text-brand-dark-brown/80 leading-relaxed max-w-[34rem]">
              Oferecemos aos criadores um atendimento de qualidade, personalizado de acordo com as demandas de cada
              cliente. Garantimos tranquilidade, organização e cumprimento de prazos junto às associações.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={scrollToContact}
                className="group px-9 py-4 bg-brand-olive text-white rounded-full font-semibold text-lg hover:bg-brand-brown transition-all duration-300 flex items-center gap-2 shadow-soft-lg hover:shadow-soft-lg transform hover:-translate-y-1.5 hover:scale-105 glow-effect"
              >
                Fale Conosco
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </button>
              <button
                onClick={scrollToServices}
                className="px-8 py-4 bg-transparent border-2 border-brand-brown/40 text-brand-brown/90 rounded-full font-medium text-lg hover:bg-brand-brown hover:text-white hover:border-brand-brown transition-all duration-300 shadow-soft hover:shadow-soft-lg transform hover:-translate-y-1.5 hover:scale-105"
              >
                Conheça Nossos Serviços
              </button>
            </div>
          </div>

          {/* Coluna direita – card com foto da Ariane */}
          <div className="relative mt-6 lg:mt-0">
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-off-white rounded-3xl -z-10" />
            <div className="absolute -bottom-8 -left-6 w-32 h-32 bg-brand-beige/70 rounded-full blur-xl -z-10" />

            <div className="relative rounded-[32px] bg-white/85 backdrop-blur-md border border-brand-beige/70 depth-effect overflow-hidden card-transition hover-lift">
              <div className="flex flex-col h-full">
                <div className="relative h-72 md:h-80 lg:h-96 overflow-hidden">
                  <img
                    src="/foto-ariane-fundo.JPG"
                    alt="Ariane Andrade em atendimento"
                    className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                    style={{
                      transform: `translateY(${parallaxOffset}px)`,
                    }}
                  />
                </div>

                <div className="px-6 py-4 border-t border-brand-beige/70 flex items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-brand-dark-brown/60 mb-1">
                      <BadgeCheck className="w-3 h-3 md:w-4 md:h-4 text-brand-brown" />
                      Escritório responsável
                    </p>
                    <p className="text-xs md:text-sm font-semibold text-brand-brown">
                      Gestão de cadastros, contratos e leilões do Grupo Raça
                    </p>
                  </div>
                  <img
                    src="/gruporaca.png"
                    alt="Logo Grupo Raça"
                    className="h-9 md:h-10 w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
