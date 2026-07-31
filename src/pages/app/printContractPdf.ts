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

function moneyInWords(value: number): string {
  const unidades = [
    '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
  ];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  const underThousand = (n: number): string => {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return dezenas[d] + (u ? ` e ${unidades[u]}` : '');
    }
    const c = Math.floor(n / 100);
    const r = n % 100;
    return centenas[c] + (r ? ` e ${underThousand(r)}` : '');
  };

  const int = Math.floor(Math.abs(value));
  const cents = Math.round((Math.abs(value) - int) * 100);
  if (int === 0 && cents === 0) return 'zero reais';

  let reais = '';
  if (int > 0) {
    const milhoes = Math.floor(int / 1_000_000);
    const milhares = Math.floor((int % 1_000_000) / 1000);
    const resto = int % 1000;
    const parts: string[] = [];
    if (milhoes) parts.push(`${underThousand(milhoes)} milh${milhoes === 1 ? 'ão' : 'ões'}`);
    if (milhares) parts.push(milhares === 1 ? 'mil' : `${underThousand(milhares)} mil`);
    if (resto) parts.push(underThousand(resto));
    reais = parts.join(' e ') + (int === 1 ? ' real' : ' reais');
  }

  const centavos =
    cents > 0 ? underThousand(cents) + (cents === 1 ? ' centavo' : ' centavos') : '';

  if (reais && centavos) return `${reais} e ${centavos}`;
  return reais || centavos;
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
      ? (() => {
          const parts: string[] = [`${contract.commission_total_pct}%`];
          if (contract.commission_buyer_pct != null || contract.commission_seller_pct != null) {
            const detail: string[] = [];
            if (contract.commission_buyer_pct != null) detail.push(`comprador ${contract.commission_buyer_pct}%`);
            if (contract.commission_seller_pct != null) detail.push(`vendedor ${contract.commission_seller_pct}%`);
            if (detail.length) parts.push(`(${detail.join(' · ')})`);
          }
          const amount = (Number(contract.total_amount) * Number(contract.commission_total_pct)) / 100;
          return `<div>Comissão: <strong>${esc(parts.join(' '))}</strong> · ${esc(money(amount))}</div>`;
        })()
      : '';

  const dueLast =
    contract.charges && contract.charges.length > 0
      ? contract.charges[contract.charges.length - 1].due_date
      : contract.first_due_date;
  const placeCity = [contract.seller_city, contract.seller_state].filter(Boolean).join(' / ') || 'Brasil';
  const promissory = `
  <div class="page np">
    <p class="np-title">NOTA PROMISSÓRIA</p>
    <p class="np-sub">Vinculada ao Contrato / Nota nº ${esc(String(number))} — Lote ${esc(lot)} — ${esc(contract.animal_name || '')}</p>
    <div class="np-box">
      <div class="np-row">
        <div><span class="k">Nº</span> <strong>${esc(String(number))}-NP</strong></div>
        <div><span class="k">Vencimento</span> <strong>${esc(fmtDate(dueLast))}</strong></div>
        <div><span class="k">Valor</span> <strong>${esc(money(contract.total_amount))}</strong></div>
      </div>
      <p class="np-text">
        No dia <strong>${esc(fmtDate(dueLast))}</strong>, pagarei(emos) por esta única via de
        <strong>NOTA PROMISSÓRIA</strong> a <strong>${esc(contract.seller_name || '________________')}</strong>,
        CPF/CNPJ <strong>${esc(contract.seller_document || '________________')}</strong>,
        ou à sua ordem, a quantia de
        <strong>${esc(money(contract.total_amount))}</strong>
        (<em>${esc(moneyInWords(Number(contract.total_amount)))}</em>),
        referente à compra do animal <strong>${esc(contract.animal_name || '')}</strong>
        ${contract.animal_category ? `(${esc(contract.animal_category)})` : ''}
        ${contract.share_pct != null ? `, cotas de ${esc(String(contract.share_pct))}%` : ''},
        conforme contrato nº <strong>${esc(String(number))}</strong>,
        em <strong>${esc(String(contract.installments))}</strong> parcela(s)
        (${esc(String(contract.payment_method).toUpperCase())}),
        primeira com vencimento em <strong>${esc(fmtDate(contract.first_due_date))}</strong>.
      </p>
      <p class="np-text">
        Pagável em ${esc(placeCity)}. Em caso de não pagamento no vencimento, o emitente fica sujeito aos encargos
        legais, correção e demais medidas cabíveis, sem prejuízo das cláusulas do contrato vinculado.
      </p>
      <table class="fields" style="margin-top:10px">
        <tr>
          <td class="k">Emitente (Comprador)</td>
          <td colspan="3"><strong>${esc(contract.buyer_name)}</strong></td>
        </tr>
        <tr>
          <td class="k">CPF/CNPJ</td>
          <td>${esc(contract.buyer_document || '—')}</td>
          <td class="k">Telefone</td>
          <td>${esc(contract.buyer_phone || contract.buyer_whatsapp || '—')}</td>
        </tr>
        <tr>
          <td class="k">Endereço</td>
          <td colspan="3">${esc(contract.buyer_address || '—')}</td>
        </tr>
        <tr>
          <td class="k">Cidade/UF</td>
          <td colspan="3">${esc([contract.buyer_city, contract.buyer_state].filter(Boolean).join(' / ') || '—')}</td>
        </tr>
        <tr>
          <td class="k">Beneficiário (Vendedor)</td>
          <td colspan="3"><strong>${esc(contract.seller_name)}</strong> — ${esc(contract.seller_document || '—')}</td>
        </tr>
      </table>
      <p class="np-place">${esc(placeCity)}, ${esc(fmtDate(contract.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)))}.</p>
      <div class="np-signs">
        <div class="sign"><div class="line"></div>EMITENTE / COMPRADOR<br/><strong>${esc(contract.buyer_name)}</strong></div>
        <div class="sign"><div class="line"></div>BENEFICIÁRIO / VENDEDOR<br/><strong>${esc(contract.seller_name)}</strong></div>
        <div class="sign"><div class="line"></div>TESTEMUNHA 1<br/><strong>${esc(contract.witness1_name || '________________')}</strong></div>
        <div class="sign"><div class="line"></div>TESTEMUNHA 2<br/><strong>${esc(contract.witness2_name || '________________')}</strong></div>
      </div>
    </div>
  </div>`;

  const signatureBlock = `
    <div class="signs">
      <div class="sign"><div class="line"></div>VENDEDOR<br/><strong>${esc(contract.seller_name)}</strong></div>
      <div class="sign"><div class="line"></div>COMPRADOR<br/><strong>${esc(contract.buyer_name)}</strong></div>
      <div class="sign"><div class="line"></div>TESTEMUNHA 1<br/><strong>${esc(contract.witness1_name || '________________')}</strong></div>
      <div class="sign"><div class="line"></div>TESTEMUNHA 2<br/><strong>${esc(contract.witness2_name || '________________')}</strong></div>
    </div>`;

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
    .fin { display: flex; flex-wrap: wrap; gap: 12px 20px; padding: 6px; font-size: 9pt; }
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
    .verso-body { margin-bottom: 8px; }
    .np-title { font-size: 14pt; font-weight: 800; text-align: center; margin: 8px 0 4px; letter-spacing: 0.04em; }
    .np-sub { text-align: center; font-size: 8.5pt; margin: 0 0 12px; color: #444; }
    .np-box { border: 1px solid #999; padding: 12px; }
    .np-row { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 10px; font-size: 9pt; }
    .np-row .k { color: #555; font-size: 8pt; display: block; }
    .np-text { font-size: 9pt; text-align: justify; margin: 0 0 8px; line-height: 1.45; }
    .np-place { margin: 16px 0 8px; font-size: 9pt; }
    .np-signs {
      display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; margin-top: 24px;
    }
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
        ${commission}
        <div>Valor Total do Contrato: <strong>${esc(money(contract.total_amount))}</strong></div>
      </div>
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
    <p class="legal" style="margin-top:16px">
      AS PARTES DECLARAM TER LIDO E ACEITO AS DISPOSIÇÕES GERAIS DESTE VERSO,
      QUE INTEGRAM O CONTRATO Nº ${esc(String(number))}.
    </p>
    ${signatureBlock}
  </div>

  ${promissory}
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
