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

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Ex.: 10 de novembro de 2026 */
function fmtDateLong(d: string | null | undefined) {
  if (!d) return '____ de ______________ de ______';
  try {
    const dt = new Date(d.includes('T') ? d : d + 'T12:00:00');
    return `${dt.getDate()} de ${MONTHS_PT[dt.getMonth()]} de ${dt.getFullYear()}`;
  } catch {
    return d;
  }
}

const ASSESSORIA = {
  name: 'ARIANE ANDRADE INTELIGÊNCIA AGROPECUÁRIA LTDA.',
  cnpj: '43.507.435/0001-30',
  cityUf: 'Belo Horizonte/MG',
};

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

/** HTML completo do contrato (frente + verso + assinaturas + promissórias). */
export function buildContractHtml(contract: Contract): string {
  const logoUrl = `${window.location.origin}/logo-ariane-wide-transparente.png`;
  const emit = new Date(contract.created_at || Date.now()).toLocaleString('pt-BR');
  const number = contract.contract_number || contract.id;
  const title =
    contract.template_title || 'NOTA DE LEILÃO E CONTRATO COM RESERVA DE DOMÍNIO';
  const lot = contract.lot_label || '—';
  const share = contract.share_pct != null ? Number(contract.share_pct).toFixed(2) : '100,00';
  const qtyNum = Number(contract.quantity ?? 1);
  const qty = Number.isInteger(qtyNum)
    ? String(qtyNum)
    : String(qtyNum).replace('.', ',');
  const unit = contract.total_amount / (Number(contract.quantity) || 1);

  const animalMeta = [
    contract.animal_birth_date ? `Nasc. ${fmtDate(contract.animal_birth_date)}` : null,
    contract.animal_chip ? `Chip ${contract.animal_chip}` : null,
    contract.animal_color ? `Pelagem ${contract.animal_color}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const observationsText = [contract.animal_notes, contract.notes]
    .map((t) => (t || '').trim())
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .join('\n\n');

  const observationsBlock = observationsText
    ? `<div class="section">
      <div class="section-h">Observações</div>
      <div class="obs">${esc(observationsText).replace(/\n/g, '<br/>')}</div>
    </div>`
    : '';

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
  const issueDate =
    contract.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const npYear = new Date(issueDate + 'T12:00:00').getFullYear();
  const npSerial = `${npYear}.${String(number).replace(/\D/g, '').padStart(10, '0')}`;

  const animalRef = `sobre o contrato nº <strong>${esc(String(number))}</strong> (animal <strong>${esc(
    contract.animal_name || ''
  )}</strong>${lot && lot !== '—' ? `, lote ${esc(lot)}` : ''})`;

  const buildPromissory = (opts: {
    amount: number;
    due: string | null | undefined;
    beneficiaryName: string | null | undefined;
    beneficiaryDocLabel: string;
    beneficiaryDoc: string | null | undefined;
    referenceHtml: string;
    placeOfPayment: string;
    emitterName: string | null | undefined;
    emitterDocument: string | null | undefined;
    emitterRole: string;
    serialSuffix: string;
  }) => {
    if (!(opts.amount > 0)) return '';

    return `
  <section class="np-card">
    <img class="np-logo" src="${logoUrl}" alt="Ariane Andrade" />
    <div class="np-sheet">
      <p class="np-title">NOTA PROMISSÓRIA</p>
      <p class="np-num">${esc(npSerial)}${esc(opts.serialSuffix)}</p>
      <p class="np-body">
        No dia <strong>${esc(fmtDateLong(opts.due || issueDate))}</strong> pagarei (emos) por esta nota promissória a
        <strong>${esc(opts.beneficiaryName || '________________')}</strong>,
        ${esc(opts.beneficiaryDocLabel)}: <strong>${esc(opts.beneficiaryDoc || '________________')}</strong>,
        ou a sua ordem a quantia de
        <strong>${esc(money(opts.amount))}</strong>
        (<strong>${esc(moneyInWords(opts.amount))}</strong>)
        em moeda corrente desse país, referente ${opts.referenceHtml}.
      </p>
      <p class="np-local">Local de pagamento: <strong>${esc(opts.placeOfPayment)}</strong></p>
      <p class="np-issue">${esc(fmtDateLong(issueDate))} – ${esc(ASSESSORIA.cityUf)}</p>
      <div class="np-sign">
        <div class="np-sign-line"></div>
        <p class="np-sign-name">${esc((opts.emitterName || '________________').toUpperCase())}</p>
        <p class="np-sign-doc">CPF/CNPJ: ${esc(opts.emitterDocument || '________________')}</p>
        <p class="np-sign-role">${esc(opts.emitterRole)}</p>
      </div>
    </div>
  </section>`;
  };

  const buildCommissionPromissory = (opts: {
    kind: 'venda' | 'compra';
    pct: number;
    emitterName: string | null | undefined;
    emitterDocument: string | null | undefined;
    serialSuffix: string;
  }) => {
    const kindLabel = opts.kind === 'venda' ? 'comissão de venda' : 'comissão de compra';
    const roleLabel = opts.kind === 'venda' ? 'VENDEDOR' : 'COMPRADOR';

    return buildPromissory({
      amount: (Number(contract.total_amount) * Number(opts.pct)) / 100,
      due: contract.first_due_date || dueLast,
      beneficiaryName: ASSESSORIA.name,
      beneficiaryDocLabel: 'CNPJ',
      beneficiaryDoc: ASSESSORIA.cnpj,
      referenceHtml: `à <strong>${esc(kindLabel)} de ${esc(String(opts.pct))}%</strong> ${animalRef}`,
      placeOfPayment: ASSESSORIA.cityUf,
      emitterName: opts.emitterName,
      emitterDocument: opts.emitterDocument,
      emitterRole: `${roleLabel} — emitente da ${kindLabel}`,
      serialSuffix: opts.serialSuffix,
    });
  };

  const sellerPlace = [contract.seller_city, contract.seller_state].filter(Boolean).join('/');

  // Nota do comprador em favor do vendedor, em garantia do valor do animal (cláusula 2.4 do verso).
  const salePromissory = buildPromissory({
    amount: Number(contract.total_amount),
    due: dueLast || contract.first_due_date,
    beneficiaryName: contract.seller_name,
    beneficiaryDocLabel: 'CPF/CNPJ',
    beneficiaryDoc: contract.seller_document,
    referenceHtml: `ao <strong>valor total da aquisição</strong> ${animalRef}`,
    placeOfPayment: sellerPlace || ASSESSORIA.cityUf,
    emitterName: contract.buyer_name,
    emitterDocument: contract.buyer_document,
    emitterRole: 'COMPRADOR — emitente em favor do vendedor',
    serialSuffix: '-G',
  });

  const sellerPct = Number(contract.commission_seller_pct);
  const buyerPct = Number(contract.commission_buyer_pct);
  let promissoryCards = [
    sellerPct > 0
      ? buildCommissionPromissory({
          kind: 'venda',
          pct: sellerPct,
          emitterName: contract.seller_name,
          emitterDocument: contract.seller_document,
          serialSuffix: '-V',
        })
      : '',
    buyerPct > 0
      ? buildCommissionPromissory({
          kind: 'compra',
          pct: buyerPct,
          emitterName: contract.buyer_name,
          emitterDocument: contract.buyer_document,
          serialSuffix: '-C',
        })
      : '',
  ].filter(Boolean);

  // Se marcou comissão total sem discriminar compra/venda, gera uma promissória
  // de venda (vendedor) com o % total — evita PDF sem NP quando só o total foi preenchido.
  if (!promissoryCards.length && Number(contract.commission_total_pct) > 0) {
    promissoryCards = [
      buildCommissionPromissory({
        kind: 'venda',
        pct: Number(contract.commission_total_pct),
        emitterName: contract.seller_name,
        emitterDocument: contract.seller_document,
        serialSuffix: '-V',
      }),
    ].filter(Boolean);
  }

  const allPromissoryCards = [salePromissory, ...promissoryCards].filter(Boolean);
  const promissory = allPromissoryCards.length
    ? `<div class="page np-page">${allPromissoryCards.join('\n')}</div>`
    : '';

  const signatureBlock = `
    <div class="page signs-page">
      <p class="signs-title">ASSINATURAS</p>
      <p class="signs-meta">CONTRATO Nº ${esc(String(number))} — LOTE ${esc(lot)} — ${esc(contract.animal_name || '')}</p>
      <div class="signs">
        <div class="sign"><div class="line"></div>VENDEDOR<br/><strong>${esc(contract.seller_name || '________________')}</strong></div>
        <div class="sign"><div class="line"></div>COMPRADOR<br/><strong>${esc(contract.buyer_name || '________________')}</strong></div>
        <div class="sign"><div class="line"></div>TESTEMUNHA 1<br/><strong>${esc(contract.witness1_name || '________________')}</strong></div>
        <div class="sign"><div class="line"></div>TESTEMUNHA 2<br/><strong>${esc(contract.witness2_name || '________________')}</strong></div>
      </div>
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
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
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
    .idbox .via { font-size: 7.5pt; margin: 4px 0; line-height: 1.35; font-weight: 700; }
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
    .obs {
      padding: 8px 10px; font-size: 8.5pt; line-height: 1.45;
      text-align: justify; white-space: pre-wrap;
    }
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
    .signs-page { padding-top: 18mm; }
    .signs-title {
      font-size: 12pt; font-weight: 800; text-align: center;
      margin: 0 0 4px; letter-spacing: 0.06em;
    }
    .signs-meta {
      text-align: center; font-size: 8.5pt; font-weight: 700;
      margin: 0 0 36px;
    }
    .signs-page .signs { margin-top: 12mm; gap: 28px 32px; }
    .signs-page .sign .line { margin: 36px 0 6px; }
    .sign { text-align: center; font-size: 8pt; }
    .sign .line { border-top: 1px dashed #333; margin: 28px 0 4px; }
    .muted { color: #555; font-size: 8pt; padding: 0 6px 6px; }
    .verso-title { font-size: 11pt; font-weight: 800; text-align: center; margin: 0 0 4px; text-transform: uppercase; }
    .verso-meta { text-align: center; font-size: 8.5pt; font-weight: 700; margin-bottom: 12px; }
    .verso-body p { margin: 0 0 8px; text-align: justify; font-size: 8.5pt; line-height: 1.4; white-space: pre-wrap; }
    .verso-body { margin-bottom: 8px; }
    .np-page { display: block; }
    .np-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10mm; }
    .np-card:last-child { margin-bottom: 0; }
    .np-logo { display: block; height: 34px; width: auto; margin: 0 auto 8px; }
    .np-sheet {
      border: 1px solid #222; background: #f2f0ec;
      padding: 14px 18px 18px;
    }
    .np-title {
      font-size: 14pt; font-weight: 800; text-align: center;
      margin: 0 0 4px; letter-spacing: 0.06em;
    }
    .np-num { text-align: center; font-size: 10.5pt; font-weight: 700; margin: 0 0 14px; }
    .np-body {
      font-size: 10pt; text-align: justify; line-height: 1.5;
      margin: 0 0 12px;
    }
    .np-local { font-size: 9.5pt; margin: 0 0 10px; }
    .np-issue { text-align: center; font-size: 10pt; font-weight: 700; margin: 0 0 6px; }
    .np-sign { width: 100%; max-width: 110mm; margin: 18px auto 0; text-align: center; }
    .np-sign-line { border-bottom: 1px solid #222; height: 22px; }
    .np-sign-name {
      margin: 6px 0 2px; font-size: 10pt; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.02em;
    }
    .np-sign-doc { margin: 0; font-size: 9pt; }
    .np-sign-role { margin: 4px 0 0; font-size: 7.5pt; color: #444; text-transform: uppercase; letter-spacing: 0.04em; }
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
        <p class="via">VIA DAS PARTES<br/>VENDEDOR E COMPRADOR</p>
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

    ${observationsBlock}

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
  </div>

  ${signatureBlock}

  ${promissory}
</body>
</html>`;
  return html;
}

/** Gera impressão/PDF estilo Nota de Leilão (frente) + verso do modelo. */
export function printContractPdf(contract: Contract) {
  const html = buildContractHtml(contract);

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

  const images = Array.from(doc.images).filter((el) => !el.complete);
  if (images.length) {
    let remaining = images.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) setTimeout(runPrint, 150);
    };
    images.forEach((el) => {
      el.addEventListener('load', done, { once: true });
      el.addEventListener('error', done, { once: true });
    });
  } else {
    setTimeout(runPrint, 150);
  }
}

/** Gera PDF em data-URL (base64) para envio à Clicksign. */
export async function getContractPdfBase64(contract: Contract): Promise<string> {
  const mod = await import('html2pdf.js');
  const html2pdf = (mod as { default: any }).default;
  const html = buildContractHtml(contract);
  const dataUrl: string = await html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `contrato-${contract.contract_number || contract.id}.pdf`,
      image: { type: 'jpeg', quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    })
    .from(html)
    .outputPdf('datauristring');
  if (!dataUrl || !dataUrl.includes('base64,')) {
    throw new Error('Falha ao gerar PDF do contrato');
  }
  return dataUrl;
}
