import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Home, Pencil, PawPrint, Stethoscope } from 'lucide-react';
import {
  getAnimal,
  getContracts,
  getHarasStays,
  getHarasVetRecords,
  mediaUrl,
  type AnimalDetail,
  type Contract,
  type HarasStay,
  type HarasVetRecord,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { formatDateBR } from '../../utils/dateTime';
import Modal from '../../components/Modal';
import AnimalForm from './AnimalForm';
import { moneyBRL, vetTypeLabel } from '../../constants/haras';

const SEX_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', C: 'Castrado' };
const STATUS_LABEL: Record<string, string> = {
  ativo: 'Ativo',
  vendido: 'Vendido',
  falecido: 'Falecido',
  transferido: 'Transferido',
};

export default function AnimalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canUpdate, hasRole } = useAuth();
  const isCliente = hasRole('cliente');
  const { error: toastError } = useToast();
  const [animal, setAnimal] = useState<AnimalDetail | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [vetRecords, setVetRecords] = useState<HarasVetRecord[]>([]);
  const [stays, setStays] = useState<HarasStay[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [a, allContracts, vetList, stayList] = await Promise.all([
        getAnimal(id),
        getContracts(),
        getHarasVetRecords({ animalId: id }).catch(() => []),
        getHarasStays({ animalId: id }).catch(() => []),
      ]);
      setAnimal(a);
      setContracts(allContracts.filter((c) => c.animal_id === id));
      setVetRecords(vetList);
      setStays(stayList);
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar animal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const ownersLabel = useMemo(() => {
    if (!animal?.owners?.length) return '—';
    return animal.owners.map((o) => `${o.clientName}${o.sharePct ? ` (${o.sharePct}%)` : ''}`).join(' · ');
  }, [animal]);

  if (loading) return <ListPageSkeleton variant="cards" />;
  if (!animal) {
    return (
      <p className="py-10 text-center text-sm text-brand-olive">
        Animal não encontrado.{' '}
        <Link to="/app/animais" className="text-brand-brown hover:underline">
          Voltar
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-brand-olive hover:text-brand-brown"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {canUpdate && !isCliente && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm font-medium text-brand-dark-brown hover:bg-brand-off-white"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          {animal.photo_url ? (
            <img
              src={mediaUrl(animal.photo_url) || undefined}
              alt=""
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center bg-brand-off-white">
              <PawPrint className="h-16 w-16 text-brand-beige" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-brand-dark-brown">{animal.name}</h2>
            <p className="mt-1 text-sm text-brand-olive">
              {animal.breed || 'Raça não informada'} · {STATUS_LABEL[animal.status]}
            </p>
          </div>

          <dl className="grid gap-3 rounded-2xl border border-brand-beige bg-white p-4 shadow-card sm:grid-cols-2">
            <Field label="Registro" value={animal.registration_no} />
            <Field label="Chip" value={animal.chip_no} />
            <Field label="Sexo" value={animal.sex ? SEX_LABEL[animal.sex] : null} />
            <Field label="Associação" value={animal.association} />
            <Field label="Nascimento" value={animal.birth_date ? formatDateBR(animal.birth_date) : null} />
            <Field label="Pelagem" value={animal.color} />
            <Field label="Proprietários" value={ownersLabel} className="sm:col-span-2" />
            {animal.genealogy && (
              <>
                <Field label="Pai" value={animal.genealogy.sireName} />
                <Field label="Mãe" value={animal.genealogy.damName} />
              </>
            )}
            {animal.notes && <Field label="Observações" value={animal.notes} className="sm:col-span-2" />}
          </dl>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-brand-beige px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark-brown">
            <FileText className="h-4 w-4" /> Contratos vinculados
          </h3>
          <Link to="/app/contratos" className="text-xs font-medium text-brand-brown hover:underline">
            Ver todos
          </Link>
        </div>
        {contracts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-olive">Nenhum contrato para este animal.</p>
        ) : (
          <ul className="divide-y divide-brand-beige/70">
            {contracts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-brand-dark-brown">
                    {c.contract_number ? `#${c.contract_number}` : 'Contrato'} · {c.status}
                  </p>
                  <p className="text-xs text-brand-olive">
                    {c.seller_name} → {c.buyer_name}
                  </p>
                </div>
                <Link to="/app/contratos" className="text-xs font-medium text-brand-brown hover:underline">
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-beige px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark-brown">
              <Stethoscope className="h-4 w-4" /> Histórico veterinário
            </h3>
            <Link to="/app/haras/veterinario" className="text-xs font-medium text-brand-brown hover:underline">
              Ver módulo
            </Link>
          </div>
          {vetRecords.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-brand-olive">Nenhum registro veterinário para este animal.</p>
          ) : (
            <ul className="divide-y divide-brand-beige/70">
              {vetRecords.slice(0, 8).map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-dark-brown">
                      {vetTypeLabel(r.recordType)} · {r.title}
                    </p>
                    <p className="text-xs text-brand-olive">
                      {formatDateBR(r.recordDate)}
                      {r.product ? ` · ${r.product}` : ''}
                      {r.nextDueDate ? ` · próxima ${formatDateBR(r.nextDueDate)}` : ''}
                    </p>
                  </div>
                  {r.cost != null && <span className="text-xs text-brand-olive">{moneyBRL(r.cost)}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

      <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-beige px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark-brown">
              <Home className="h-4 w-4" /> Hospedagem
            </h3>
            <Link to="/app/haras/hospedagem" className="text-xs font-medium text-brand-brown hover:underline">
              Ver módulo
            </Link>
          </div>
          {stays.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-brand-olive">Nenhuma hospedagem registrada.</p>
          ) : (
            <ul className="divide-y divide-brand-beige/70">
              {stays.slice(0, 6).map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-dark-brown">
                      {s.status === 'hospedado' ? 'Hospedado' : 'Encerrado'}
                      {s.stall ? ` · baia ${s.stall}` : ''}
                    </p>
                    <p className="text-xs text-brand-olive">
                      {formatDateBR(s.checkIn)}
                      {s.checkOut ? ` → ${formatDateBR(s.checkOut)}` : ' · em aberto'}
                      {` · ${s.days} diária(s)`}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-brand-dark-brown">{moneyBRL(s.estimatedTotal)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

      <Modal open={editOpen} title="Editar animal" onClose={() => setEditOpen(false)} size="lg">
        <AnimalForm
          animalId={animal.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-brand-olive">{label}</dt>
      <dd className="mt-0.5 text-sm text-brand-dark-brown">{value || '—'}</dd>
    </div>
  );
}
