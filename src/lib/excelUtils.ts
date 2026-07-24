import * as XLSX from 'xlsx';

export interface FinanceExportData {
  year: number;
  costs: any[];
  services: any[];
  sales: any[];
}

/**
 * Convierte un número de serie de fecha de Excel o string a formato YYYY-MM-DD
 */
export function parseExcelDate(val: any, defaultYear: number): string {
  if (!val) return `${defaultYear}-01-01`;
  
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const y = dateObj.y || defaultYear;
      const m = String(dateObj.m).padStart(2, '0');
      const d = String(dateObj.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(val).trim();
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;

  // Intenta parsear fechas en formato DD/MM/YYYY o DD-MM-YYYY
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    if (parseInt(year) < 2000 || parseInt(year) > 2099) year = String(defaultYear);
    return `${year}-${month}-${day}`;
  }

  return `${defaultYear}-01-01`;
}

/**
 * Convierte cualquier valor a un número limpio para montos financieros
 */
export function parseExcelAmount(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return Math.abs(val);
  const str = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Exporta los datos financieros del año al formato oficial Excel de la Universidad Simón Bolívar
 */
export function exportFinancesToExcel(data: FinanceExportData) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja: Gastos generales
  const gastosHeaders = [
    'Cantidad Solicitada', 'Unidad', 'Centro de Costo', 'Área de negocio',
    'Proyecto', 'Destino del Gasto', 'Descripción ', 'Valor',
    'Aprobación (Jefe de dependencia o Programa)', 'Fuente de financiación', 'Orden de compra '
  ];

  const gastosRows = data.costs.map(c => [
    1,
    'Unidad',
    340201008,
    999999999,
    999999999,
    'Acádemico',
    c.description || c.cost_type || 'Gasto de producción',
    c.amount || 0,
    c.approver || 'Jorge Navarro',
    c.funding_source || 'Interna (Departamento de publicaciones)',
    c.invoice_number ? `Orden No. ${c.invoice_number}` : 'N/A'
  ]);

  const wsGastos = XLSX.utils.aoa_to_sheet([gastosHeaders, ...gastosRows]);
  wsGastos['!cols'] = [
    { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 16 }, { wch: 45 }, { wch: 15 },
    { wch: 30 }, { wch: 38 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos generales');

  // 2. Hoja: Ingresos
  const ingresosHeaders = [
    'Fecha', 'Tipo de solicitud ', 'Descripción ',
    'Entidad de donde proviene el ingreso', 'Valor ', 'Factura ', 'Fecha de pago'
  ];

  const serviciosRows = data.services.map(s => [
    s.date || `${data.year}-01-01`,
    s.service_type ? `Servicio: ${s.service_type}` : 'Servicio editorial',
    s.description || `Servicio editorial para ${s.client_name}`,
    s.client_name || 'Cliente externo',
    s.amount || 0,
    s.invoice_number || 'Pendiente',
    s.status === 'pagado' ? 'Pagado' : 'Pendiente pago'
  ]);

  const ventasRows = data.sales.map(sl => [
    sl.date || `${data.year}-01-01`,
    'Venta de libros',
    `Venta de libro: ${(sl.books as any)?.title || 'Título N/A'} (${sl.quantity || 1} ej. a ${sl.unit_price || 0})`,
    sl.buyer || sl.channel || 'ASEUC / Venta directa',
    sl.total_amount || 0,
    sl.invoice_number || 'N/A',
    'Completado'
  ]);

  const wsIngresos = XLSX.utils.aoa_to_sheet([ingresosHeaders, ...serviciosRows, ...ventasRows]);
  wsIngresos['!cols'] = [
    { wch: 14 }, { wch: 25 }, { wch: 45 },
    { wch: 38 }, { wch: 15 }, { wch: 18 }, { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsIngresos, 'Ingresos');

  // 3. Hoja: Financiamiento
  const financiamientoHeaders = [
    'Descripción ', 'Valor', 'Fuente financiamiento', 'Entidad financiadora '
  ];

  const financiamientoRows = data.services
    .filter(s => (s.amount || 0) >= 1000000)
    .map(s => [
      s.description || `Convenio / Servicio con ${s.client_name}`,
      s.amount || 0,
      'Externa',
      s.client_name
    ]);

  const wsFinanciamiento = XLSX.utils.aoa_to_sheet([financiamientoHeaders, ...financiamientoRows]);
  wsFinanciamiento['!cols'] = [
    { wch: 50 }, { wch: 15 }, { wch: 22 }, { wch: 38 }
  ];
  XLSX.utils.book_append_sheet(wb, wsFinanciamiento, 'Financiamiento');

  // Guardar archivo
  const fileName = `SEGUMIENTO A GASTOS GENERALES E INGRESOS DPTO PUBLICACIONES ${data.year}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export interface ParsedExcelResult {
  gastos: Array<{
    description: string;
    amount: number;
    approver?: string;
    invoice_number?: string;
    cost_type: string;
  }>;
  ingresos: Array<{
    date: string;
    request_type: string;
    description: string;
    client_name: string;
    amount: number;
    invoice_number?: string;
    status: string;
  }>;
  financiamiento: Array<{
    description: string;
    amount: number;
    funding_source: string;
    funding_entity: string;
  }>;
}

/**
 * Lee y parsea un archivo Excel (.xlsx) oficial del Departamento de Publicaciones
 */
export async function parseFinancesExcel(file: File, defaultYear: number): Promise<ParsedExcelResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });

  const result: ParsedExcelResult = {
    gastos: [],
    ingresos: [],
    financiamiento: [],
  };

  // 1. Parsea Hoja "Gastos generales"
  const gastosSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('gasto'));
  if (gastosSheetName) {
    const ws = wb.Sheets[gastosSheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    // Fila 0 suele ser el header
    data.slice(1).forEach(row => {
      if (!row || row.length === 0) return;
      const desc = String(row[6] || row[5] || '').trim();
      const val = parseExcelAmount(row[7]);
      if (!desc || val === 0) return;

      let costType = 'otro';
      const descLower = desc.toLowerCase();
      if (descLower.includes('imprent') || descLower.includes('impresion') || descLower.includes('ejemplar')) costType = 'imprenta';
      else if (descLower.includes('isbn')) costType = 'isbn';
      else if (descLower.includes('crossref') || descLower.includes('doi')) costType = 'doi';
      else if (descLower.includes('aseuc') || descLower.includes('sostenimiento')) costType = 'otro';
      else if (descLower.includes('ojs') || descLower.includes('hosting')) costType = 'hosting_ojs';
      else if (descLower.includes('diseno') || descLower.includes('diagramacion')) costType = 'diseno';
      else if (descLower.includes('correccion')) costType = 'correccion';

      const approver = String(row[8] || '').trim();
      const invoice = String(row[10] || '').trim();

      result.gastos.push({
        description: desc,
        amount: val,
        approver: approver || undefined,
        invoice_number: invoice || undefined,
        cost_type: costType,
      });
    });
  }

  // 2. Parsea Hoja "Ingresos" o "Hoja1"
  const ingresosSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('ingreso') || n.toLowerCase() === 'hoja1');
  if (ingresosSheetName) {
    const ws = wb.Sheets[ingresosSheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    data.slice(1).forEach(row => {
      if (!row || row.length === 0) return;
      const rawDate = row[0];
      const reqType = String(row[1] || '').trim();
      const desc = String(row[2] || '').trim();
      const client = String(row[3] || 'Cliente externo').trim();
      const val = parseExcelAmount(row[4]);
      const invoice = String(row[5] || '').trim();
      const paymentDate = String(row[6] || '').trim();

      if (val === 0 && !desc) return;

      const parsedDate = parseExcelDate(rawDate, defaultYear);
      const isPaid = paymentDate.toLowerCase().includes('pag') || paymentDate.includes('/') || paymentDate.includes('-');

      result.ingresos.push({
        date: parsedDate,
        request_type: reqType || 'Servicio Editorial',
        description: desc || reqType,
        client_name: client,
        amount: val,
        invoice_number: invoice || undefined,
        status: isPaid ? 'pagado' : 'facturado',
      });
    });
  }

  // 3. Parsea Hoja "Financiamiento"
  const finSheetName = wb.SheetNames.find(n => n.toLowerCase().includes('financ'));
  if (finSheetName) {
    const ws = wb.Sheets[finSheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    data.slice(1).forEach(row => {
      if (!row || row.length === 0) return;
      const desc = String(row[0] || '').trim();
      const val = parseExcelAmount(row[1]);
      const source = String(row[2] || 'Externa').trim();
      const entity = String(row[3] || '').trim();

      if (!desc && val === 0) return;

      result.financiamiento.push({
        description: desc,
        amount: val,
        funding_source: source,
        funding_entity: entity,
      });
    });
  }

  return result;
}
