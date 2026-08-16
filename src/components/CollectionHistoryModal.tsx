import { useEffect, useState } from 'react';
import {
  createChargeCollectionEvent,
  getChargeCollectionEvents,
  type ChargeCollectionEvent,
  type CollectionChannel,
  type CollectionOutcome,
  type ReceivablesAnalyticalItem,
} from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import Modal from './Modal';
import AppButton from './AppButton';
import { formatDateBR, formatDateTimeBR } from '../utils/dateTime';

export const COLLECTION_OUTCOME_LABELS: Record<CollectionOutcome, string> = {
  sent: 'Contato realizado',
  answered: 'Cliente respondeu',
  no_answer: 'Sem resposta',
  promised: 'Prometeu pagar',
  paid: 'Informou pagamento',
  other: 'Outro',
};

export const COLLECTION_CHANNEL_LABELS: Record<CollectionChannel, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Telefone',
  email: 'E-mail',
  other: 'Outro',
};

type Props = {
  open: boolean;
  onClose: () => void;
  charge: ReceivablesAnalyticalItem | null;
  clientName?: string;
  historyAvailable: boolean;
  onSaved?: () => void;
};

export default function CollectionHistoryModal({
  open,
  onClose,
  charge,
  clientName,
  historyAvailable,
  onSaved,
}: Props) {
  const { success, error: toastError } = useToast();
  const [events, setEvents] = useState<ChargeCollectionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<CollectionOutcome>('other');
  const [channel, setChannel] = useState<CollectionChannel>('whatsapp');
  const [promisedDate, setPromisedDate] = useState('');

  const load = async () => {
    if (!charge) return;
    setLoading(true);
    try {
      setEvents(await getChargeCollectionEvents(charge.id));
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && charge) {
      setNote('');
      setOutcome('other');
      setChannel('whatsapp');
      setPromisedDate('');
      void load();
    }
  }, [open, charge?.id]);

  const save = async () => {
    if (!charge || !note.trim()) {
      toastError('Digite a anotação da cobrança');
      return;
    }
    if (!historyAvailable) {
      toastError('Execute a migration charge_collection_events no banco para salvar histórico');
      return;
    }
    setSaving(true);
    try {
      await createChargeCollectionEvent(charge.id, {
        note: note.trim(),
        outcome,
        channel,
        promisedDate: outcome === 'promised' && promisedDate ? promisedDate : null,
      });
      success('Anotação registrada');
      setNote('');
      setOutcome('other');
      setPromisedDate('');
      await load();
      onSaved?.();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar anotação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Histórico de cobrança"
      subtitle={
        charge
          ? `${clientName || ''} · ${charge.description}`.replace(/^ · /, '')
          : undefined
      }
      size="lg"
    >
      {!historyAvailable && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Para salvar histórico, rode <code className="text-xs">migration-charge-collection-events.sql</code> no
          phpMyAdmin.
        </p>
      )}

      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-brand-dark-brown">Adicionar comentário / anotação</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Digite a mensagem ou observação da cobrança..."
            className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-brand-dark-brown">Retorno do cliente</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as CollectionOutcome)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
            >
              {Object.entries(COLLECTION_OUTCOME_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-brand-dark-brown">Canal</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CollectionChannel)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
            >
              {Object.entries(COLLECTION_CHANNEL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {outcome === 'promised' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-brand-dark-brown">Data prometida</span>
            <input
              type="date"
              value={promisedDate}
              onChange={(e) => setPromisedDate(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
            />
          </label>
        )}

        <AppButton onClick={() => void save()} loading={saving} disabled={!historyAvailable}>
          Salvar anotação
        </AppButton>

        <div className="overflow-hidden rounded-xl border border-brand-beige">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Colaborador</th>
                <th className="px-3 py-2 font-medium">Retorno</th>
                <th className="px-3 py-2 font-medium">Anotação</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-brand-olive">
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-brand-olive">
                    Nenhuma anotação para esta parcela
                  </td>
                </tr>
              )}
              {events.map((ev) => (
                <tr key={ev.id} className="border-t border-brand-beige/70 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-brand-brown">
                    {formatDateTimeBR(ev.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-brand-brown">{ev.userName || '—'}</td>
                  <td className="px-3 py-2 text-xs text-brand-olive">
                    {COLLECTION_OUTCOME_LABELS[ev.outcome]}
                    {ev.promisedDate ? ` · ${formatDateBR(ev.promisedDate)}` : ''}
                  </td>
                  <td className="px-3 py-2 text-brand-dark-brown">{ev.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <AppButton variant="secondary" onClick={onClose}>
            Fechar
          </AppButton>
        </div>
      </div>
    </Modal>
  );
}
