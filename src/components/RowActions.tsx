import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const baseClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.98]';

const variants = {
  default: 'text-brand-brown hover:bg-brand-beige/60',
  danger: 'text-red-600 hover:bg-red-50',
};

export function RowActionButton({
  variant = 'default',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button type="button" className={`${baseClass} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export default function RowActions({
  onEdit,
  onDelete,
  editLabel = 'Editar',
  deleteLabel = 'Excluir',
  children,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
  children?: ReactNode;
}) {
  if (!onEdit && !onDelete && !children) return null;
  return (
    <div className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
      {children}
      {onEdit && (
        <RowActionButton onClick={onEdit} title={editLabel} aria-label={editLabel}>
          <Pencil className="h-3.5 w-3.5" />
          {editLabel}
        </RowActionButton>
      )}
      {onDelete && (
        <RowActionButton variant="danger" onClick={onDelete} title={deleteLabel} aria-label={deleteLabel}>
          <Trash2 className="h-3.5 w-3.5" />
          {deleteLabel}
        </RowActionButton>
      )}
    </div>
  );
}
