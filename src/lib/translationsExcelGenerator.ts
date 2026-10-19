import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface TranslationOrder {
  id: string;
  assignment_number: string;
  provider: string;
  membership_id?: string | null;
  year: number | null;
  fee_usd: number;
  quoted_off_deposit_usd?: number | null;
  charged_to_deposit: boolean;
  confirmed_on: string | null;
  delivered_on: string | null;
  turnaround_days: number | null;
  service: string;
  word_count: number | null;
  status: string;
  inquiry_number?: string | null;
  priority?: string | null;
  requested_by: string | null;
  researcher_email: string | null;
  researcher_team?: string | null;
  manuscript_title?: string | null;
  journal?: string | null;
  quartile?: string | null;
  facultad?: string | null;
  notes?: string | null;
}

export interface TranslationDeposit {
  id: string;
  provider?: string;
  deposit_date: string;
  year: number;
  amount_usd: number;
  withholding_tax_usd: number;
  received_usd: number;
  notes?: string | null;
}

export interface TranslationsExcelOptions {
  yearFilter: string;
  stats: {
    totalOrders: number;
    totalUSD: number;
    totalWords: number;
    avgCostPerWord: number;
    avgTurnaround: number;
  };
  balance: { deposits: number; utilized: number; available: number };
  orders: TranslationOrder[];
  deposits: TranslationDeposit[];
}

export function exportTranslationsToExcel(opts: TranslationsExcelOptions) {
  const { yearFilter, stats, balance, orders, deposits } = opts;
  const wb = XLSX.utils.book_new();

  const summary = [
    ['UNIVERSIDAD SIMÓN BOLÍVAR - DEPARTAMENTO DE PUBLICACIONES'],
    ['INFORME DEL MÓDULO DE TRADUCCIONES Y EDICIÓN CIENTÍFICA — PROVEEDOR ENAGO'],
    ['Líder del Módulo:', 'Fernando Alberto Peñaranda (Coordinador de Proyectos - fernando.penaranda@unisimon.edu.co)'],
    ['Periodo:', yearFilter === 'all' ? 'Histórico completo' : yearFilter],
    ['Fecha de Generación:', new Date().toLocaleString('es-CO')],
    [],
    ['1. ESTADO DEL DEPÓSITO PREPAGADO (USD) — HISTÓRICO'],
    ['Total depositado:', balance.deposits],
    ['Total utilizado:', balance.utilized],
    ['Saldo disponible:', balance.available],
    [],
    ['2. INDICADORES DEL PERIODO'],
    ['Encargos registrados:', stats.totalOrders],
    ['Inversión total (USD):', stats.totalUSD],
    ['Palabras procesadas:', stats.totalWords],
    ['Costo promedio por palabra (USD):', stats.avgCostPerWord],
    ['Tiempo promedio de entrega (días):', stats.avgTurnaround],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  const wsOrders = XLSX.utils.json_to_sheet(orders.map(o => ({
    'N° Asignación': o.assignment_number,
    'Año': o.year,
    'Equipo de investigadores': o.researcher_team || '',
    'Artículo': o.manuscript_title || '',
    'Revista': o.journal || '',
    'Cuartil': o.quartile || '',
    'Facultad': o.facultad || '',
    'Servicio': o.service,
    'Estado': o.status,
    'Confirmado': o.confirmed_on,
    'Entregado': o.delivered_on,
    'Días de entrega': o.turnaround_days,
    'Palabras': o.word_count,
    'Valor (USD)': o.fee_usd,
    'USD / palabra': o.word_count && o.fee_usd ? Number((o.fee_usd / o.word_count).toFixed(4)) : null,
    'Descontado del depósito': o.charged_to_deposit ? 'SÍ' : 'NO',
    'Gestionado por': o.requested_by,
    'Correo investigador': o.researcher_email,
    'N° Inquiry': o.inquiry_number,
    'Prioridad': o.priority,
    'Observaciones': o.notes || '',
  })));
  wsOrders['!cols'] = [12, 6, 30, 50, 34, 8, 34, 22, 12, 12, 12, 10, 10, 12, 12, 12, 24, 36, 18, 10, 50].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Encargos');

  const wsDeposits = XLSX.utils.json_to_sheet(deposits.map(d => ({
    'Fecha': d.deposit_date,
    'Monto (USD)': d.amount_usd,
    'Retención (USD)': d.withholding_tax_usd,
    'Recibido (USD)': d.received_usd,
    'Notas': d.notes || '',
  })));
  wsDeposits['!cols'] = [14, 14, 14, 14, 40].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsDeposits, 'Depósitos');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const suffix = yearFilter === 'all' ? 'Historico' : yearFilter;
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), `Traducciones_ENAGO_${suffix}.xlsx`);
}
