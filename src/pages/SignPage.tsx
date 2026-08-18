import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveClicksignSignerKey } from '../services/apiService';

declare global {
  interface Window {
    Clicksign?: new (signerKey: string) => {
      endpoint: string;
      origin: string;
      mount: (containerId: string) => void;
      unmount: () => void;
      on: (event: string, cb: (event: unknown) => void) => void;
    };
  }
}

const WIDGET_SRC = 'https://cdn-public-library.clicksign.com/embedded/embedded.min-2.1.0.js';

function readResizeHeight(event: unknown): number | null {
  if (typeof event === 'number' && event > 0) return event;
  if (!event || typeof event !== 'object') return null;
  const data = (event as { data?: unknown }).data;
  if (typeof data === 'number' && data > 0) return data;
  if (data && typeof data === 'object') {
    const h = (data as { height?: unknown }).height;
    if (typeof h === 'number' && h > 0) return h;
  }
  const h = (event as { height?: unknown }).height;
  if (typeof h === 'number' && h > 0) return h;
  return null;
}

async function loadWidgetScript(): Promise<void> {
  if (window.Clicksign) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar widget Clicksign')), {
        once: true,
      });
      if (window.Clicksign) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar widget Clicksign'));
    document.head.appendChild(script);
  });
}

async function fetchWidgetEndpoint(): Promise<string> {
  const fromEnv = import.meta.env.VITE_CLICKSIGN_ENDPOINT as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  try {
    const apiBase = (import.meta.env.VITE_API_URL as string) || '/api.php';
    const url = `${apiBase.replace(/\/$/, '')}/clicksign-widget`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (data?.endpoint) return String(data.endpoint).replace(/\/$/, '');
  } catch {
    /* fallback */
  }
  return 'https://app.clicksign.com';
}

export default function SignPage() {
  const { signerKey = '' } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<InstanceType<NonNullable<typeof window.Clicksign>> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed' | 'error'>('loading');
  const [error, setError] = useState('');
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const applyHeight = (requested?: number | null) => {
    const el = containerRef.current;
    if (!el) return;
    const min = Math.max(window.innerHeight - 88, 640);
    const next = Math.max(requested || 0, min);
    el.style.height = `${next}px`;
    el.style.minHeight = `${min}px`;
    const iframe = el.querySelector('iframe');
    if (iframe) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.minHeight = `${min}px`;
      iframe.style.border = '0';
      iframe.style.display = 'block';
    }
  };

  useEffect(() => {
    let cancelled = false;
    const key = signerKey.trim();
    if (!key) {
      setStatus('error');
      setError('Link de assinatura inválido');
      return;
    }

    (async () => {
      try {
        const resolved = await resolveClicksignSignerKey(key);
        if (cancelled) return;
        if (resolved.replaced && resolved.signerKey && resolved.signerKey !== key) {
          navigate(`/assinar/${encodeURIComponent(resolved.signerKey)}`, { replace: true });
          return;
        }
        setResolvedKey(resolved.signerKey || key);
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Link de assinatura inválido');
      }
    })();
  }, [signerKey, navigate]);

  useEffect(() => {
    let cancelled = false;
    const key = (resolvedKey || '').trim();
    if (!key) return;

    const onWinResize = () => applyHeight();
    window.addEventListener('resize', onWinResize);

    (async () => {
      try {
        await loadWidgetScript();
        if (cancelled || !window.Clicksign) {
          throw new Error('Widget Clicksign indisponível');
        }
        const endpoint = await fetchWidgetEndpoint();
        if (cancelled) return;

        if (widgetRef.current) {
          try {
            widgetRef.current.unmount();
          } catch {
            /* ignore */
          }
        }

        applyHeight();

        const widget = new window.Clicksign(key);
        widget.endpoint = endpoint;
        widget.origin = window.origin;
        widget.on('loaded', () => {
          if (cancelled) return;
          setStatus('ready');
          // Dá tempo do iframe montar e força altura útil
          requestAnimationFrame(() => applyHeight());
          setTimeout(() => applyHeight(), 300);
          setTimeout(() => applyHeight(), 1000);
        });
        widget.on('signed', () => {
          if (!cancelled) setStatus('signed');
        });
        widget.on('resized', (event) => {
          if (cancelled) return;
          applyHeight(readResizeHeight(event));
        });
        widget.mount('clicksign-container');
        widgetRef.current = widget;
        setStatus('ready');
        applyHeight();
      } catch (e: unknown) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : 'Não foi possível abrir a assinatura');
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onWinResize);
      if (widgetRef.current) {
        try {
          widgetRef.current.unmount();
        } catch {
          /* ignore */
        }
        widgetRef.current = null;
      }
    };
  }, [resolvedKey]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-off-white text-brand-dark-brown">
      <header className="shrink-0 border-b border-brand-beige bg-white px-4 py-3">
        <p className="text-sm font-semibold tracking-wide">Sistema Ariane</p>
        <p className="text-xs text-brand-olive">Assinatura digital do contrato</p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-0 py-0 sm:px-2 sm:py-2 md:px-4 md:py-3">
        {status === 'loading' && (
          <p className="m-3 rounded-xl border border-brand-beige bg-white px-4 py-6 text-sm text-brand-olive">
            Carregando documento para assinatura...
          </p>
        )}
        {status === 'error' && (
          <div className="m-3 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">
            <p className="font-medium">Não foi possível abrir a assinatura</p>
            <p className="mt-1">{error}</p>
            <p className="mt-3 text-red-600/80">
              Se o e-mail foi alterado recentemente, o link antigo deixa de funcionar. Peça um novo
              link no sistema (WhatsApp) ou abra o e-mail mais recente enviado pela Clicksign.
            </p>
          </div>
        )}
        {status === 'signed' && (
          <div className="mx-3 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-0">
            Documento assinado com sucesso. Você já pode fechar esta página.
          </div>
        )}
        <div
          id="clicksign-container"
          ref={containerRef}
          className="w-full flex-1 bg-white shadow-sm sm:rounded-xl sm:border sm:border-brand-beige"
          style={{ minHeight: 'calc(100vh - 88px)', height: 'calc(100vh - 88px)' }}
        />
      </main>
    </div>
  );
}
