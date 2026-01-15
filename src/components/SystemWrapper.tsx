import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SplashScreen from './SplashScreen';

interface SystemWrapperProps {
  children: React.ReactNode;
}

const SPLASH_SHOWN_KEY = 'system_splash_shown';

export default function SystemWrapper({ children }: SystemWrapperProps) {
  const [showSplash, setShowSplash] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Mostrar splash apenas quando acessar /login pela primeira vez na sessão
    const isLoginPage = location.pathname === '/login';
    const hasShownSplash = sessionStorage.getItem(SPLASH_SHOWN_KEY) === 'true';
    
    // Verificar se veio da landing page através do state de navegação
    const navigationState = window.history.state?.usr;
    const fromLanding = navigationState?.from === '/';
    
    // Mostrar splash se:
    // 1. Está na página de login
    // 2. Veio da landing page OU é a primeira vez acessando o sistema
    // 3. Ainda não mostrou splash nesta sessão
    if (isLoginPage && (fromLanding || !hasShownSplash) && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
    }
  }, [location.pathname]);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return <>{children}</>;
}
