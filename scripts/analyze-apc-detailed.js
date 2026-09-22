const XLSX = require('xlsx');

const filePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Pagos APC\\CONTROL PAGOS APC 2020-2026-1.xlsx';
const wb = XLSX.readFile(filePath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n================ SHEET: ${sheetName} ================`);
  console.log(`Total rows: ${rows.length}`);
  
  // Row 2 is typically headers
  const headers = rows[2] || [];
  console.log('Headers count:', headers.length);
  
  let validRecords = 0;
  let totalPesos = 0;
  
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    // Check if row has a consecutive or investigator or article
    const consec = row[0];
    const inv = row[1];
    const art = row[3] || row[4];
    
    // Ignore footer/summary rows if any
    if (inv && typeof inv === 'string' && (inv.includes('TOTAL') || inv.includes('PRESUPUESTO') || inv.includes('BOLSA'))) {
      console.log(`Summary row ${i}:`, JSON.stringify(row.filter(Boolean)));
      continue;
    }
    
    if (consec || inv || art) {
      validRecords++;
    }
  }
  console.log(`Valid records found: ${validRecords}`);
  
  // Also check if any cell mentions "PRESUPUESTO" or "BOLSA"
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const cellVal = String(row[c] || '');
      if (cellVal.toLowerCase().includes('presupuesto') || cellVal.toLowerCase().includes('bolsa') || cellVal.toLowerCase().includes('saldo') || cellVal.toLowerCase().includes('asignad')) {
        console.log(`Mention at row ${r}, col ${c}: "${cellVal}" -> row:`, JSON.stringify(row.filter(Boolean)));
      }
    }
  }
});
