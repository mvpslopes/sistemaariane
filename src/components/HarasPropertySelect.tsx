import { useCallback, useEffect, useState } from 'react';
import { getHarasProperties, type HarasPropertyOption } from '../services/apiService';

export function harasPropertyLabel(p: HarasPropertyOption) {
  return p.ownerName ? `${p.name} · ${p.ownerName}` : p.name;
}

export function useHarasProperties() {
  const [properties, setProperties] = useState<HarasPropertyOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProperties(await getHarasProperties());
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { properties, loading, reload: load };
}

export function HarasPropertyFilter({
  value,
  onChange,
  properties,
}: {
  value: string;
  onChange: (v: string) => void;
  properties: HarasPropertyOption[];
}) {
  if (properties.length <= 1) return null;
  return (
    <select
      className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todos os haras</option>
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {harasPropertyLabel(p)}
        </option>
      ))}
    </select>
  );
}

export function HarasPropertySelect({
  value,
  onChange,
  properties,
}: {
  value: string;
  onChange: (v: string) => void;
  properties: HarasPropertyOption[];
}) {
  return (
    <label className="block space-y-1 text-sm sm:col-span-2">
      <span className="text-xs font-medium uppercase text-brand-olive">Haras *</span>
      <select
        className="w-full rounded-xl border border-brand-beige px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione o haras...</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {harasPropertyLabel(p)}
          </option>
        ))}
      </select>
    </label>
  );
}
