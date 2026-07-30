import type { Contract } from '../../services/apiService';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function esc(s: string | null | undefined) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try {
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function partyBlock(
  title: string,
  p: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    document?: string | null;
    document_type?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
  }
) {
  const cityUf = [p.city, p.state].filter(Boolean).join(' / ') || '—';
  const phones = [p.phone, p.whatsapp].filter(Boolean).join(' · ') || '—';
  return `
  <div class="section">
    <div class="section-h">${esc(title)}</div>
    <table class="fields">
      <tr><td class="k">Nome/Razão Social</td><td colspan="3">${esc(p.name)}</td></tr>
      <tr>
        <td class="k">Endereço</td><td colspan="3">${esc(p.address || '—')}</td>
      </tr>
      <tr>
        <td class="k">Cidade/UF</td><td>${esc(cityUf)}</td>
        <td class="k">${esc(p.document_type || 'CPF/CNPJ')}</td><td>${esc(p.document || '—')}</td>
      </tr>
      <tr>
        <td class="k">Telefone(s)</td><td>${esc(phones)}</td>
        <td class="k">E-mail</td><td>${esc(p.email || '—')}</td>
      </tr>
    </table>
  </div>`;
}

/** Gera impressão/PDF estilo Nota de Leilão (frente) + verso do modelo. */
export function printContractPdf(contract: Contract) {
  const logoUrl = `${window.location.origin}/logo-ariane-wide-transparente.png`;
  const emit = new Date(contract.created_at || Date.now()).toLocaleString('pt-BR');
  const number = contract.contract_number || contract.id;
  const title =
    contract.template_title || 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO';
  const lot = contract.lot_label || '—';
  const share = contract.share_pct != null ? Number(contract.share_pct).toFixed(2) : '100,00';
  const qty = contract.quantity != null ? Number(contract.quantity).toFixed(2) : '1,00';
  const unit = contract.total_amount / (Number(contract.quantity) || 1);

  const animalMeta = [
    contract.animal_birth_date ? `Nasc. ${fmtDate(contract.animal_birth_date)}` : null,
    contract.animal_chip ? `Chip ${contract.animal_chip}` : null,
    contract.animal_color ? `Pelagem ${contract.animal_color}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const auctionLine = contract.auction_name
    ? `${contract.auction_name}${contract.auction_date ? ` — ${fmtDate(contract.auction_date)}` : ''}`
    : 'Negociação / Assessoria';

  const installmentHint =
    contract.charges && contract.charges.length > 0
      ? `${money(contract.total_amount)} em ${contract.installments} parcela(s) de ${money(
          contract.charges[0].amount
        )}`
      : `${money(contract.total_amount)} em ${contract.installments} parcela(s)`;

  const schedule =
    contract.charges && contract.charges.length > 0
      ? `<div class="schedule">${contract.charges
          .map(
            (ch) =>
              `<div class="sch-item">${String(ch.installment_no).padStart(2, '0')}/${String(
                contract.installments
              ).padStart(2, '0')} – ${esc(money(ch.amount))} – ${esc(fmtDate(ch.due_date))}</div>`
          )
          .join('')}</div>`
      : '';

  const commission =
    contract.commission_total_pct != null
      ? `<p class="muted">Comissão leiloeira: ${contract.commission_total_pct}%` +
        (contract.commission_buyer_pct != null
          ? ` (comprador ${contract.commission_buyer_pct}%`
          : '') +
        (contract.commission_seller_pct != null
          ? ` · vendedor ${contract.commission_seller_pct}%)`
          : '') +
        `</p>`
      : '';

  const versoBody = (contract.template_body || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const versoHeader = `CONTRATO ${esc(number)} - LOTE ${esc(lot)} - ${esc(
    contract.animal_category || ''
  )} - ${esc(contract.animal_name || '')}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>CONTRATO ${esc(number)} - ${esc(lot)} - ${esc(contract.animal_name)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #222; font-size: 9.5pt; line-height: 1.35;
    }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
    .head-left { flex: 1; }
    .logo { height: 42px; width: auto; display: block; margin-bottom: 6px; }
    .doc-title { font-size: 12pt; font-weight: 800; letter-spacing: 0.02em; margin: 0 0 2px; text-transform: uppercase; }
    .auction { font-size: 10pt; font-weight: 700; margin: 0 0 4px; }
    .company { font-size: 7.5pt; color: #444; line-height: 1.3; }
    .idbox {
      width: 170px; border: 1px solid #999; background: #f0f0f0;
      padding: 8px; text-align: center; flex-shrink: 0;
    }
    .idbox .lote { font-size: 18pt; font-weight: 800; margin: 0; }
    .idbox .via { font-size: 7.5pt; margin: 4px 0; }
    .idbox .num { font-size: 9pt; font-weight: 700; }
    .idbox .emi { font-size: 7.5pt; color: #555; margin-top: 4px; }
    .section { border: 1px solid #bbb; margin-top: 8px; }
    .section-h {
      background: #d9d9d9; font-weight: 700; font-size: 8.5pt;
      padding: 4px 6px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    table.fields { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.fields td { border-top: 1px solid #ddd; padding: 3px 6px; vertical-align: top; }
    table.fields .k { width: 18%; font-weight: 700; color: #444; background: #fafafa; }
    table.data { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.data th, table.data td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    table.data th { background: #eee; font-size: 8pt; }
    .fin { display: flex; gap: 16px; padding: 6px; font-size: 9pt; }
    .fin strong { font-size: 10pt; }
    .pay-summary { padding: 6px; font-size: 8.5pt; border-top: 1px solid #ddd; }
    .schedule {
      display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 2px 8px; padding: 6px; font-size: 7.5pt;
    }
    .sch-item { white-space: nowrap; }
    .legal {
      margin-top: 10px; font-size: 8pt; font-weight: 700; text-align: center;
    }
    .signs {
      display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px;
      margin-top: 28px;
    }
    .sign { text-align: center; font-size: 8pt; }
    .sign .line { border-top: 1px dashed #333; margin: 28px 0 4px; }
    .muted { color: #555; font-size: 8pt; padding: 0 6px 6px; }
    .verso-title { font-size: 11pt; font-weight: 800; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
    .verso-meta { text-align: center; font-size: 8.5pt; font-weight: 700; margin-bottom: 12px; }
    .verso-body p { margin: 0 0 8px; text-align: justify; font-size: 8.5pt; line-height: 1.4; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="head-left">
        <img class="logo" src="${logoUrl}" alt="Ariane Andrade" />
        <p class="doc-title">${esc(title)}</p>
        <p class="auction">${esc(auctionLine)}</p>
        <div class="company">
          ARIANE ANDRADE INTELIGÊNCIA AGROPECUÁRIA LTDA<br/>
          CNPJ 43.507.435/0001-30 · Rio de Janeiro / RJ<br/>
          contato@arianeandradeassessoria.app.br
        </div>
      </div>
      <div class="idbox">
        <p class="lote">LOTE ${esc(lot)}</p>
        <p class="via">${esc(contract.via_label || 'VIA - VENDEDOR / CONTRATO')}</p>
        <p class="num">${esc(number)}</p>
        <p class="emi">Emissão: ${esc(emit)}</p>
      </div>
    </div>

    ${partyBlock('Dados do Vendedor', {
      name: contract.seller_name,
      address: contract.seller_address,
      city: contract.seller_city,
      state: contract.seller_state,
      document: contract.seller_document,
      document_type: contract.seller_document_type,
      phone: contract.seller_phone,
      whatsapp: contract.seller_whatsapp,
      email: contract.seller_email,
    })}

    ${partyBlock('Dados do Comprador', {
      name: contract.buyer_name,
      address: contract.buyer_address,
      city: contract.buyer_city,
      state: contract.buyer_state,
      document: contract.buyer_document,
      document_type: contract.buyer_document_type,
      phone: contract.buyer_phone,
      whatsapp: contract.buyer_whatsapp,
      email: contract.buyer_email,
    })}

    <div class="section">
      <div class="section-h">Especificações do(s) Lote(s)</div>
      <table class="data">
        <thead>
          <tr>
            <th>Lote</th>
            <th>Descrição / Produto</th>
            <th>Categoria</th>
            <th>Cotas %</th>
            <th>Qtd</th>
            <th>Vlr. Unitário</th>
            <th>Vlr. Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(lot)}</td>
            <td>
              <strong>${esc(contract.animal_name)}</strong><br/>
              <span class="muted">Nota ${esc(number)}${animalMeta ? ` · ${esc(animalMeta)}` : ''}</span>
            </td>
            <td>${esc(contract.animal_category || '—')}</td>
            <td>${esc(share)}%</td>
            <td>${esc(qty)}</td>
            <td>${esc(money(unit))}</td>
            <td>${esc(money(contract.total_amount))}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-h">Composição Financeira do(s) Contrato(s)</div>
      <div class="fin">
        <div>Parcelas: <strong>${esc(String(contract.installments))}</strong></div>
        <div>Valor Total do Contrato: <strong>${esc(money(contract.total_amount))}</strong></div>
      </div>
      ${commission}
    </div>

    <div class="section">
      <div class="section-h">Cronograma de Pagamento das Parcelas</div>
      <div class="pay-summary">Forma de Pagamento: ${esc(installmentHint)}</div>
      ${schedule}
    </div>

    <p class="legal">
      COM AS ASSINATURAS, AS PARTES FICAM DE ACORDO COM AS DISPOSIÇÕES GERAIS QUE SE ENCONTRAM NO VERSO,
      FAZENDO PARTE INTEGRAL DO PRESENTE INSTRUMENTO.
    </p>

    <div class="signs">
      <div class="sign"><div class="line"></div>VENDEDOR<br/><strong>${esc(contract.seller_name)}</strong></div>
      <div class="sign"><div class="line"></div>COMPRADOR<br/><strong>${esc(contract.buyer_name)}</strong></div>
      <div class="sign"><div class="line"></div>TESTEMUNHA 1<br/><strong>${esc(contract.witness1_name || '________________')}</strong></div>
      <div class="sign"><div class="line"></div>TESTEMUNHA 2<br/><strong>${esc(contract.witness2_name || '________________')}</strong></div>
    </div>
  </div>

  <div class="page">
    <p class="verso-title">${esc(title)}</p>
    <p class="verso-meta">${versoHeader}</p>
    <div class="verso-body">
      ${versoBody || '<p class="muted">Nenhum modelo de verso vinculado a este contrato.</p>'}
    </div>
  </div>
</body>
</html>`;

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
