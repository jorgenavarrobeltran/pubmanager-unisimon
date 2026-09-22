const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Pagos APC\\CONTROL PAGOS APC 2020-2026-1.xlsx';
const wb = XLSX.readFile(filePath);

function parseDate(val, defaultYear) {
  if (!val) return null;
  if (typeof val === 'number') {
    if (val > 30000 && val < 60000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2})[\/\-\.\s]+(\d{1,2})[\/\-\.\s]+(\d{2,4})/);
  if (m) {
    let day = parseInt(m[1]);
    let month = parseInt(m[2]);
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    // sanity check
    if (month > 12 && day <= 12) {
      const temp = day; day = month; month = temp;
    }
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  return null;
}

function parsePesos(val) {
  if (!val) return 0;
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    let clean = val.replace(/\$/g, '').replace(/PESOS/gi, '').trim().replace(/\s+/g, '');
    const parts = clean.split(/[,\.]/);
    if (parts.length > 2) {
      const cents = parts[parts.length - 1];
      const ints = parts.slice(0, parts.length - 1).join('');
      if (cents.length === 2) return Math.round(parseFloat(`${ints}.${cents}`) || 0);
      return Math.round(parseFloat(parts.join('')) || 0);
    } else if (parts.length === 2) {
      if (parts[1].length === 3) return Math.round(parseFloat(`${parts[0]}${parts[1]}`) || 0);
      return Math.round(parseFloat(`${parts[0]}.${parts[1]}`) || 0);
    } else {
      return Math.round(parseFloat(clean) || 0);
    }
  }
  return 0;
}

function parseDivisa(val) {
  if (!val) return { raw: null, moneda: null, monto: null };
  const s = String(val).trim();
  let moneda = null;
  if (/chf/i.test(s)) moneda = 'CHF';
  else if (/usd|\$/i.test(s)) moneda = 'USD';
  else if (/eur|euro/i.test(s)) moneda = 'EUR';
  else if (/cop|pesos/i.test(s)) moneda = 'COP';
  else if (/gbp|libra/i.test(s)) moneda = 'GBP';

  const m = s.match(/([0-9]+([,\.][0-9]+)?)/);
  const monto = m ? parseFloat(m[1].replace(',', '.')) : null;
  return { raw: s, moneda, monto };
}

function cleanQuartile(val) {
  if (!val) return 'S/C';
  const s = String(val).toUpperCase().trim();
  if (s.includes('Q1')) return 'Q1';
  if (s.includes('Q2')) return 'Q2';
  if (s.includes('Q3')) return 'Q3';
  if (s.includes('Q4')) return 'Q4';
  return 'S/C';
}

function cleanFaculty(val) {
  if (!val) return 'Sin Facultad Asignada';
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'null') return 'Sin Facultad Asignada';
  const lower = s.toLowerCase();
  if (lower.includes('salud') || lower.includes('medicina')) return 'Ciencias de la Salud';
  if (lower.includes('basicas') || lower.includes('básicas') || lower.includes('biomedicas') || lower.includes('biomédicas')) return 'Ciencias Básicas y Biomédicas';
  if (lower.includes('ingenier')) return 'Ingenierías';
  if (lower.includes('jurid') || lower.includes('juríd') || lower.includes('sociales') || lower.includes('derecho')) return 'Ciencias Jurídicas y Sociales';
  if (lower.includes('administra') || lower.includes('econom') || lower.includes('contab')) return 'Ciencias Administrativas, Económicas y Contables';
  return s;
}

const allPayments = [];

