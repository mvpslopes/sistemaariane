import { useState, type ReactNode } from 'react';
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useIsMobile } from '../hooks/useIsMobile';

interface PwaInstallBannerProps {
  /** Posição vertical: topo (app) ou rodapé (login). */
  placement?: 'top' | 'bottom';
  /** Espaço extra quando placement=bottom (px aprox. da bottom nav). */
  bottomOffsetClass?: string;
}

export default function PwaInstallBanner({
  placement = 'top',
  bottomOffsetClass = 'bottom-[5.5rem]',
}: PwaInstallBannerProps) {
  const isMobile = useIsMobile();
  const {
    visible,
    canInstallAndroid,
    canShowIosHelp,
    canShowAndroidHelp,
    install,
    dismiss,
  } = usePwaInstall();
  const [helpOpen, setHelpOpen] = useState<'ios' | 'android' | null>(null);
  const [installing, setInstalling] = useState(false);

  if (!isMobile || !visible) return null;

  const onPrimary = async () => {
    if (canInstallAndroid) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }
    if (canShowIosHelp) setHelpOpen('ios');
    else if (canShowAndroidHelp) setHelpOpen('android');
    else setHelpOpen('android');
  };

  const subtitle = canInstallAndroid
    ? 'Acesso rápido na tela inicial, como um app.'
    : canShowIosHelp
      ? 'No iPhone, adicione à Tela de Início pelo Safari.'
      : 'Adicione à tela inicial pelo menu do navegador.';

  const primaryLabel = canInstallAndroid
    ? installing
      ? 'Instalando…'
      : 'Instalar app'
    : 'Como instalar';

  const positionClass =
    placement === 'bottom'
      ? bottomOffsetClass
      : 'top-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))]';

  return (
    <>
      <div
        className={`fixed inset-x-3 z-[45] mx-auto max-w-lg rounded-2xl border border-brand-gold/35 bg-gradient-to-br from-brand-dark-brown to-[#3d2f26] p-3.5 text-white shadow-xl md:hidden ${positionClass}`}
        role="region"
        aria-label="Instalar aplicativo"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">Instale o Gestão de Haras</p>
            <p className="mt-0.5 text-xs text-brand-beige/75">{subtitle}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrimary}
                disabled={installing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-gold px-3 py-1.5 text-xs font-semibold text-brand-dark-brown transition hover:bg-brand-gold-light disabled:opacity-60"
              >
                {canInstallAndroid ? (
                  <Download className="h-3.5 w-3.5" />
                ) : (
                  <Share className="h-3.5 w-3.5" />
                )}
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-xl px-2.5 py-1.5 text-xs font-medium text-brand-beige/80 hover:bg-white/10"
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-beige/70 hover:bg-white/10"
            aria-label="Fechar aviso de instalação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {helpOpen === 'ios' && (
        <InstallHelpModal
          title="Instalar no iPhone"
          onClose={() => setHelpOpen(null)}
          onDismiss={dismiss}
        >
          <ol className="list-decimal space-y-2 pl-4 text-sm text-neutral-700">
            <li>
              Abra este site no <strong>Safari</strong> (no Chrome do iPhone o processo é limitado).
            </li>
            <li>
              Toque em <strong>Compartilhar</strong> (ícone de quadrado com seta para cima).
            </li>
            <li>
              Escolha <strong>Adicionar à Tela de Início</strong>.
            </li>
            <li>
              Confirme — o ícone <strong>Gestão de Haras</strong> aparecerá na home.
            </li>
          </ol>
        </InstallHelpModal>
      )}

      {helpOpen === 'android' && (
        <InstallHelpModal
          title="Instalar no Android"
          onClose={() => setHelpOpen(null)}
          onDismiss={dismiss}
        >
          <ol className="list-decimal space-y-2 pl-4 text-sm text-neutral-700">
            <li>
              Use o <strong>Chrome</strong> para abrir o sistema (recomendado).
            </li>
            <li>
              Toque no menu <strong>⋮</strong> (três pontinhos) no canto superior direito.
            </li>
            <li>
              Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
            </li>
            <li>
              Confirme — o atalho <strong>Gestão de Haras</strong> ficará na home do celular.
            </li>
          </ol>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-brand-off-white px-3 py-2 text-xs text-neutral-600">
            <MoreVertical className="mt-0.5 h-4 w-4 shrink-0 text-brand-brown" />
            Se o botão “Instalar app” não aparecer no menu, o Chrome ainda não liberou a instalação
            automática — use “Adicionar à tela inicial”.
          </p>
        </InstallHelpModal>
      )}
    </>
  );
}

function InstallHelpModal({
  title,
  children,
  onClose,
  onDismiss,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/45 md:hidden" onClick={onClose} aria-hidden />
      <div
        className="fixed inset-x-4 top-[max(2rem,env(safe-area-inset-top))] z-[61] mx-auto max-w-sm rounded-2xl border border-brand-beige bg-white p-5 shadow-2xl md:hidden"
        role="dialog"
        aria-label={title}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-neutral-950">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-500 hover:bg-brand-off-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <button
          type="button"
          onClick={() => {
            onClose();
            onDismiss();
          }}
          className="mt-4 w-full rounded-xl bg-brand-brown py-2.5 text-sm font-semibold text-white"
        >
          Entendi
        </button>
      </div>
    </>
  );
}
