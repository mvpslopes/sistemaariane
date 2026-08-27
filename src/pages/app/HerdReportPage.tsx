import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Printer, Search } from 'lucide-react';
import { getAnimals, type Animal } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import AppButton from '../../components/AppButton';
import { FilterPills } from '../../components/FilterPills';
import { formatAgeBR, formatDateBR } from '../../utils/dateTime';
import {
  animalSexLabel,
  animalStatusLabel,
  downloadHerdReportExcel,
  downloadHerdReportPdf,
} from './herdReportExport';

type StatusFilter = 'all' | Animal['status'];
type SexFilter = 'all' | 'M' | 'F' | 'C';
type SortKey = 'name' | 'birth' | 'registration' | 'owner';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ativo', label: 'Plantel ativo' },
  { id: 'all', label: 'Todos' },
  { id: 'vendido', label: 'Vendidos' },
  { id: 'falecido', label: 'Falecidos' },
  { id: 'transferido', label: 'Transferidos' },
];

const statusTone: Record<Animal['status'], string> = {
  ativo: 'bg-emerald-50 text-emerald-700',
  vendido: 'bg-brand-gold/15 text-brand-gold',
  falecido: 'bg-brand-beige/60 text-brand-olive',
  transferido: 'bg-brand-beige/60 text-brand-olive',
};

