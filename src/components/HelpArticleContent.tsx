import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import type { HelpArticle } from '../constants/helpArticles';

interface HelpArticleBodyProps {
  article: HelpArticle;
  onNavigate?: () => void;
  compact?: boolean;
}

export function HelpArticleBody({ article, onNavigate, compact = false }: HelpArticleBodyProps) {
  return (
    <article className={compact ? 'space-y-2' : 'space-y-4'}>
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">{article.title}</h2>
          <p className="mt-1 text-sm text-neutral-600">{article.summary}</p>
        </div>
      )}

      <ol className={`list-decimal space-y-1.5 pl-4 text-sm text-neutral-800 ${compact ? '' : 'leading-relaxed'}`}>
        {article.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      {article.tip && (
        <div className="flex gap-2 rounded-xl border border-brand-gold/25 bg-brand-gold/5 px-3 py-2.5 text-xs text-neutral-700">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-gold" />
          <span>{article.tip}</span>
        </div>
      )}

      {article.to && article.toLabel && (
        <Link
          to={article.to}
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-brown hover:underline"
        >
          {article.toLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </article>
  );
}

interface HelpArticleListItemProps {
  article: HelpArticle;
  active?: boolean;
  onSelect: () => void;
}

export function HelpArticleListItem({ article, active, onSelect }: HelpArticleListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? 'bg-brand-gold/10 text-neutral-950 ring-1 ring-brand-gold/30'
          : 'text-neutral-800 hover:bg-brand-off-white'
      }`}
    >
      <span className="block text-sm font-medium">{article.title}</span>
      <span className="mt-0.5 block line-clamp-2 text-xs text-neutral-600">{article.summary}</span>
    </button>
  );
}
