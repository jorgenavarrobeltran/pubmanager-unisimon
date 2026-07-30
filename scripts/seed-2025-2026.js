global.WebSocket = class {};
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const envVars = {};
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) envVars[k.trim()] = v.trim();
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function parseAmount(val) {
  if (!val) return 0;
  if (typeof val === 'number') return Math.abs(val);
  const str = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

function parseExcelDate(val, defaultYear) {
  if (!val) return `${defaultYear}-01-15`;
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const y = dateObj.y || defaultYear;
      const m = String(dateObj.m || 1).padStart(2, '0');
      const d = String(dateObj.d || 15).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(val).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    if (parseInt(year) < 2000 || parseInt(year) > 2099) year = String(defaultYear);
    return `${year}-${month}-${day}`;
  }
  return `${defaultYear}-01-15`;
}

async function runSeed() {
  console.log('🚀 Cargando todos los datos de 2025 y 2026 en Supabase...');

  // Limpiamos los datos anteriores
  await supabase.from('production_costs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('external_services').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  const { data: journals } = await supabase.from('journals').select('id, name');
  const defaultJournalId = journals && journals.length > 0 ? journals[0].id : null;

  const files = [
    {
      year: 2025,
      filePath: path.join(__dirname, '..', 'Ingresos y gastos', 'SEGUMIENTO A GASTOS GENERALES E INGRESOS DPTO PUBLICACIONES 2025 (1).xlsx')
    },
    {
      year: 2026,
      filePath: path.join(__dirname, '..', 'Ingresos y gastos', 'SEGUMIENTO A GASTOS GENERALES E INGRESOS DPTO PUBLICACIONES 2026.xlsx')
    }
  ];

  for (const item of files) {
    console.log(`\n📄 Procesando año ${item.year}...`);
    if (!fs.existsSync(item.filePath)) {
      console.error(`❌ Archivo no encontrado: ${item.filePath}`);
      continue;
    }

    const wb = XLSX.readFile(item.filePath);

    // 1. GASTOS GENERALES -> production_costs
    const gastosSheet = wb.SheetNames.find(n => n.toLowerCase().includes('gasto'));
    if (gastosSheet) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[gastosSheet], { header: 1 });
      const costsToInsert = [];

      rows.slice(1).forEach((row, index) => {
        if (!row || row.length === 0) return;
        const desc = String(row[6] || row[5] || '').trim();
        const amount = parseAmount(row[7]);

        if (!desc || amount === 0) return;

        let costType = 'otro';
        let entityType = 'journal';
        const descLower = desc.toLowerCase();

        if (descLower.includes('imprent') || descLower.includes('impresion') || descLower.includes('ejemplar')) costType = 'imprenta';
        else if (descLower.includes('isbn')) costType = 'isbn';
        else if (descLower.includes('crossref') || descLower.includes('doi')) costType = 'doi';
        else if (descLower.includes('ojs') || descLower.includes('hosting')) costType = 'hosting_ojs';
        else if (descLower.includes('diseno') || descLower.includes('diagramacion')) costType = 'diseno';
        else if (descLower.includes('correccion')) costType = 'correccion';

        const invoice = String(row[10] || '').trim();
        const month = String((index % 12) + 1).padStart(2, '0');
        const costDate = `${item.year}-${month}-15`;

        costsToInsert.push({
          entity_type: entityType,
          entity_id: defaultJournalId,
          cost_type: costType,
          description: desc,
          amount: amount,
          date: costDate,
          invoice_number: invoice || null,
        });
      });

      if (costsToInsert.length > 0) {
        const { data, error } = await supabase.from('production_costs').insert(costsToInsert).select();
        if (error) console.error(`⚠️ Error insertando gastos ${item.year}:`, error.message);
        else console.log(`✅ ${data.length} costos de producción insertados para ${item.year}`);
      }
    }

    // 2. INGRESOS Y VENTA DE LIBROS -> external_services
    const ingresosSheet = wb.SheetNames.find(n => n.toLowerCase().includes('ingreso') || n.toLowerCase() === 'hoja1');
    if (ingresosSheet) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[ingresosSheet], { header: 1 });
      const servicesToInsert = [];

      rows.slice(1).forEach((row) => {
        if (!row || row.length === 0) return;
        const rawDate = row[0];
        const reqType = String(row[1] || '').trim();
        const desc = String(row[2] || '').trim();
        const client = String(row[3] || 'Cliente / ASEUC').trim();
        const amount = parseAmount(row[4]);
        const invoice = String(row[5] || '').trim();
        const paymentDate = String(row[6] || '').trim();

        if (amount === 0 && !desc) return;

        const dateStr = parseExcelDate(rawDate, item.year);
        const isPaid = paymentDate.toLowerCase().includes('pag') || paymentDate.includes('/') || paymentDate.includes('-');

        let sType = 'otro';
        const reqLower = reqType.toLowerCase();
        if (reqLower.includes('diagrama')) sType = 'diagramacion';
        else if (reqLower.includes('forma') || reqLower.includes('capacita')) sType = 'formacion';
        else if (reqLower.includes('asesor')) sType = 'asesoria_editorial';

        servicesToInsert.push({
          service_type: sType,
          client_name: client,
          description: desc || reqType || 'Servicio Editorial / Venta de Libros',
          amount: amount,
          request_date: dateStr,
          invoice_number: invoice || null,
          status: isPaid ? 'pagado' : 'facturado',
        });
      });

      if (servicesToInsert.length > 0) {
        const { data, error } = await supabase.from('external_services').insert(servicesToInsert).select();
        if (error) console.error(`⚠️ Error insertando servicios ${item.year}:`, error.message);
        else console.log(`✅ ${data.length} servicios externos/ingresos insertados para ${item.year}`);
      }
    }

    // 3. FINANCIAMIENTO / CONVENIOS -> external_services
    const finSheet = wb.SheetNames.find(n => n.toLowerCase().includes('financ'));
    if (finSheet) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[finSheet], { header: 1 });
      const conveniosToInsert = [];

      rows.slice(1).forEach((row) => {
        if (!row || row.length === 0) return;
        const desc = String(row[0] || '').trim();
        const amount = parseAmount(row[1]);
        const entity = String(row[3] || 'Entidad Convenio').trim();

        if (!desc && amount === 0) return;

        conveniosToInsert.push({
          service_type: 'asesoria_editorial',
          client_name: entity,
          description: `Convenio / Co-financiación: ${desc}`,
          amount: amount,
          request_date: `${item.year}-06-01`,
          status: 'pagado',
        });
      });

      if (conveniosToInsert.length > 0) {
        const { data, error } = await supabase.from('external_services').insert(conveniosToInsert).select();
        if (error) console.error(`⚠️ Error insertando convenios ${item.year}:`, error.message);
        else console.log(`✅ ${data.length} convenios/financiamientos insertados para ${item.year}`);
      }
    }
  }

  console.log('\n🎉 ¡Todos los registros de 2025 y 2026 han sido cargados con éxito en Supabase!');
}

runSeed().catch(err => console.error('Fatal error:', err));