function dateKey(v: string | null | undefined) {
  return v ? String(v).slice(0, 10) : '';
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';

export default function HerdReportPage() {
  const { hasRole } = useAuth();
  const isCliente = hasRole('cliente');
  const { error: toastError, success } = useToast();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ativo');
  const [sexFilter, setSexFilter] = useState<SexFilter>('all');
  const [breed, setBreed] = useState('');
  const [owner, setOwner] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [birthFrom, setBirthFrom] = useState('');
  const [birthTo, setBirthTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await getAnimals();
        if (!cancelled) setAnimals(list);
      } catch (e: unknown) {
        toastError(e instanceof Error ? e.message : 'Erro ao carregar o plantel');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toastError]);

  const breeds = useMemo(() => {
    const set = new Set<string>();
    animals.forEach((a) => {
      if (a.breed?.trim()) set.add(a.breed.trim());
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [animals]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    animals.forEach((a) => {
      String(a.owners || '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .forEach((n) => set.add(n));
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [animals]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    const list = animals.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (sexFilter !== 'all' && a.sex !== sexFilter) return false;
      if (breed && (a.breed || '') !== breed) return false;
      if (owner && !String(a.owners || '').toLowerCase().includes(owner.toLowerCase())) return false;
      if (sire.trim() && !(a.sire_name || '').toLowerCase().includes(sire.trim().toLowerCase())) return false;
      if (dam.trim() && !(a.dam_name || '').toLowerCase().includes(dam.trim().toLowerCase())) return false;
      const born = dateKey(a.birth_date);
      if (birthFrom && (!born || born < birthFrom)) return false;
      if (birthTo && (!born || born > birthTo)) return false;
      if (!search) return true;
      return (
        a.name.toLowerCase().includes(search) ||
        (a.registration_no || '').toLowerCase().includes(search) ||
        (a.chip_no || '').toLowerCase().includes(search) ||
        (a.breed || '').toLowerCase().includes(search) ||
        String(a.owners || '').toLowerCase().includes(search) ||
        (a.sire_name || '').toLowerCase().includes(search) ||
        (a.dam_name || '').toLowerCase().includes(search)
      );
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortKey === 'birth') return dateKey(a.birth_date).localeCompare(dateKey(b.birth_date));
      if (sortKey === 'registration') return (a.registration_no || '').localeCompare(b.registration_no || '', 'pt-BR');
      if (sortKey === 'owner') return String(a.owners || '').localeCompare(String(b.owners || ''), 'pt-BR');
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return sorted;
  }, [animals, q, statusFilter, sexFilter, breed, owner, sire, dam, birthFrom, birthTo, sortKey]);

  const kpis = useMemo(() => {
    const ativos = filtered.filter((a) => a.status === 'ativo').length;
    return {
      total: filtered.length,
      ativos,
      femeas: filtered.filter((a) => a.sex === 'F').length,
      machos: filtered.filter((a) => a.sex === 'M').length,
      comRegistro: filtered.filter((a) => !!a.registration_no).length,
    };
  }, [filtered]);

  const filterSummary = useMemo(() => {
    const parts = [STATUS_FILTERS.find((s) => s.id === statusFilter)?.label];
    if (sexFilter !== 'all') parts.push(animalSexLabel(sexFilter));
    if (breed) parts.push(breed);
    if (owner) parts.push(owner);
    if (birthFrom || birthTo) parts.push(`nasc. ${formatDateBR(birthFrom || null, '…')} a ${formatDateBR(birthTo || null, '…')}`);
    return parts.filter(Boolean).join(' · ');
  }, [statusFilter, sexFilter, breed, owner, birthFrom, birthTo]);

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      await downloadHerdReportPdf(filtered, filterSummary);
      success('PDF gerado');
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao gerar PDF');
    } finally {
      setExporting(null);
    }
  };

  const exportXlsx = () => {
    setExporting('xlsx');
    try {
      downloadHerdReportExcel(filtered);
      success('Excel gerado');
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao gerar Excel');
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-brand-olive">
          Visão do plantel com nascimento, idade, pelagem, genealogia e proprietário. Exporte PDF ou Excel com o
          filtro atual.
        </p>
        <div className="flex flex-wrap gap-2">
          <AppButton variant="secondary" onClick={exportXlsx} loading={exporting === 'xlsx'} disabled={!filtered.length}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </AppButton>
          <AppButton onClick={exportPdf} loading={exporting === 'pdf'} disabled={!filtered.length}>
            <Printer className="h-4 w-4" /> PDF
          </AppButton>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-brand-beige bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 text-sm sm:col-span-2">
          <span className="text-xs font-medium uppercase text-brand-olive">Busca</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Nome, registro, chip, pai ou mãe..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </span>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Sexo</span>
          <select className={inputClass} value={sexFilter} onChange={(e) => setSexFilter(e.target.value as SexFilter)}>
            <option value="all">Todos</option>
            <option value="F">Fêmea</option>
            <option value="M">Macho</option>
            <option value="C">Castrado</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Ordenar por</span>
          <select className={inputClass} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
            <option value="name">Nome</option>
            <option value="birth">Nascimento</option>
            <option value="registration">Registro</option>
            <option value="owner">Proprietário</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Raça</span>
          <select className={inputClass} value={breed} onChange={(e) => setBreed(e.target.value)}>
            <option value="">Todas</option>
            {breeds.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Proprietário</span>
          <select className={inputClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Todos</option>
            {owners.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Nascidos de</span>
          <input type="date" className={inputClass} value={birthFrom} onChange={(e) => setBirthFrom(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Nascidos até</span>
          <input type="date" className={inputClass} value={birthTo} onChange={(e) => setBirthTo(e.target.value)} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Pai</span>
          <input className={inputClass} value={sire} onChange={(e) => setSire(e.target.value)} placeholder="Nome do pai" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium uppercase text-brand-olive">Mãe</span>
          <input className={inputClass} value={dam} onChange={(e) => setDam(e.target.value)} placeholder="Nome da mãe" />
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'No filtro', value: kpis.total },
          { label: 'Ativos', value: kpis.ativos },
          { label: 'Fêmeas', value: kpis.femeas },
          { label: 'Machos', value: kpis.machos },
          { label: 'Com registro', value: kpis.comRegistro },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-brand-beige bg-white px-3 py-3 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-olive">{kpi.label}</p>
            <p className="mt-1 text-xl font-semibold text-brand-dark-brown">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-3 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Nome</th>
                <th className="px-3 py-3 font-medium">Registro / chip</th>
                <th className="hidden px-3 py-3 font-medium md:table-cell">Proprietário</th>
                <th className="px-3 py-3 font-medium">Nascimento</th>
                <th className="hidden px-3 py-3 font-medium sm:table-cell">Pelagem</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Pai</th>
                <th className="hidden px-3 py-3 font-medium lg:table-cell">Mãe</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum animal neste filtro
                  </td>
                </tr>
              )}
              {filtered.map((a, i) => (
                <tr key={a.id} className="border-t border-brand-beige/70">
                  <td className="px-3 py-2.5 text-brand-olive">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/app/animais/${a.id}`} className="font-medium text-brand-dark-brown hover:underline">
                      {a.name}
                    </Link>
                    <span className="mt-0.5 block text-xs text-brand-olive">
                      {animalSexLabel(a.sex)}
                      {a.breed ? ` · ${a.breed}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div>{a.registration_no || '—'}</div>
                    <div className="text-brand-olive">{a.chip_no || 'sem chip'}</div>
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-3 py-2.5 md:table-cell">{a.owners || '—'}</td>
                  <td className="px-3 py-2.5">
                    <div>{formatDateBR(a.birth_date)}</div>
                    <div className="text-xs text-brand-olive">{formatAgeBR(a.birth_date)}</div>
                  </td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">{a.color || '—'}</td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">{a.sire_name || '—'}</td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">{a.dam_name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone[a.status]}`}>
                      {animalStatusLabel(a.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!isCliente && (
        <p className="text-xs text-brand-olive">
          Cadastro do plantel em{' '}
          <Link to="/app/animais" className="font-medium text-brand-brown hover:underline">
            Animais
          </Link>
          .
        </p>
      )}
    </div>
  );
}
