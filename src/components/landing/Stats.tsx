import { useState, useEffect, useRef } from 'react';
import { Award, Users, TrendingUp, Clock } from 'lucide-react';

const stats = [
  {
    icon: Clock,
    number: 15,
    suffix: '+',
    label: 'Anos de Experiência',
    description: 'Tradição e confiança no mercado',
    isCountable: true,
  },
  {
    icon: Users,
    number: 500,
    suffix: '+',
    label: 'Clientes Atendidos',
    description: 'Criadores satisfeitos',
    isCountable: true,
  },
  {
    icon: Award,
    number: 100,
    suffix: '%',
    label: 'Satisfação',
    description: 'Compromisso com excelência',
    isCountable: true,
  },
  {
    icon: TrendingUp,
    number: '24/7',
    suffix: '',
    label: 'Disponibilidade',
    description: 'Suporte sempre disponível',
    isCountable: false,
  },
];

export default function Stats() {
  const [countedValues, setCountedValues] = useState<number[]>(stats.map(() => 0));
  const [hasAnimated, setHasAnimated] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hasAnimated) return;

    // Função de easing (ease-out)
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const animateNumber = (index: number, target: number, duration: number) => {
      const startTime = performance.now();
      
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);
        const current = Math.floor(eased * target);
        
        setCountedValues((prev) => {
          const newValues = [...prev];
          newValues[index] = current;
          return newValues;
        });
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            
            // Animar cada número com delay escalonado
            stats.forEach((stat, index) => {
              if (stat.isCountable && typeof stat.number === 'number') {
                setTimeout(() => {
                  animateNumber(index, stat.number as number, 2000);
                }, index * 150); // Delay escalonado de 150ms entre cada número
              }
            });
          }
        });
      },
      {
        threshold: 0.3,
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [hasAnimated]);
  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-gradient-to-b from-white via-brand-off-white to-white reveal" data-reveal>
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-brand-beige/40 text-xs md:text-sm uppercase tracking-[0.2em] text-brand-dark-brown/70 mb-4">
              Nossos Números
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-4">
              Resultados que Falam por Si
            </h2>
            <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-brand-olive to-transparent mx-auto mb-4 decorative-line" />
            <p className="text-brand-dark-brown/70 text-base md:text-lg max-w-2xl mx-auto">
              Anos de dedicação traduzidos em números que comprovam nossa excelência e compromisso
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="group relative bg-white/90 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-brand-beige/60 depth-effect card-transition hover-lift glow-effect animate-scale-in glass-effect"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Borda dourada no hover */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-brand-olive/60 transition-all duration-500 pointer-events-none" />
                  
                  <div className="relative z-10 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-soft-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6">
                      <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-brand-brown mb-2">
                      {stat.isCountable && typeof stat.number === 'number' 
                        ? `${countedValues[index]}${stat.suffix}`
                        : stat.number}
                    </div>
                    <h3 className="font-display text-sm md:text-base font-semibold text-brand-brown mb-1">
                      {stat.label}
                    </h3>
                    <p className="text-xs md:text-sm text-brand-dark-brown/60">
                      {stat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

