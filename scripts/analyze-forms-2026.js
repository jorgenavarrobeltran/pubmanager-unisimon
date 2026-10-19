const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load env
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  return [k.trim(), v.join('=').trim()];
}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Parse Excel
const filePath = 'SOLICITUD DE CERTIFICACIÓN Y_O AVAL DE PUBLICACIONES BIBLIOGRÁFICAS(1-216).xlsx';
const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const allRows = XLSX.utils.sheet_to_json(sheet);

console.log('Total filas en Excel:', allRows.length);
console.log('Columnas:', Object.keys(allRows[0]).join(' | '));
console.log('');

// Helper
function findVal(row, matchers) {
  const keys = Object.keys(row);
  for (const m of matchers) {
    for (const k of keys) {
      if (k.toLowerCase().includes(m.toLowerCase())) {
        const v = row[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
      }
    }
  }
  return '';
}

// Filter 2026 rows
const rows2026 = [];
allRows.forEach((row, idx) => {
  // Check date columns - look for Start time, Completion time, or any date
  let dateStr = '';
  const keys = Object.keys(row);
  for (const k of keys) {
    if (k.toLowerCase().includes('start') || k.toLowerCase().includes('completion') || k.toLowerCase().includes('hora') || k.toLowerCase().includes('fecha')) {
      const val = row[k];
      if (val) {
        if (val instanceof Date) {
          dateStr = val.toISOString();
        } else {
          dateStr = String(val);
        }
        break;
      }
    }
  }
  
  if (dateStr.includes('2026') || dateStr.includes('26')) {
    // Check if it's actually 2026
    const d = new Date(dateStr);
    if (d.getFullYear() === 2026 || dateStr.includes('2026')) {
      rows2026.push({ ...row, _idx: idx + 1, _date: dateStr });
    }
  }
});

console.log('Filas del 2026:', rows2026.length);
console.log('='.repeat(140));

rows2026.forEach((row, i) => {
  const nombres = findVal(row, ['Nombres']);
  const apellidos = findVal(row, ['Apellidos']);
  const nombre = nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos || 'N/A');
  const correo = findVal(row, ['Correo institucional', 'Correo']);
  const tipologia = findVal(row, ['Seleccione el tipo de producto', 'Tipología de producto', 'tipo de producto que desea certificar']);
  const tituloLibro = findVal(row, ['Título completo del libro', 'Título completo de la obra']);
  const tituloCapitulo = findVal(row, ['Título específico del capítulo', 'capítulo']);
  const isbn = findVal(row, ['Código ISBN']);
  const facultad = findVal(row, ['Facultad']);
  const sede = findVal(row, ['Sede']);
  const grupo = findVal(row, ['Grupo de investigación', 'Grupo']);
  
  console.log(`\n--- Solicitud Forms #${i + 1} (Fila Excel: ${row._idx}) | Fecha: ${row._date} ---`);
  console.log(`  Nombre:     ${nombre}`);
  console.log(`  Correo:     ${correo}`);
  console.log(`  Facultad:   ${facultad}`);
  console.log(`  Sede:       ${sede}`);
  console.log(`  Grupo:      ${grupo}`);
  console.log(`  Tipología:  ${tipologia}`);
  console.log(`  Libro:      ${tituloLibro.substring(0, 80)}`);
  console.log(`  Capítulo:   ${tituloCapitulo.substring(0, 80)}`);
  console.log(`  ISBN:       ${isbn}`);
});

// Now load existing certs to try matching
async function matchWithCerts() {
  const { data: certs } = await supabase.from('certificates')
    .select('id, consecutive_number, recipient_name, title_reference, certificate_type, status, requester_name, requester_email, request_channel')
    .order('consecutive_number');

  console.log('\n\n' + '='.repeat(140));
  console.log('CRUCE AUTOMÁTICO: Solicitudes Forms 2026 vs Certificados existentes');
  console.log('='.repeat(140));
  
  const matched = [];
  const unmatched = [];

  rows2026.forEach((row, i) => {
    const nombres = findVal(row, ['Nombres']);
    const apellidos = findVal(row, ['Apellidos']);
    const nombre = nombres && apellidos ? `${nombres} ${apellidos}` : (nombres || apellidos || 'N/A');
    const correo = findVal(row, ['Correo institucional', 'Correo']);
    const tituloLibro = findVal(row, ['Título completo del libro', 'Título completo de la obra']).toLowerCase();
    const tituloCapitulo = findVal(row, ['Título específico del capítulo', 'capítulo']).toLowerCase();
    const tipologia = findVal(row, ['Seleccione el tipo de producto', 'Tipología de producto']);
    
    // Try to match by title or recipient name
    const matchedCerts = certs.filter(c => {
      const recip = (c.recipient_name || '').toLowerCase();
      const titleRef = (c.title_reference || '').toLowerCase();
      const nameWords = nombre.toLowerCase().split(' ').filter(w => w.length > 3);
      
      // Match by book title
      if (tituloLibro && titleRef) {
        const titleWords = tituloLibro.split(' ').filter(w => w.length > 3);
        const titleMatches = titleWords.filter(w => titleRef.includes(w)).length;
        if (titleMatches >= 3) return true;
      }
      
      // Match by chapter title  
      if (tituloCapitulo && titleRef) {
        const capWords = tituloCapitulo.split(' ').filter(w => w.length > 3);
        const capMatches = capWords.filter(w => titleRef.includes(w)).length;
        if (capMatches >= 2) return true;
      }
      
      // Match by name in recipient
      const nameMatches = nameWords.filter(w => recip.includes(w)).length;
      if (nameMatches >= 2) return true;

      return false;
    });

    if (matchedCerts.length > 0) {
      matched.push({ formIdx: i + 1, nombre, correo, tipologia, matchedCerts });
      console.log(`\n✅ Forms #${i + 1}: ${nombre} (${correo})`);
      console.log(`   Tipología: ${tipologia}`);
      matchedCerts.forEach(mc => {
        const reqStatus = mc.requester_name ? '(YA TIENE REQ)' : '(SIN REQ)';
        console.log(`   → Cert #${mc.consecutive_number} | ${mc.status} | ${reqStatus} | ${(mc.title_reference || '').substring(0, 60)}`);
      });
    } else {
      unmatched.push({ formIdx: i + 1, nombre, correo, tipologia, tituloLibro, tituloCapitulo, excelRow: row._idx });
      console.log(`\n❌ Forms #${i + 1}: ${nombre} (${correo})`);
      console.log(`   Tipología: ${tipologia}`);
      console.log(`   Libro: ${tituloLibro.substring(0, 70)}`);
      console.log(`   Capítulo: ${tituloCapitulo.substring(0, 70)}`);
      console.log(`   → SIN CERTIFICADO GENERADO`);
    }
  });

  console.log('\n\n' + '='.repeat(80));
  console.log(`RESUMEN: ${matched.length} con certificado | ${unmatched.length} sin certificado`);
  console.log('='.repeat(80));
}

matchWithCerts();
