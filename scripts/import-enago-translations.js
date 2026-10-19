/**
 * Importa el histórico de ENAGO (proveedor de traducciones/edición de Unisimón)
 * desde el Excel de depósito y genera src/lib/translations-initial-data.json
 * Además, enriquece cada encargo con el registro interno de Unisimón (CSV), del que
 * SOLO se toman: equipo de investigadores, nombre del artículo, revista, cuartil y facultad.
 * Los valores, fechas y palabras provienen exclusivamente del reporte de ENAGO.
 * Cruce: n.º UNISIL y, si no existe, n.º de cotización INQ.
 *
 * Uso: node scripts/import-enago-translations.js ["ruta/al/archivo.xlsx"] ["ruta/al/registro.csv"]
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'ENAGO USB_UNISIL_DEPOSIT Octubre 8 de 2026.xlsx');
const CSV_SRC = process.argv[3] || path.join(ROOT, 'REGISTRO SERVICIOS DE TRADUCION ENAGO(TRAD ENAGO).csv');
const OUT = path.join(ROOT, 'src', 'lib', 'translations-initial-data.json');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseDate(v) {
  if (v == null) return null;
  if (v instanceof Date && !isNaN(v)) {
    const d = new Date(v.getTime() + 12 * 3600000); // evita desfases por zona horaria
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, '0')}-${String(parseInt(m[1], 10)).padStart(2, '0')}`;
}

function parseMoney(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const s = String(v).replace(/[$,\s]/g, '').replace(/USD/i, '');
  if (!s || s === '-') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function parseIntSafe(v) {
  const n = parseInt(String(v ?? '').replace(/[,\s]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function normalizeService(s) {
  const t = String(s || '').replace(/\s*\+\s*/g, '+').trim();
  const map = {
    'Translation+Editing': 'Traducción + Edición',
    'Copyediting': 'Corrección de estilo',
    'Substantive Editing': 'Edición sustantiva',
    'Miscellaneous services': 'Servicios varios',
  };
  return map[t] || t || 'Sin especificar';
}

function normalizeStatus(s, cancelled) {
  if (cancelled) return 'Cancelado';
  const t = String(s || '').trim().toLowerCase();
  if (t === 'completed') return 'Completado';
  if (t === 'wip' || t === 'in-progress') return 'En proceso';
  return 'Sin estado';
}

// Variantes de nombre del personal Unisimón que gestiona los encargos ante ENAGO
function normalizeRequester(name) {
  if (!name) return null;
  const raw = String(name).trim();
  if (!raw || raw.toUpperCase() === 'NA') return null;
  const s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').replace(/\.$/, '');
  if (s.includes('ivone')) return 'Ivone Romero';
  if (s.includes('almendrales')) return 'Wendys Almendrales';
  if (s.includes('teheran')) return 'Melissa Teherán Suárez';
  if (s.includes('navarro')) return 'Jorge Navarro Beltrán';
  if (s.includes('leidy')) return 'Leidy Pérez Coronel';
  if (s.includes('ortiz')) return 'Luis Ortiz Ospino';
  if (s.includes('munoz') || s === 'jessica') return 'Jessica Muñoz Reyes';
  if (s.includes('heidy')) return 'Heidy Borja';
  if (s.includes('padilla')) return 'Jair Antonio Padilla Gracia';
  if (s.includes('dhayana')) return 'Dhayana Fernandes';
  return raw.replace(/\s+/g, ' ');
}

function normalizeEmail(e) {
  if (!e) return null;
  const s = String(e).trim().toLowerCase();
  if (!s || s === 'na' || !s.includes('@')) return null;
  return s.replace(/\.com$/, '.co');
}

const wb = XLSX.readFile(SRC, { cellDates: true });
const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
  .map(r => r.slice(0, 14));

