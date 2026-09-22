const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'src', 'lib', 'apc-initial-data.json');
const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const payments = raw.payments;

function normalizeName(name) {
  if (!name) return 'Desconocido';
  let s = name.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents for matching
    .replace(/\s+Y\s+EQUIPO.*/i, '')
    .replace(/\s+EQUIPO.*/i, '')
    .replace(/^DR\.?\s+/i, '')
    .replace(/^DRA\.?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Specific alias unifications
  if (s.startsWith('VALMORE BERMUDEZ')) return 'Valmore Bermúdez';
  if (s.startsWith('LEONARDO PACHECO')) return 'Leonardo Pacheco Londoño';
  if (s.startsWith('EDUARDO') && s.includes('NAVARRO')) return 'Eduardo Navarro Jiménez';
  if (s.startsWith('ELKIN') && s.includes('NAVARRO')) return 'Elkin Navarro Quiroz';
  if (s.startsWith('INDIANA') && s.includes('ROJAS')) return 'Indiana Luz Rojas Torres';
  if (s.startsWith('ROOSVEL') && s.includes('SOTO')) return 'Roosvel Soto Díaz';
  if (s.startsWith('ANDERSON') && s.includes('DIAZ')) return 'Anderson Díaz Pérez';
  if (s.startsWith('HERNAN') && s.includes('HERNANDEZ')) return 'Hernán Hernández Herrera';
  if (s.startsWith('JUAN DIEGO') && s.includes('HERNANDEZ')) return 'Juan Diego Hernández Lalinde';
  if (s.startsWith('LILIBETH') && s.includes('SANCHEZ')) return 'Lilibeth Sánchez Güette';
  if (s.startsWith('DAVID') && s.includes('MARTINEZ')) return 'David Enrique Martínez Sierra';
  if (s.startsWith('JORGE') && s.includes('DAES')) return 'Jorge Daes';
  if (s.startsWith('MARBEL') && s.includes('GRAVINI')) return 'Marbel Gravini';
  if (s.startsWith('RAFAEL') && s.includes('RADA')) return 'Rafael Rada Donado';

  // Capitalize words nicely
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

const stats = {};
payments.forEach(p => {
  const norm = normalizeName(p.investigador);
  if (!stats[norm]) {
    stats[norm] = {
      name: norm,
      count: 0,
      totalCOP: 0,
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      faculties: new Set()
    };
  }
  stats[norm].count++;
  stats[norm].totalCOP += (p.valor_pagado_pesos || 0);
  if (p.cuartil === 'Q1') stats[norm].q1++;
  if (p.cuartil === 'Q2') stats[norm].q2++;
  if (p.cuartil === 'Q3') stats[norm].q3++;
  if (p.cuartil === 'Q4') stats[norm].q4++;
  if (p.facultad) stats[norm].faculties.add(p.facultad);
});

const top10 = Object.values(stats)
  .sort((a, b) => b.count - a.count || b.totalCOP - a.totalCOP)
  .slice(0, 10);

console.log('--- REFINED TOP 10 PROFESORES ---');
top10.forEach((r, i) => {
  const facs = Array.from(r.faculties).filter(f => f && f !== 'Sin Facultad Asignada').join(', ') || 'N/A';
  console.log(`${i+1}. ${r.name}: ${r.count} artículos | $${r.totalCOP.toLocaleString('es-CO')} COP | Q1: ${r.q1}, Q2: ${r.q2} | Fac: ${facs}`);
});
