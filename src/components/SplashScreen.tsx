import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
  minDisplayTime?: number; // Tempo mínimo de exibição em ms
}

export default function SplashScreen({ onFinish, minDisplayTime = 2000 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onFinish();
      }, 500); // Delay para animação de fade out
    }, minDisplayTime);

    return () => clearTimeout(timer);
  }, [onFinish, minDisplayTime]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-brand-beige via-brand-off-white to-white transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="text-center animate-fade-in">
        {/* Logo */}
        <div className="mb-8 animate-scale-in">
          <img
            src="/logo-ariane-andrade.png"
            alt="Logo Ariane"
            className="h-24 md:h-32 mx-auto object-contain drop-shadow-lg"
            onError={(e) => {
              // Fallback se a logo não existir
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div id="logo-fallback" className="hidden w-20 h-20 bg-gradient-to-br from-brand-brown to-brand-olive rounded-full flex items-center justify-center mx-auto shadow-soft-lg">
            <Loader2 className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Loading Spinner */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-brand-olive/20 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-brand-brown border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
        </div>

        {/* Texto */}
        <p className="text-brand-brown/70 text-sm md:text-base font-medium animate-pulse">
          Carregando sistema...
        </p>

        {/* Barra de progresso */}
        <div className="mt-6 w-64 h-1 bg-brand-olive/20 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-brown to-brand-olive rounded-full animate-progress-bar"></div>
        </div>
      </div>
    </div>
  );
}

