import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, HelpCircle, Search, X } from 'lucide-react';
import {
  HELP_ARTICLES,
  HELP_CATEGORY_LABELS,
  filterHelpArticles,
  groupHelpByCategory,
  type HelpViewerContext,
} from '../constants/helpArticles';
import { HelpArticleBody, HelpArticleListItem } from './HelpArticleContent';

interface HelpMenuProps extends HelpViewerContext {
  compact?: boolean;
}

export default function HelpMenu({ isCliente, isAssessor, compact = false }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const ctx = { isCliente, isAssessor };
  const articles = useMemo(() => filterHelpArticles(HELP_ARTICLES, ctx), [isCliente, isAssessor]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.steps.some((s) => s.toLowerCase().includes(q))
    );
  }, [articles, query]);

  const grouped = useMemo(() => groupHelpByCategory(filtered), [filtered]);
  const effectiveId = selectedId ?? filtered[0]?.id ?? null;
  const selected = articles.find((a) => a.id === effectiveId) ?? null;

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const openFullGuide = (articleId?: string) => {
    close();
    navigate(articleId ? `/app/ajuda?artigo=${articleId}` : '/app/ajuda');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown transition hover:bg-brand-off-white ${
          compact ? 'h-10 w-10' : 'gap-1.5 px-2.5 py-2 sm:px-3'
        }`}
        title="Ajuda"
        aria-label="Ajuda e guias de uso"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <HelpCircle className="h-4 w-4" />
        {!compact && <span className="hidden text-xs font-medium lg:inline">Ajuda</span>}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-[1px]"
            onClick={close}
            aria-hidden
          />
          <div
            className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[61] mx-auto flex max-h-[min(36rem,calc(100dvh-1.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-2xl sm:inset-x-4 md:top-[max(5rem,env(safe-area-inset-top))]"
            role="dialog"
            aria-label="Central de ajuda"
          >
            <div className="border-b border-brand-beige px-4 py-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">Central de ajuda</p>
                  <p className="text-xs text-neutral-600">Cadastros, consultas e fluxos do sistema</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-brand-off-white hover:text-neutral-800"
                  aria-label="Fechar ajuda"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar no guia…"
                  className="w-full rounded-xl border border-brand-beige bg-brand-off-white/50 py-2 pl-9 pr-3 text-sm text-neutral-900 outline-none focus:border-brand-olive/40"
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
              <div className="max-h-[11rem] shrink-0 overflow-y-auto border-b border-brand-beige p-2 md:max-h-none md:w-[40%] md:border-b-0 md:border-r lg:w-[38%]">
                {filtered.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-neutral-600">Nenhum artigo encontrado.</p>
                ) : (
                  <div className="space-y-3">
                    {grouped.cadastro.length > 0 && (
                      <HelpSection
                        label={HELP_CATEGORY_LABELS.cadastro}
                        items={grouped.cadastro}
                        selectedId={effectiveId}
                        onSelect={setSelectedId}
                      />
                    )}
                    {grouped.visualizacao.length > 0 && (
                      <HelpSection
                        label={HELP_CATEGORY_LABELS.visualizacao}
                        items={grouped.visualizacao}
                        selectedId={effectiveId}
                        onSelect={setSelectedId}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {selected ? (
                  <>
                    <h3 className="text-sm font-semibold text-neutral-950">{selected.title}</h3>
                    <p className="mt-0.5 mb-3 text-xs text-neutral-600">{selected.summary}</p>
                    <HelpArticleBody article={selected} onNavigate={close} compact />
                  </>
                ) : (
                  <p className="py-6 text-center text-sm text-neutral-600">Selecione um tópico na lista.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-brand-beige px-4 py-2.5">
              <button
                type="button"
                onClick={() => openFullGuide(selected?.id ?? effectiveId ?? undefined)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-brown hover:underline"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Guia completo
              </button>
              <Link
                to="/app/ajuda"
                onClick={close}
                className="text-xs text-neutral-500 hover:text-brand-brown"
              >
                Abrir página →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HelpSection({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  items: import('../constants/helpArticles').HelpArticle[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id}>
            <HelpArticleListItem
              article={a}
              active={selectedId === a.id}
              onSelect={() => onSelect(a.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