wb.SheetNames.forEach(sheetName => {
  const year = parseInt(sheetName);
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[2] || [];

  const colMap = {};
  headers.forEach((h, idx) => {
    const s = String(h || '').toLowerCase().trim();
    if (s.includes('investigador')) colMap.investigador = idx;
    else if (s.includes('cedula') || s.includes('cédula')) colMap.cedula = idx;
    else if (s.includes('autorizacion') || s.includes('autorización')) colMap.fecha_autorizacion = idx;
    else if (s.includes('articulo') || s.includes('artículo')) colMap.articulo = idx;
    else if (s.includes('revista') && !s.includes('cuartil')) colMap.revista = idx;
    else if (s.includes('issn')) colMap.issn = idx;
    else if (s.includes('beneficiario')) colMap.beneficiario = idx;
    else if (s.includes('valor factura')) colMap.valor_factura = idx;
    else if (s.includes('consecutivo factura')) colMap.consecutivo_factura = idx;
    else if (s.includes('codigo interno') || s.includes('código interno')) colMap.codigo_interno = idx;
    else if (s.includes('orden de compra')) colMap.orden_compra = idx;
    else if (s.includes('fecha de pago')) colMap.fecha_pago = idx;
    else if (s.includes('cuartil')) colMap.cuartil = idx;
    else if (s.includes('estado de la solicitud')) colMap.estado_solicitud = idx;
    else if (s.includes('estado final') || s === 'estado') colMap.estado_final = idx;
    else if ((s.includes('valor pagado') && s.includes('pesos')) || s.includes('valor pagado en pesos')) colMap.valor_pagado_pesos = idx;
    else if (s.includes('reternido') || s.includes('retenido')) colMap.valor_retenido_pesos = idx;
    else if (s.includes('pais') || s.includes('país')) colMap.pais_origen = idx;
    else if (s.includes('link')) colMap.link_publicacion = idx;
    else if (s.includes('programa')) colMap.programa_academico = idx;
    else if (s.includes('facultad')) colMap.facultad = idx;
    else if (s.includes('centro de investigacion') || s.includes('centro de investigación')) colMap.centro_investigacion = idx;
    else if (s.includes('correspondencia')) colMap.autor_correspondencia = idx;
    else if (s.includes('afiliaci') || s.includes('afiliación')) colMap.afiliacion_institucional = idx;
    else if (s.includes('grupo de investigacion') || s.includes('grupo de investigación')) colMap.grupo_investigacion = idx;
    else if (s.includes('vinculado') || s.includes('vincualdo')) colMap.vinculado_grupo = idx;
    else if (s.includes('observ') || s.includes('oserv')) colMap.observaciones = idx;
  });

  let rowConsecutive = 1;
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawInvestigador = colMap.investigador !== undefined ? row[colMap.investigador] : row[1];
    const rawArticulo = colMap.articulo !== undefined ? row[colMap.articulo] : row[2];

    if (!rawInvestigador && !rawArticulo) continue;
    if (typeof rawInvestigador === 'string' && (rawInvestigador.includes('TOTAL') || rawInvestigador.includes('PRESUPUESTO'))) continue;

    const divisaInfo = parseDivisa(colMap.valor_factura !== undefined ? row[colMap.valor_factura] : null);
    const fechaAuto = parseDate(colMap.fecha_autorizacion !== undefined ? row[colMap.fecha_autorizacion] : null, year);
    const fechaPago = parseDate(colMap.fecha_pago !== undefined ? row[colMap.fecha_pago] : null, year);

    let rawAutoText = colMap.fecha_autorizacion !== undefined ? String(row[colMap.fecha_autorizacion] || '') : '';
    let autorizadoPor = null;
    if (rawAutoText.toLowerCase().includes('paola')) autorizadoPor = 'Paola Amar';
    else if (rawAutoText.toLowerCase().includes('luis ortiz')) autorizadoPor = 'Luis Ortiz';

    const pRecord = {
      id: `apc-${year}-${String(rowConsecutive).padStart(3, '0')}`,
      year: year,
      consecutive: typeof row[0] === 'number' ? row[0] : rowConsecutive,
      investigador: String(rawInvestigador || 'Sin Investigador').trim(),
      cedula: colMap.cedula !== undefined && row[colMap.cedula] ? String(row[colMap.cedula]).trim() : null,
      fecha_autorizacion: fechaAuto,
      autorizado_por: autorizadoPor,
      articulo: String(rawArticulo || 'Sin Título').trim(),
      revista: colMap.revista !== undefined && row[colMap.revista] ? String(row[colMap.revista]).trim() : 'Sin Revista',
      issn: colMap.issn !== undefined && row[colMap.issn] ? String(row[colMap.issn]).trim() : null,
      beneficiario: colMap.beneficiario !== undefined && row[colMap.beneficiario] ? String(row[colMap.beneficiario]).trim() : 'Otro',
      valor_factura_divisa: divisaInfo.raw,
      moneda: divisaInfo.moneda,
      monto_divisa: divisaInfo.monto,
      consecutivo_factura: colMap.consecutivo_factura !== undefined && row[colMap.consecutivo_factura] ? String(row[colMap.consecutivo_factura]).trim() : null,
      codigo_interno: colMap.codigo_interno !== undefined && row[colMap.codigo_interno] ? String(row[colMap.codigo_interno]).trim() : null,
      orden_compra: colMap.orden_compra !== undefined && row[colMap.orden_compra] ? String(row[colMap.orden_compra]).trim() : null,
      fecha_pago: fechaPago,
      cuartil: cleanQuartile(colMap.cuartil !== undefined ? row[colMap.cuartil] : null),
      estado_solicitud: colMap.estado_solicitud !== undefined && row[colMap.estado_solicitud] ? String(row[colMap.estado_solicitud]).toUpperCase().trim() : 'ATENDIDA',
      estado_final: colMap.estado_final !== undefined && row[colMap.estado_final] ? String(row[colMap.estado_final]).toUpperCase().trim() : 'PAGADA',
      valor_pagado_pesos: parsePesos(colMap.valor_pagado_pesos !== undefined ? row[colMap.valor_pagado_pesos] : null),
      valor_retenido_pesos: parsePesos(colMap.valor_retenido_pesos !== undefined ? row[colMap.valor_retenido_pesos] : null),
      pais_origen: colMap.pais_origen !== undefined && row[colMap.pais_origen] ? String(row[colMap.pais_origen]).trim() : null,
      link_publicacion: colMap.link_publicacion !== undefined && row[colMap.link_publicacion] ? String(row[colMap.link_publicacion]).trim() : null,
      programa_academico: colMap.programa_academico !== undefined && row[colMap.programa_academico] ? String(row[colMap.programa_academico]).trim() : null,
      facultad: cleanFaculty(colMap.facultad !== undefined ? row[colMap.facultad] : null),
      centro_investigacion: colMap.centro_investigacion !== undefined && row[colMap.centro_investigacion] ? String(row[colMap.centro_investigacion]).trim() : null,
      autor_correspondencia: colMap.autor_correspondencia !== undefined && row[colMap.autor_correspondencia] ? (String(row[colMap.autor_correspondencia]).toUpperCase().includes('SI') ? 'SI' : 'NO') : null,
      afiliacion_institucional: colMap.afiliacion_institucional !== undefined && row[colMap.afiliacion_institucional] ? (String(row[colMap.afiliacion_institucional]).toUpperCase().includes('SI') ? 'SI' : 'NO') : null,
      grupo_investigacion: colMap.grupo_investigacion !== undefined && row[colMap.grupo_investigacion] ? String(row[colMap.grupo_investigacion]).trim() : null,
      vinculado_grupo: colMap.vinculado_grupo !== undefined && row[colMap.vinculado_grupo] ? (String(row[colMap.vinculado_grupo]).toUpperCase().includes('SI') ? 'SI' : 'NO') : null,
      observaciones: colMap.observaciones !== undefined && row[colMap.observaciones] ? String(row[colMap.observaciones]).trim() : null,
      created_at: new Date().toISOString()
    };

    allPayments.push(pRecord);
    rowConsecutive++;
  }
});

