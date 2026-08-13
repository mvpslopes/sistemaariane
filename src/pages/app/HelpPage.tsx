import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  HELP_ARTICLES,
  HELP_CATEGORY_LABELS,
  filterHelpArticles,
  groupHelpByCategory,
} from '../../constants/helpArticles';
import { HelpArticleBody, HelpArticleListItem } from '../../components/HelpArticleContent';

export default function HelpPage() {
  const { hasRole, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const isCliente = hasRole('cliente');
  const isAssessor = !!user?.isAssessor && isCliente;

  const articles = useMemo(
    () => filterHelpArticles(HELP_ARTICLES, { isCliente, isAssessor }),
    [isCliente, isAssessor]
  );

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

  const paramId = searchParams.get('artigo');
  const activeId = paramId && articles.some((a) => a.id === paramId)
    ? paramId
    : filtered[0]?.id ?? null;
  const active = articles.find((a) => a.id === activeId) ?? null;

  const selectArticle = (id: string) => {
    setSearchParams({ artigo: id }, { replace: true });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-neutral-950">
            <BookOpen className="h-6 w-6 text-brand-brown" />
            Central de ajuda
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Guias de cadastro, consulta e fluxos do sistema — conteúdo adaptado ao seu perfil de acesso.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar tópico…"
          className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-4 text-sm shadow-card outline-none focus:border-brand-olive/40"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr]">
        <nav className="space-y-4 rounded-2xl border border-brand-beige bg-white p-3 shadow-card lg:sticky lg:top-4 lg:self-start">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-neutral-600">Nenhum artigo encontrado.</p>
          ) : (
            <>
              {grouped.cadastro.length > 0 && (
                <HelpNavSection
                  label={HELP_CATEGORY_LABELS.cadastro}
                  items={grouped.cadastro}
                  activeId={activeId}
                  onSelect={selectArticle}
                />
              )}
              {grouped.visualizacao.length > 0 && (
                <HelpNavSection
                  label={HELP_CATEGORY_LABELS.visualizacao}
                  items={grouped.visualizacao}
                  activeId={activeId}
                  onSelect={selectArticle}
                />
              )}
            </>
          )}
        </nav>

        <div className="rounded-2xl border border-brand-beige bg-white p-6 shadow-card">
          {active ? (
            <HelpArticleBody article={active} />
          ) : (
            <p className="py-12 text-center text-sm text-neutral-600">
              Selecione um tópico na lista ao lado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function HelpNavSection({
  label,
  items,
  activeId,
  onSelect,
}: {
  label: string;
  items: import('../constants/helpArticles').HelpArticle[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id}>
            <HelpArticleListItem
              article={a}
              active={activeId === a.id}
              onSelect={() => onSelect(a.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