const orders = [];
const deposits = [];
let reportedTotalFees = null;
let mode = 'orders';

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.every(c => c == null || String(c).trim() === '')) continue;

  if (mode === 'orders') {
    if (String(r[1] || '').trim() === 'Total Fees') {
      reportedTotalFees = parseMoney(r[2]);
      continue;
    }
    if (String(r[0] || '').trim() === 'Deposit date') { mode = 'deposits'; continue; }
    if (String(r[0] || '').trim() !== 'UNISIL') continue;

    const assignment = String(r[1]).trim();
    const cancelled = /cancel/i.test(assignment);
    const fee = parseMoney(r[2]);
    let confirmed = parseDate(r[3]);
    const delivered = parseDate(r[4]);
    const extra = [r[12], r[13]].filter(Boolean).map(x => String(x).trim()).filter(Boolean);
    const notes = [];

    // Corrige errores de digitación del año (p. ej. confirmado 2023, entregado 2024)
    if (confirmed && delivered) {
      const diff = (new Date(delivered) - new Date(confirmed)) / 86400000;
      if (diff > 200) {
        const fixed = delivered.slice(0, 4) + confirmed.slice(4);
        if (new Date(fixed) <= new Date(delivered)) {
          notes.push(`Fecha de confirmación corregida (original: ${confirmed}).`);
          confirmed = fixed;
        }
      }
    }

    // Encargos facturados por fuera del depósito
    let chargedToDeposit = !cancelled && fee > 0;
    let offDepositAmount = null;
    if (fee === 0 && !cancelled && extra.length) {
      const amt = extra.map(parseMoney).find(n => n > 0);
      if (amt) offDepositAmount = amt;
      chargedToDeposit = false;
    }
    extra.filter(x => parseMoney(x) === 0).forEach(x => notes.push(x));
    if (offDepositAmount) notes.push(`Valor cotizado USD ${offDepositAmount.toFixed(2)} no descontado del depósito.`);

    const year = confirmed ? parseInt(confirmed.slice(0, 4), 10) : (delivered ? parseInt(delivered.slice(0, 4), 10) : null);
    const turnaround = confirmed && delivered
      ? Math.round((new Date(delivered) - new Date(confirmed)) / 86400000)
      : null;

    orders.push({
      id: assignment.replace(/_Cancelled/i, ''),
      assignment_number: assignment.replace(/_Cancelled/i, ''),
      provider: 'ENAGO',
      membership_id: 'UNISIL',
      year,
      fee_usd: fee,
      quoted_off_deposit_usd: offDepositAmount,
      charged_to_deposit: chargedToDeposit,
      confirmed_on: confirmed,
      delivered_on: delivered,
      turnaround_days: turnaround != null && turnaround >= 0 ? turnaround : null,
      service: normalizeService(r[5]),
      word_count: parseIntSafe(r[6]),
      status: normalizeStatus(r[7], cancelled),
      inquiry_number: r[8] && String(r[8]).trim() !== 'NULL' ? String(r[8]).trim() : null,
      priority: r[9] && r[9] !== '-' ? String(r[9]).trim() : null,
      requested_by: normalizeRequester(r[10]),
      researcher_email: normalizeEmail(r[11]),
      researcher_team: null,
      manuscript_title: null,
      journal: null,
      quartile: null,
      facultad: null,
      notes: notes.length ? notes.join(' ') : null,
    });
  } else {
    const label = String(r[0] || '').trim();
    if (/^total$/i.test(label) || /deposit utilized|balance/i.test(label)) continue;
    const date = parseDate(r[0]);
    if (!date) continue;
    const amount = parseMoney(r[1]);
    const tax = parseMoney(r[2]);
    deposits.push({
      id: `DEP-${date}`,
      deposit_date: date,
      year: parseInt(date.slice(0, 4), 10),
      amount_usd: amount,
      withholding_tax_usd: tax,
      received_usd: parseMoney(r[3]) || amount - tax,
      notes: null,
    });
  }
}

/* ---------- Enriquecimiento con el registro interno (CSV) ---------- */
const clean = v => {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return !s || /^(n\/?a|0|-|null)$/i.test(s) ? null : s;
};
const titleCaseIfUpper = s => {
  if (!s || s !== s.toUpperCase() || !/[A-ZÁÉÍÓÚÑ]/.test(s)) return s;
  const small = new Set(['y', 'de', 'del', 'la', 'las', 'los', 'e']);
  return s.toLowerCase().split(' ').map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/(^|-)(\p{L})/gu, (_, p, c) => p + c.toUpperCase()))).join(' ');
};
function normalizeFaculty(f) {
  const s = clean(f);
  if (!s) return null;
  const k = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/_/g, ' ');
  if (k.includes('basicas') || k.includes('biomedicas')) return 'Facultad de Ciencias Básicas y Biomédicas';
  if (k.includes('juridicas')) return 'Facultad de Ciencias Jurídicas y Sociales';
  if (k.includes('administracion')) return 'Facultad de Administración y Negocios';
  if (k.includes('salud')) return 'Facultad de Ciencias de la Salud';
  if (k.includes('ingenier')) return 'Facultad de Ingenierías';
  if (k.includes('sociales y humanas')) return 'Departamento de Ciencias Sociales y Humanas';
  if (k.includes('innovacion social')) return 'Centro de Investigación e Innovación Social';
  return s;
}
function normalizeQuartile(q) {
  const s = clean(q);
  const m = s && s.toUpperCase().match(/Q[1-4]/);
  return m ? m[0] : null;
}
const keyInq = s => { const m = s && String(s).toUpperCase().replace(/\s/g, '').match(/INQ-?(\d+)/); return m ? `INQ-${m[1]}` : null; };
const keyUni = s => { const m = s && String(s).toUpperCase().replace(/\s/g, '').match(/UNISIL-?(\d+)/); return m ? `UNISIL-${m[1]}` : null; };