console.log(`\nTOTAL PARSED RECORDS: ${allPayments.length}`);

// Calculate total executed by year
const annualTotals = {};
allPayments.forEach(p => {
  annualTotals[p.year] = (annualTotals[p.year] || 0) + p.valor_pagado_pesos;
});

// Prepare default annual budget pool (bolsa anual)
// Default budget pool reasonable for the executed amounts (e.g. rounded up to nearest 50M)
const defaultBudgets = [
  { year: 2020, allocated_budget: 150000000, notes: 'Bolsa presupuestal 2020' },
  { year: 2021, allocated_budget: 300000000, notes: 'Bolsa presupuestal 2021' },
  { year: 2022, allocated_budget: 400000000, notes: 'Bolsa presupuestal 2022' },
  { year: 2023, allocated_budget: 350000000, notes: 'Bolsa presupuestal 2023' },
  { year: 2024, allocated_budget: 350000000, notes: 'Bolsa presupuestal 2024' },
  { year: 2025, allocated_budget: 350000000, notes: 'Bolsa presupuestal 2025' },
  { year: 2026, allocated_budget: 400000000, notes: 'Bolsa presupuestal 2026 (vigente)' },
];

console.log('Annual execution vs default budget:');
defaultBudgets.forEach(b => {
  const exec = annualTotals[b.year] || 0;
  const pct = Math.round((exec / b.allocated_budget) * 100);
  console.log(`  ${b.year}: Asignado $${b.allocated_budget.toLocaleString()} COP | Ejecutado $${exec.toLocaleString()} COP (${pct}%)`);
});

// Save to JSON for immediate local fallback in src/lib/apc-initial-data.json
const outDir = path.join(__dirname, '..', 'src', 'lib');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const targetFile = path.join(outDir, 'apc-initial-data.json');
fs.writeFileSync(targetFile, JSON.stringify({
  budgets: defaultBudgets,
  payments: allPayments,
  metadata: {
    totalRecords: allPayments.length,
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    leader: {
      name: 'Fernando Alberto Peñaranda',
      email: 'fernando.penaranda@unisimon.edu.co',
      role: 'Coordinador de Proyectos'
    },
    generatedAt: new Date().toISOString()
  }
}, null, 2), 'utf8');

console.log(`\nSuccessfully exported to: ${targetFile}`);
