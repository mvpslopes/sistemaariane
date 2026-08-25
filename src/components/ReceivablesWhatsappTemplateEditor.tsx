import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import AppButton from './AppButton';
import Modal from './Modal';
import {
  DEFAULT_COLLECTION_BANK_DETAILS,
  DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
  RECEIVABLES_WHATSAPP_PLACEHOLDERS,
} from '../utils/receivablesWhatsapp';
import type { CollectionWhatsappSettings } from '../services/apiService';

type Props = {
  settings: CollectionWhatsappSettings;
  onSave: (next: CollectionWhatsappSettings) => Promise<void>;
  canSaveToServer?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
};

export default function ReceivablesWhatsappTemplateEditor({
  settings,
  onSave,
  canSaveToServer = true,
  triggerClassName,
  triggerLabel = 'Personalizar mensagem',
}: Props) {
  const [open, setOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState(settings.template);
  const [bankDraft, setBankDraft] = useState(settings.bankDetails);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTemplateDraft(settings.template);
      setBankDraft(settings.bankDetails);
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        template: templateDraft.trim() || DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
        bankDetails: bankDraft.trim(),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ||
          'inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline'
        }
      >
        <Settings2 className="h-3.5 w-3.5" />
        {triggerLabel}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mensagem padrão de cobrança"
        subtitle={
          canSaveToServer
            ? 'Salva para toda a equipe · use variáveis preenchidas automaticamente'
            : 'Salva neste navegador · use variáveis preenchidas automaticamente'
        }
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-olive">
              Dados bancários / PIX
            </label>
            <textarea
              value={bankDraft}
              onChange={(e) => setBankDraft(e.target.value)}
              rows={4}
              placeholder={'Ex.:\nPIX: 00.000.000/0001-00\nBanco X · Ag. 1234 · C/C 56789-0\nTitular: Ariane Andrade Assessoria'}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
            <p className="mt-1 text-[11px] text-brand-olive">
              Aparece na mensagem via {'{dados_bancarios_linha}'} (enquanto o boleto não estiver ativo).
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-olive">
              Modelo da mensagem
            </label>
            <textarea
              value={templateDraft}
              onChange={(e) => setTemplateDraft(e.target.value)}
              rows={10}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>

          <div className="rounded-xl border border-brand-beige bg-brand-off-white/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-olive">
              Variáveis disponíveis
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {RECEIVABLES_WHATSAPP_PLACEHOLDERS.map((p) => (
                <li key={p.key} className="text-xs text-brand-brown">
                  <code className="rounded bg-white px-1 py-0.5 text-[11px]">{p.key}</code>{' '}
                  <span className="text-brand-olive">— {p.hint}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <AppButton
              variant="secondary"
              onClick={() => {
                setTemplateDraft(DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE);
                setBankDraft(DEFAULT_COLLECTION_BANK_DETAILS);
              }}
            >
              Restaurar padrão
            </AppButton>
            <div className="flex gap-2">
              <AppButton variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </AppButton>
              <AppButton onClick={() => void handleSave()} loading={saving}>
                Salvar modelo
              </AppButton>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
