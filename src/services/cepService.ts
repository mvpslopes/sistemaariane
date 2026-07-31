/** Consulta ViaCEP (https://viacep.com.br) e retorna endereço normalizado. */
export async function lookupCep(rawCep: string): Promise<{
  zip_code: string;
  address: string;
  city: string;
  state: string;
  neighborhood?: string;
} | null> {
  const digits = String(rawCep || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) throw new Error('Falha ao consultar CEP');
  const data = await res.json();
  if (data?.erro) throw new Error('CEP não encontrado');

  const street = [data.logradouro, data.bairro].filter(Boolean).join(', ');
  const formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;

  return {
    zip_code: formatted,
    address: street || '',
    city: data.localidade || '',
    state: data.uf || '',
    neighborhood: data.bairro || undefined,
  };
}

export function formatCepInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}
