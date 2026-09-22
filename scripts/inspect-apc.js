const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Pagos APC\\CONTROL PAGOS APC 2020-2026-1.xlsx';
const wb = XLSX.readFile(filePath);

console.log('Sheet names:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n================ SHEET: ${sheetName} ================`);
  console.log(`Total rows in sheet: ${rows.length}`);
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(rows[i]));
  }
});
