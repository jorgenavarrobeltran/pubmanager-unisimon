const XLSX = require('xlsx');
const fs = require('fs');

const filePath = 'SOLICITUD DE CERTIFICACIÓN Y_O AVAL DE PUBLICACIONES BIBLIOGRÁFICAS(1-216).xlsx';
const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const allRows = XLSX.utils.sheet_to_json(sheet);

// Row 204 (index 203) and Belkys 205 (index 204... wait, let me check)
// The screenshot shows rows 204,205,206,207,208
// Let's check 203 (Aranys) and 204 (Belkys) more carefully
for (const idx of [202, 203, 204]) {
  const row = allRows[idx];
  if (!row) { console.log(`Fila ${idx + 1}: NO EXISTE`); continue; }
  
  console.log(`\n${'='.repeat(100)}`);
  console.log(`FILA ${idx + 1}:`);
  console.log('='.repeat(100));
  
  const keys = Object.keys(row);
  keys.forEach(k => {
    const val = row[k];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      let display = val instanceof Date ? val.toISOString() : String(val);
      if (display.length > 150) display = display.substring(0, 150) + '...';
      console.log(`  ${k.substring(0, 60).padEnd(60)} | ${display}`);
    }
  });
}
