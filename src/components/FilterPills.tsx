export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
            value === opt.id
              ? 'border-brand-brown bg-brand-brown text-white shadow-sm'
              : 'border-brand-beige bg-white text-brand-brown hover:border-brand-olive/40 hover:bg-brand-off-white'
          }`}
        >
          {opt.label}
          {opt.count !== undefined && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                value === opt.id ? 'bg-white/20 text-white' : 'bg-brand-off-white text-brand-olive'
              }`}
            >
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
