import { useEffect, useMemo, useState } from 'react';
import { Plus, FileStack, Search } from 'lucide-react';
import {
  createContractTemplate,
  getContractTemplates,
  updateContractTemplate,
  type ContractTemplate,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, sortRows } from '../../hooks/useSortableTable';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortKey = 'name' | 'code' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';

const emptyForm = {
  name: '',
  code: '',
  title: 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO',
  bodyText: '',
  isDefault: false,
  active: true,
  notes: '',
};

export default function ContractTemplatesPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getContractTemplates());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: ContractTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      code: t.code || '',
      title: t.title,
      bodyText: t.body_text,
      isDefault: t.is_default,
      active: t.active,
      notes: t.notes || '',
    });
    setOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        title: form.title,
        bodyText: form.bodyText,
        isDefault: form.isDefault,
        active: form.active,
        notes: form.notes || null,
      };
      if (editing) {
        await updateContractTemplate(editing.id, payload);
        success('Modelo atualizado');
      } else {
        await createContractTemplate(payload);
        success('Modelo cadastrado');
      }
      setOpen(false);
      await load();
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar modelo');
    } finally {
      setSaving(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: items.length, active: 0, inactive: 0 };
    items.forEach((t) => {
      if (t.active) counts.active += 1;
      else counts.inactive += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((t) => {
      if (statusFilter === 'active' && !t.active) return false;
      if (statusFilter === 'inactive' && t.active) return false;
      if (!search) return true;
      return (
        t.name.toLowerCase().includes(search) ||
        (t.code || '').toLowerCase().includes(search) ||
        t.title.toLowerCase().includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'name':
          return cmpStr(a.name, b.name);
        case 'code':
          return cmpStr(a.code, b.code);
        case 'status':
          return Number(b.active) - Number(a.active);
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          modelos · Cadastre os <strong>versos</strong> (cláusulas). Na venda você escolhe o modelo.
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Novo modelo
          </button>
        )}
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por nome, código ou título..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <FilterPills
            options={STATUS_FILTERS.map((opt) => ({ ...opt, count: statusCounts[opt.id] }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      {loading ? (
        <ListPageSkeleton variant="table" rows={4} columns={3} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh label="Modelo" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Código" column="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum modelo encontrado
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-brand-beige/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-brand-dark-brown">
                      <FileStack className="h-4 w-4 text-brand-olive" />
                      {t.name}
                      {t.is_default && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          Padrão
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-brand-olive">{t.title}</p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{t.code || '—'}</td>
                  <td className="px-4 py-3">{t.active ? 'Ativo' : 'Inativo'}</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="rounded-lg border border-brand-beige px-3 py-1.5 text-xs font-medium hover:bg-brand-off-white"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        title={editing ? 'Editar modelo' : 'Novo modelo de contrato'}
        subtitle="Texto do verso (cláusulas)"
        onClose={() => setOpen(false)}
        size="2xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Nome *</span>
            <input required className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Código</span>
              <input className={inputClass} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ANIMAL_100_COMISSOES" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Título na nota</span>
              <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Texto do verso *</span>
            <textarea
              required
              rows={16}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              value={form.bodyText}
              onChange={(e) => setForm((f) => ({ ...f, bodyText: e.target.value }))}
              placeholder="Cole aqui as cláusulas do verso..."
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Observações internas</span>
            <input className={inputClass} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
              Modelo padrão
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Ativo
            </label>
          </div>
          <div className="flex gap-2 border-t border-brand-beige pt-4">
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar modelo'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-brand-beige px-4 py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
