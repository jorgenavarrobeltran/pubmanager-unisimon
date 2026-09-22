const XLSX = require('xlsx');

const filePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Pagos APC\\CONTROL PAGOS APC 2020-2026-1.xlsx';
const wb = XLSX.readFile(filePath);

function parsePesos(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    // clean string "$10.160,014,88" or "19372119.92" or "$ 1.746.029"
    let clean = val.replace(/\$/g, '').trim();
    // if contains commas and periods
    // check format
    clean = clean.replace(/\s+/g, '');
    // Replace commas that are thousand separators if period is decimal, or vice versa
    // Let's test standard Colombian formats
    // e.g. "$10.160,014,88" -> 10160014.88
    // "19372119.92" -> 19372119.92
    // "$1.746,029,07" -> 1746029.07
    // "193,915 PESOS" -> 193915
    clean = clean.replace(/PESOS/gi, '').trim();
    // remove dots
    const parts = clean.split(/[,\.]/);
    if (parts.length > 2) {
      // e.g. 10 . 160 , 014 , 88 -> the last 2 digits might be cents
      const cents = parts[parts.length - 1];
      const ints = parts.slice(0, parts.length - 1).join('');
      if (cents.length === 2) {
        return parseFloat(`${ints}.${cents}`) || 0;
      } else {
        return parseFloat(parts.join('')) || 0;
      }
    } else if (parts.length === 2) {
      return parseFloat(`${parts[0]}.${parts[1]}`) || 0;
    } else {
      return parseFloat(clean) || 0;
    }
  }
  return 0;
}

const statsByYear = {};

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = rows[2] || [];
  
  // Find column indexes
  let colPesos = -1;
  let colRetencion = -1;
  let colCuartil = -1;
  let colEstadoFinal = -1;
  let colInvestigador = -1;
  let colArticulo = -1;
  let colRevista = -1;
  let colBeneficiario = -1;
  let colFacultad = -1;
  let colFecha = -1;

  headers.forEach((h, idx) => {
    const s = String(h || '').toLowerCase().trim();
    if (s.includes('valor pagado en pesos') || s.includes('valor pagado') && s.includes('pesos')) colPesos = idx;
    if (s.includes('reternido') || s.includes('retenido')) colRetencion = idx;
    if (s.includes('cuartil')) colCuartil = idx;
    if (s.includes('estado final') || s === 'estado') colEstadoFinal = idx;
    if (s.includes('investigador')) colInvestigador = idx;
    if (s.includes('articulo')) colArticulo = idx;
    if (s.includes('revista') && !s.includes('cuartil')) colRevista = idx;
    if (s.includes('beneficiario')) colBeneficiario = idx;
    if (s.includes('facultad')) colFacultad = idx;
    if (s.includes('fecha de pago')) colFecha = idx;
  });

  let count = 0;
  let sumPesos = 0;
  let sumRetencion = 0;
  const quartiles = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Other: 0 };
  const publishers = {};
  const faculties = {};

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const inv = row[colInvestigador >= 0 ? colInvestigador : 1];
    const art = row[colArticulo >= 0 ? colArticulo : 2];
    if (!inv && !art) continue;
    if (inv && typeof inv === 'string' && (inv.includes('TOTAL') || inv.includes('PRESUPUESTO'))) continue;

    count++;
    const rawPesos = colPesos >= 0 ? row[colPesos] : 0;
    const rawRet = colRetencion >= 0 ? row[colRetencion] : 0;
    const pVal = parsePesos(rawPesos);
    const rVal = parsePesos(rawRet);
    sumPesos += pVal;
    sumRetencion += rVal;

    let q = (colCuartil >= 0 && row[colCuartil] ? String(row[colCuartil]).trim().toUpperCase() : 'S/C');
    if (q.includes('Q1')) quartiles.Q1++;
    else if (q.includes('Q2')) quartiles.Q2++;
    else if (q.includes('Q3')) quartiles.Q3++;
    else if (q.includes('Q4')) quartiles.Q4++;
    else quartiles.Other++;

    const pub = colBeneficiario >= 0 && row[colBeneficiario] ? String(row[colBeneficiario]).trim() : 'Otro';
    publishers[pub] = (publishers[pub] || 0) + 1;

    const fac = colFacultad >= 0 && row[colFacultad] ? String(row[colFacultad]).trim() : 'Sin Facultad';
    faculties[fac] = (faculties[fac] || 0) + 1;
  }

  statsByYear[sheetName] = {
    count,
    totalPesos: Math.round(sumPesos),
    totalRetencion: Math.round(sumRetencion),
    quartiles,
    topPublishers: Object.entries(publishers).sort((a,b) => b[1] - a[1]).slice(0, 3),
    topFaculties: Object.entries(faculties).sort((a,b) => b[1] - a[1]).slice(0, 3)
  };
});

console.log(JSON.stringify(statsByYear, null, 2));
