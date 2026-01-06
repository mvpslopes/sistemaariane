import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface SessionWarningProps {
  onExtend: () => void;
  onLogout: () => void;
  timeRemaining: number; // em segundos
}

export default function SessionWarning({ onExtend, onLogout, timeRemaining }: SessionWarningProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mostrar aviso quando restarem 5 minutos
    if (timeRemaining <= 300 && timeRemaining > 0) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [timeRemaining]);

  if (!isVisible) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-lg shadow-soft-xl border-2 border-orange-400 p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-brand-brown mb-1">Sessão expirando</h3>
            <p className="text-sm text-brand-olive/70 mb-3">
              Sua sessão expirará em{' '}
              <span className="font-bold text-orange-600">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={onExtend}
                className="flex-1 px-4 py-2 bg-brand-brown text-white rounded-lg text-sm font-medium hover:bg-brand-brown/90 transition-colors"
              >
                Estender Sessão
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

