import { useCallback, useEffect, useState } from 'react';
import {
  getCollectionWhatsappSettings,
  saveCollectionWhatsappSettings,
  type CollectionWhatsappSettings,
} from '../services/apiService';
import {
  DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
  DEFAULT_COLLECTION_BANK_DETAILS,
  loadReceivablesWhatsappTemplate,
  saveReceivablesWhatsappTemplate,
} from '../utils/receivablesWhatsapp';

export function useReceivablesWhatsappTemplate(canSaveToServer: boolean) {
  const [settings, setSettings] = useState<CollectionWhatsappSettings>({
    template: DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
    bankDetails: DEFAULT_COLLECTION_BANK_DETAILS,
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await getCollectionWhatsappSettings();
        if (cancelled) return;
        setSettings({
          template: remote.template?.trim() || DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
          bankDetails: remote.bankDetails?.trim() ?? DEFAULT_COLLECTION_BANK_DETAILS,
        });
        saveReceivablesWhatsappTemplate(remote.template || DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE);
      } catch {
        if (!cancelled) {
          setSettings({
            template: loadReceivablesWhatsappTemplate(),
            bankDetails: DEFAULT_COLLECTION_BANK_DETAILS,
          });
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveTemplate = useCallback(() => settings.template || loadReceivablesWhatsappTemplate(), [settings.template]);

  const saveSettings = useCallback(
    async (next: CollectionWhatsappSettings) => {
      const template = next.template.trim() || DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE;
      const bankDetails = next.bankDetails.trim();
      saveReceivablesWhatsappTemplate(template);
      setSettings({ template, bankDetails });
      if (canSaveToServer) {
        await saveCollectionWhatsappSettings({ template, bankDetails });
      }
    },
    [canSaveToServer]
  );

  return { settings, loaded, resolveTemplate, saveSettings };
}
