import type { Contract } from '../../services/apiService';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const saleLabel: Record<string, string> = {
  inteiro: 'Animal inteiro',
  fracao: 'Fração',
  condominio: 'Condomínio',
};

function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Gera impressão/PDF do contrato sem abrir pop-up (iframe oculto). */
export function printContractPdf(contract: Contract) {
  const logoUrl = `${window.location.origin}/logo-ariane-wide-transparente.png`;
  const date = new Date(contract.created_at || Date.now()).toLocaleDateString('pt-BR');
  const share =
    contract.share_pct != null && contract.sale_type !== 'inteiro'
      ? ` correspondente a ${contract.share_pct}%`
      : '';

  const chargesRows =
    contract.charges && contract.charges.length > 0
      ? contract.charges
          .map(
            (ch) => `
        <tr>
          <td>${esc(String(ch.installment_no))}</td>
          <td>${esc(ch.due_date)}</td>
          <td>${esc(money(ch.amount))}</td>
        </tr>`
          )
          .join('')
      : '';

  const chargesBlock =
    chargesRows
      ? `
    <h2>Plano de cobranças</h2>
    <table>
      <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
      <tbody>${chargesRows}</tbody>
    </table>`
      : '';

  const notesBlock = contract.notes
    ? `<h2>Observações</h2><p class="muted" style="white-space:pre-wrap">${esc(contract.notes)}</p>`
    : '';

  const signatures =
    contract.signatures && contract.signatures.length > 0
      ? contract.signatures
          .map(
            (s) => `
        <div class="box">
          <strong>${esc(s.signer_name)}</strong><br/>
          <span class="muted">Papel: ${esc(s.party_role)} · ${esc(
              new Date(s.signed_at).toLocaleString('pt-BR')
            )}${s.ip ? ` · IP ${esc(s.ip)}` : ''}</span>
        </div>`
          )
          .join('')
      : '<p class="muted">Nenhuma assinatura registrada ainda.</p>';

  const assessorBlock = contract.assessor_name
    ? `<div class="box full"><div class="label">Assessor</div><div class="val">${esc(
        contract.assessor_name
      )}</div></div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Contrato Nº ${esc(contract.id)} — Ariane Andrade Assessoria</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: #3d2f26;
      background: #fff;
      font-size: 12.5pt;
      line-height: 1.55;
    }
    .logo-wrap {
      display: block;
      margin-bottom: 18px;
    }
    .logo-wrap img {
      display: block;
      height: 64px;
      width: auto;
    }
    h1 {
      font-size: 20pt;
      margin: 0 0 4px;
      font-weight: 700;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .meta {
      color: #6b5c4c;
      font-size: 10.5pt;
      margin-bottom: 18px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    hr {
      border: none;
      border-top: 1px solid #d4c4a8;
      margin: 0 0 20px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 18px 0;
    }
    .box {
      border: 1px solid #d4c4a8;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 8px;
    }
    .box.full { grid-column: 1 / -1; }
    .label {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b5c4c;
      font-family: system-ui, -apple-system, sans-serif;
      margin-bottom: 4px;
    }
    .val { font-weight: 700; }
    h2 {
      font-size: 12pt;
      margin: 22px 0 8px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11pt;
      font-family: system-ui, -apple-system, sans-serif;
    }
    th, td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid #e8dcc8;
    }
    th { color: #6b5c4c; font-weight: 600; }
    .muted { color: #6b5c4c; font-size: 10.5pt; }
    .footer {
      margin-top: 28px;
      font-size: 9.5pt;
      color: #6b5c4c;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img src="${logoUrl}" alt="Ariane Andrade Assessoria" />
  </div>
  <h1>Contrato de Compra e Venda</h1>
  <p class="meta">Nº ${esc(contract.id)} · ${esc(date)}</p>
  <hr />
  <p>
    Pelo presente instrumento, as partes abaixo identificadas celebram contrato de compra e venda
    do animal <strong>${esc(contract.animal_name)}</strong>, na modalidade
    <strong>${esc(saleLabel[contract.sale_type] || contract.sale_type)}</strong>${esc(share)},
    pelo valor total de <strong>${esc(money(contract.total_amount))}</strong>, a ser pago via
    <strong>${esc(contract.payment_method.toUpperCase())}</strong> em
    <strong>${esc(String(contract.installments))}</strong> parcela(s), com primeiro vencimento em
    <strong>${esc(contract.first_due_date)}</strong>.
  </p>
  <div class="grid">
    <div class="box">
      <div class="label">Vendedor</div>
      <div class="val">${esc(contract.seller_name)}</div>
    </div>
    <div class="box">
      <div class="label">Comprador</div>
      <div class="val">${esc(contract.buyer_name)}</div>
    </div>
    ${assessorBlock}
  </div>
  ${chargesBlock}
  ${notesBlock}
  <h2>Aceites digitais</h2>
  ${signatures}
  <p class="footer">
    Este documento constitui aceite eletrônico registrado no Sistema Ariane.
    A impressão em PDF pelo navegador serve como comprovante das condições negociadas.
  </p>
</body>
</html>`;

  // iframe oculto — não precisa de pop-up
  const existing = document.getElementById('contract-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'contract-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error('Não foi possível preparar a impressão');
  }

  doc.open();
  doc.write(html);
  doc.close();

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // remove após a caixa de impressão (não bloqueia o diálogo)
      setTimeout(() => iframe.remove(), 1000);
    }
  };

  const img = doc.querySelector('img');
  if (img && !(img as HTMLImageElement).complete) {
    img.addEventListener('load', () => setTimeout(runPrint, 150), { once: true });
    img.addEventListener('error', () => setTimeout(runPrint, 150), { once: true });
  } else {
    setTimeout(runPrint, 150);
  }
}
