import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'pwa_install_dismiss_v2';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as Window & { MSStream?: unknown }).MSStream
  );
}

function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return raw === '1';
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandaloneMode);
  const [ios, setIos] = useState(isIosDevice);
  const [android, setAndroid] = useState(isAndroidDevice);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    setStandalone(isStandaloneMode());
    setIos(isIosDevice());
    setAndroid(isAndroidDevice());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setStandalone(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const canInstallAndroid = !!deferredPrompt && !standalone;
  const canShowIosHelp = ios && !standalone;
  const canShowAndroidHelp = android && !ios && !standalone;

  /** Exibe no mobile sempre que não estiver instalado — Android não depende só do evento do Chrome. */
  const visible = !standalone && !dismissed;

  return {
    visible,
    canInstallAndroid,
    canShowIosHelp,
    canShowAndroidHelp,
    standalone,
    install,
    dismiss,
  };
}
