import type { Contract } from '../../services/apiService';
import { printContractPdf } from './printContractPdf';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const saleLabel: Record<string, string> = {
  inteiro: 'Animal inteiro',
  fracao: 'Fração',
  condominio: 'Condomínio',
};

interface ContractDocumentProps {
  contract: Contract;
  showActions?: boolean;
  onClose?: () => void;
}

export default function ContractDocument({
  contract,
  showActions = false,
  onClose,
}: ContractDocumentProps) {
  const handlePrint = () => {
    try {
      printContractPdf(contract);
    } catch (e: any) {
      alert(e.message || 'Não foi possível abrir a impressão');
    }
  };

  return (
    <div className="bg-white text-brand-dark-brown">
      {showActions && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive"
          >
            Imprimir / Salvar PDF
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-brand-beige px-4 py-2 text-sm hover:bg-brand-off-white"
            >
              Fechar
            </button>
          )}
        </div>
      )}

      <header className="border-b border-brand-beige pb-5">
        <div className="mb-4 flex justify-center sm:justify-start">
          <img
            src="/logo-ariane-wide-transparente.png"
            alt="Ariane Andrade Assessoria"
            className="h-14 w-auto object-contain sm:h-16"
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {contract.template_title || 'Nota de Leilão e Contrato'}
        </h1>
        <p className="mt-1 text-sm text-brand-olive">
          Nº {contract.contract_number || contract.id}
          {contract.lot_label ? ` · Lote ${contract.lot_label}` : ''} ·{' '}
          {new Date(contract.created_at || Date.now()).toLocaleDateString('pt-BR')}
          {contract.template_name ? ` · Modelo: ${contract.template_name}` : ''}
        </p>
      </header>

      <section className="mt-6 space-y-4 text-sm leading-relaxed">
        <p>
          Pelo presente instrumento, as partes abaixo identificadas celebram contrato de compra e venda
          do animal <strong>{contract.animal_name}</strong>, na modalidade{' '}
          <strong>{saleLabel[contract.sale_type] || contract.sale_type}</strong>
          {contract.share_pct != null && contract.sale_type !== 'inteiro'
            ? ` correspondente a ${contract.share_pct}%`
            : ''}
          , pelo valor total de <strong>{money(contract.total_amount)}</strong>, a ser pago via{' '}
          <strong>{contract.payment_method.toUpperCase()}</strong> em{' '}
          <strong>{contract.installments}</strong> parcela(s), com primeiro vencimento em{' '}
          <strong>{contract.first_due_date}</strong>.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-beige p-4">
            <p className="text-xs uppercase tracking-wide text-brand-olive">Vendedor</p>
            <p className="font-semibold">{contract.seller_name}</p>
          </div>
          <div className="rounded-xl border border-brand-beige p-4">
            <p className="text-xs uppercase tracking-wide text-brand-olive">Comprador</p>
            <p className="font-semibold">{contract.buyer_name}</p>
          </div>
          {contract.assessor_name && (
            <div className="rounded-xl border border-brand-beige p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-brand-olive">Assessor</p>
              <p className="font-semibold">{contract.assessor_name}</p>
            </div>
          )}
        </div>

        {contract.charges && contract.charges.length > 0 && (
          <div>
            <h2 className="mb-2 font-semibold">Plano de cobranças</h2>
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-brand-beige">
                  <th className="py-2">Parcela</th>
                  <th className="py-2">Vencimento</th>
                  <th className="py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {contract.charges.map((ch) => (
                  <tr key={ch.id} className="border-b border-brand-beige/50">
                    <td className="py-2">{ch.installment_no}</td>
                    <td className="py-2">{ch.due_date}</td>
                    <td className="py-2">{money(ch.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {contract.notes && (
          <div>
            <h2 className="mb-1 font-semibold">Observações</h2>
            <p className="whitespace-pre-wrap text-brand-olive">{contract.notes}</p>
          </div>
        )}

        <div>
          <h2 className="mb-2 font-semibold">Aceites digitais</h2>
          {(contract.signatures || []).length === 0 ? (
            <p className="text-brand-olive">Nenhuma assinatura registrada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {contract.signatures!.map((s) => (
                <li key={s.id} className="rounded-lg border border-brand-beige p-3">
                  <p className="font-medium">{s.signer_name}</p>
                  <p className="text-xs text-brand-olive">
                    Papel: {s.party_role} · {new Date(s.signed_at).toLocaleString('pt-BR')}
                    {s.ip ? ` · IP ${s.ip}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="pt-6 text-xs text-brand-olive">
          Este documento constitui aceite eletrônico registrado no Sistema Ariane. A impressão em PDF
          pelo navegador serve como comprovante das condições negociadas.
        </p>
      </section>
    </div>
  );
}
