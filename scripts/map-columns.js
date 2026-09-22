const XLSX = require('xlsx');

const filePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Pagos APC\\CONTROL PAGOS APC 2020-2026-1.xlsx';
const wb = XLSX.readFile(filePath);

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`\n================ SHEET: ${sheetName} ================`);
  const headers = rows[2] || [];
  headers.forEach((h, idx) => {
    console.log(`  [col ${idx}] ${h}`);
  });
});