const enrichment = { file: null, rows: 0, matched: 0, byUnisil: 0, byInq: 0, unmatched: [] };
if (fs.existsSync(CSV_SRC)) {
  const text = new TextDecoder('windows-1252').decode(fs.readFileSync(CSV_SRC));
  const csvWs = XLSX.read(text, { type: 'string', raw: true }).Sheets;
  const csvRows = XLSX.utils.sheet_to_json(csvWs[Object.keys(csvWs)[0]], { header: 1, defval: null, raw: true });
  const headerIdx = csvRows.findIndex(r => r && String(r[0] || '').toUpperCase().includes('EQUIPO DE INVESTIGADORES'));
  const byUni = new Map(orders.map(o => [o.assignment_number, o]));
  const byInq = new Map(orders.filter(o => o.inquiry_number).map(o => [keyInq(o.inquiry_number), o]));
  const score = o => ['researcher_team', 'manuscript_title', 'journal', 'quartile', 'facultad'].filter(k => o[k]).length;
  enrichment.file = path.basename(CSV_SRC);

  for (const r of csvRows.slice(headerIdx + 1)) {
    if (!r || !r.some(c => c != null && String(c).trim())) continue;
    let title = clean(r[1]);
    if (title && /^unisil cancelado$/i.test(title)) title = null;
    const fields = {
      researcher_team: titleCaseIfUpper(clean(r[0])),
      manuscript_title: title,
      journal: clean(r[2]),
      quartile: normalizeQuartile(r[3]),
      facultad: normalizeFaculty(r[4]),
    };
    if (!Object.values(fields).some(Boolean)) continue;
    enrichment.rows++;
    const uni = keyUni(r[9]);
    const inq = keyInq(r[8]);
    let target = uni ? byUni.get(uni) : null;
    let how = 'byUnisil';
    if (!target && inq) { target = byInq.get(inq); how = 'byInq'; }
    if (!target) { enrichment.unmatched.push(inq || uni || (title || '').slice(0, 50)); continue; }
    // Si el UNISIL aparece repetido en el CSV, se conserva la fila más completa
    const candidate = { ...fields };
    const current = { researcher_team: target.researcher_team, manuscript_title: target.manuscript_title, journal: target.journal, quartile: target.quartile, facultad: target.facultad };
    if (score(candidate) >= score(current)) {
      if (score(current) === 0) { enrichment.matched++; enrichment[how]++; }
      Object.assign(target, candidate);
    }
  }
}

const totalFees = Math.round(orders.reduce((a, o) => a + (o.charged_to_deposit ? o.fee_usd : 0), 0) * 100) / 100;
const totalDeposits = Math.round(deposits.reduce((a, d) => a + d.received_usd, 0) * 100) / 100;

const data = {
  provider: {
    name: 'ENAGO',
    legal_name: 'Crimson Interactive (ENAGO)',
    membership_id: 'UNISIL',
    services: ['Traducción + Edición', 'Corrección de estilo', 'Edición sustantiva', 'Servicios varios'],
    currency: 'USD',
  },
  source_file: path.basename(SRC),
  enrichment_file: enrichment.file,
  generated_at: new Date().toISOString(),
  summary: {
    orders: orders.length,
    total_fees_usd: totalFees,
    reported_total_fees_usd: reportedTotalFees,
    total_deposits_usd: totalDeposits,
    balance_usd: Math.round((totalDeposits - totalFees) * 100) / 100,
  },
  orders,
  deposits,
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
console.log(`✓ ${orders.length} encargos, ${deposits.length} depósitos`);
console.log(`  Total facturado: USD ${totalFees} (Excel reporta ${reportedTotalFees})`);
console.log(`  Depósitos: USD ${totalDeposits} · Saldo: USD ${data.summary.balance_usd}`);
if (enrichment.file) {
  console.log(`  Registro interno: ${enrichment.matched} encargos enriquecidos (${enrichment.byUnisil} por UNISIL, ${enrichment.byInq} por INQ) de ${enrichment.rows} filas`);
  if (enrichment.unmatched.length) console.log(`  Sin cruce en ENAGO (no se importan): ${enrichment.unmatched.join(' | ')}`);
}
console.log(`  → ${path.relative(ROOT, OUT)}`);
