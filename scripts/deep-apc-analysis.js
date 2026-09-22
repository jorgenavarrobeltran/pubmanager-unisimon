const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'src', 'lib', 'apc-initial-data.json');
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const payments = raw.payments;

console.log(`Total payments: ${payments.length}`);

// 1. Average cost per article (overall and with paid COP > 0)
const paidWithCOP = payments.filter(p => p.valor_pagado_pesos > 0);
const totalCOP = payments.reduce((acc, p) => acc + (p.valor_pagado_pesos || 0), 0);
const avgCostCOP = Math.round(totalCOP / paidWithCOP.length);
const minCostCOP = Math.min(...paidWithCOP.map(p => p.valor_pagado_pesos));
const maxCostCOP = Math.max(...paidWithCOP.map(p => p.valor_pagado_pesos));

console.log(`\n--- 1. COSTOS Y VALORES APC ---`);
console.log(`Total Invertido COP: $${totalCOP.toLocaleString('es-CO')}`);
console.log(`Artículos con pago liquidado: ${paidWithCOP.length}`);
console.log(`Promedio de valor por artículo: $${avgCostCOP.toLocaleString('es-CO')} COP`);
console.log(`Costo mínimo: $${minCostCOP.toLocaleString('es-CO')} COP`);
console.log(`Costo máximo: $${maxCostCOP.toLocaleString('es-CO')} COP`);

// Cost by quartile
const costByQuartile = {};
payments.forEach(p => {
  const q = p.cuartil || 'S/C';
  if (!costByQuartile[q]) costByQuartile[q] = { totalCOP: 0, count: 0, paidCount: 0 };
  costByQuartile[q].count++;
  if (p.valor_pagado_pesos > 0) {
    costByQuartile[q].totalCOP += p.valor_pagado_pesos;
    costByQuartile[q].paidCount++;
  }
});

console.log(`\n--- 2. COSTO PROMEDIO POR CUARTIL ---`);
Object.entries(costByQuartile).forEach(([q, val]) => {
  const avg = val.paidCount > 0 ? Math.round(val.totalCOP / val.paidCount) : 0;
  console.log(`  ${q}: ${val.count} artículos | $${val.totalCOP.toLocaleString('es-CO')} COP total | Promedio: $${avg.toLocaleString('es-CO')} COP`);
});

// 3. Top 10 Investigadores con más artículos / solicitudes
// Normalize researcher names (remove 'y equipo', trim, uppercase)
function cleanResearcherName(name) {
  if (!name) return 'Desconocido';
  let s = name.toUpperCase()
    .replace(/\s+Y\s+EQUIPO.*/i, '')
    .replace(/\s+EQUIPO.*/i, '')
    .replace(/^DR\.?\s+/i, '')
    .replace(/^DRA\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

const researcherStats = {};
payments.forEach(p => {
  const norm = cleanResearcherName(p.investigador);
  if (!researcherStats[norm]) {
    researcherStats[norm] = {
      name: norm,
      rawSample: p.investigador,
      articlesCount: 0,
      totalCOP: 0,
      faculties: new Set(),
      q1Count: 0,
      q2Count: 0
    };
  }
  researcherStats[norm].articlesCount++;
  researcherStats[norm].totalCOP += (p.valor_pagado_pesos || 0);
  if (p.facultad) researcherStats[norm].faculties.add(p.facultad);
  if (p.cuartil === 'Q1') researcherStats[norm].q1Count++;
  if (p.cuartil === 'Q2') researcherStats[norm].q2Count++;
});

const top10Researchers = Object.values(researcherStats)
  .sort((a, b) => b.articlesCount - a.articlesCount || b.totalCOP - a.totalCOP)
  .slice(0, 10);

console.log(`\n--- 3. TOP 10 PROFESORES / INVESTIGADORES CON MÁS SERVICIOS SOLICITADOS ---`);
top10Researchers.forEach((r, idx) => {
  console.log(`  ${idx + 1}. ${r.name}: ${r.articlesCount} artículos | Total: $${r.totalCOP.toLocaleString('es-CO')} COP | Q1: ${r.q1Count}, Q2: ${r.q2Count}`);
});

// 4. Top Research Groups
const groupStats = {};
payments.forEach(p => {
  const g = p.grupo_investigacion ? p.grupo_investigacion.trim() : null;
  if (!g) return;
  if (!groupStats[g]) groupStats[g] = { name: g, count: 0, totalCOP: 0 };
  groupStats[g].count++;
  groupStats[g].totalCOP += (p.valor_pagado_pesos || 0);
});

const topGroups = Object.values(groupStats)
  .sort((a, b) => b.count - a.count)
  .slice(0, 8);

console.log(`\n--- 4. TOP GRUPOS DE INVESTIGACIÓN ---`);
topGroups.forEach((g, idx) => {
  console.log(`  ${idx + 1}. ${g.name}: ${g.count} artículos ($${g.totalCOP.toLocaleString('es-CO')} COP)`);
});

// 5. Turnaround / Lead Time (Dias entre autorizacion y pago)
let daysSum = 0;
let daysCount = 0;
payments.forEach(p => {
  if (p.fecha_autorizacion && p.fecha_pago) {
    const d1 = new Date(p.fecha_autorizacion);
    const d2 = new Date(p.fecha_pago);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 365) {
        daysSum += diffDays;
        daysCount++;
      }
    }
  }
});
const avgDays = daysCount > 0 ? Math.round(daysSum / daysCount) : 0;
console.log(`\n--- 5. TIEMPO PROMEDIO DE CICLO DE PAGO (LEAD TIME) ---`);
console.log(`Días promedio entre autorización y pago: ${avgDays} días (${daysCount} registros evaluados)`);

// 6. Total Withholding Tax (Retenciones COP)
const totalRetencion = payments.reduce((acc, p) => acc + (p.valor_retenido_pesos || 0), 0);
console.log(`\n--- 6. RETENCIÓN FISCAL ACUMULADA ---`);
console.log(`Total retenciones aplicadas: $${totalRetencion.toLocaleString('es-CO')} COP`);
