import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { APCPaymentExport, APCBudgetExport } from './apcWordGenerator';
import scopusBenchmarkData from './scopus-benchmark.json';

export interface APCExcelExportOptions {
  yearFilter: string;
  budgetInfo?: APCBudgetExport;
  stats: {
    totalArticles: number;
    totalCOP: number;
    q1Count: number;
    q2Count: number;
    q3Count: number;
    q4Count: number;
    scCount: number;
    highImpactPct: number;
    avgCostCOP: number;
  };
  scopusBenchmark?: {
    totalScopus: number;
    apcCount: number;
    pct: number;
    yearlyScopusComparison?: Array<{
      year: string;
      scopusTotal: number;
      apcTotal: number;
      coveragePct: number;
    }>;
  };
  payments: any[];
}

export function exportAPCToExcel(options: APCExcelExportOptions) {
  const { yearFilter, budgetInfo, stats, payments, scopusBenchmark } = options;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen y Bolsa
  const summaryRows = [
    ['UNIVERSIDAD SIMÓN BOLÍVAR - DEPARTAMENTO DE PUBLICACIONES'],
    ['INFORME DE CONTROL DE PAGOS APC Y BOLSA PRESUPUESTAL'],
    ['Líder del Módulo:', 'Fernando Alberto Peñaranda (Coordinador de Proyectos - fernando.penaranda@unisimon.edu.co)'],
    ['Periodo:', yearFilter === 'all' ? '2020 - 2026' : yearFilter],
    ['Fecha de Generación:', new Date().toLocaleString('es-CO')],
    [],
    ['1. ESTADO DE LA BOLSA DE PRESUPUESTO ANUAL'],
    ['Presupuesto Asignado (COP):', budgetInfo ? budgetInfo.allocated_budget : 'N/A'],
    ['Total Ejecutado (COP):', budgetInfo ? budgetInfo.executed_budget : stats.totalCOP],
    ['Saldo Remanente (COP):', budgetInfo ? budgetInfo.remaining_budget : 'N/A'],
    ['% de Ejecución Presupuestal:', budgetInfo ? `${budgetInfo.execution_pct}%` : 'N/A'],
    [],
    ['2. INDICADORES CLAVE DE IMPACTO CIENTÍFICO'],
    ['Total Artículos Apoyados:', stats.totalArticles],
    ['Inversión Total en Pesos (COP):', stats.totalCOP],
    ['Artículos en Q1 (Scopus / WoS):', stats.q1Count],
    ['Artículos en Q2 (Scopus / WoS):', stats.q2Count],
    ['Artículos en Q3 (Scopus / WoS):', stats.q3Count],
    ['Artículos en Q4 (Scopus / WoS):', stats.q4Count],
    ['Artículos Sin Clasificar (S/C):', stats.scCount],
    ['% de Alto Impacto (Q1 + Q2):', `${stats.highImpactPct}%`],
    ['Costo Promedio por Artículo Liquidado (COP):', stats.avgCostCOP],
    [],
    ['3. COBERTURA Y APALANCAMIENTO EN LA PRODUCCIÓN TOTAL SCOPUS'],
    ['Producción Scopus Evaluada (Artículos + Revisiones):', scopusBenchmark ? scopusBenchmark.totalScopus : (scopusBenchmarkData as any).totalScopus2020_2026],
    ['Artículos con Apoyo Financiero APC:', scopusBenchmark ? scopusBenchmark.apcCount : stats.totalArticles],
    ['% de Publicaciones Scopus Subsidiadas con Fondo APC:', scopusBenchmark ? `${scopusBenchmark.pct}%` : '26.7%'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

  // Sheet 2: Pagos Detallados
  const detailRows = payments.map((p, idx) => ({
    'Año': p.year,
    'Consecutivo': p.consecutive || idx + 1,
    'Investigador y Equipo': p.investigador,
    'Cédula / ID': p.cedula || '',
    'Fecha Autorización': p.fecha_autorizacion || '',
    'Autorizado Por': p.autorizado_por || '',
    'Título del Artículo': p.articulo,
    'Revista': p.revista,
    'ISSN': p.issn || '',
    'Beneficiario / Editorial': p.beneficiario || '',
    'Valor Factura (Divisa)': p.valor_factura_divisa || '',
    'Moneda': p.moneda || '',
    'Monto Divisa': p.monto_divisa || '',
    'Consecutivo Factura': p.consecutivo_factura || '',
    'Código Interno': p.codigo_interno || '',
    'Orden de Compra': p.orden_compra || '',
    'Fecha Pago': p.fecha_pago || '',
    'Cuartil': p.cuartil || 'S/C',
    'Estado Solicitud': p.estado_solicitud || 'ATENDIDA',
    'Estado Final': p.estado_final || 'PAGADA',
    'Valor Pagado en Pesos (COP)': p.valor_pagado_pesos || 0,
    'Valor Retenido Pesos (COP)': p.valor_retenido_pesos || 0,
    'País Origen Cuenta': p.pais_origen || '',
    'Link / DOI Publicación': p.link_publicacion || '',
    'Programa Académico': p.programa_academico || '',
    'Facultad': p.facultad || '',
    'Centro de Investigación': p.centro_investigacion || '',
    'Autor Correspondencia UNISIMON': p.autor_correspondencia || '',
    'Afiliación Institucional': p.afiliacion_institucional || '',
    'Grupo de Investigación': p.grupo_investigacion || '',
    'Vinculado al Grupo': p.vinculado_grupo || '',
    'Observaciones': p.observaciones || '',
  }));

  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'Pagos APC');

  // Sheet 3: Benchmark Scopus
  const scopusTotals = (scopusBenchmarkData as any).yearlyScopusTotals as Record<string, number>;
  const benchmarkRows = [
    ['BENCHMARK OFICIAL DE PRODUCCIÓN CIENTÍFICA SCOPUS VS APOYOS APC UNISIMÓN'],
    ['Fuente:', (scopusBenchmarkData as any).source],
    ['Instituciones:', (scopusBenchmarkData as any).institutions.join(' / ')],
    ['Tipos de Documento:', (scopusBenchmarkData as any).documentTypes.join(', ')],
    ['Ecuación Scopus:', (scopusBenchmarkData as any).query],
    [],
    ['Año', 'Producción Total Scopus (Artículos + Revisiones)', 'Artículos con Apoyo Financiero APC', '% Subsidiado con Pago APC', 'Notas Estratégicas'],
    ...[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => {
      const sTotal = scopusTotals[y.toString()] || 0;
      const aTotal = payments.filter(p => p.year === y).length;
      const pct = sTotal > 0 ? parseFloat(((aTotal / sTotal) * 100).toFixed(1)) : 0;
      let nota = '';
      if (y === 2022) nota = 'Pico histórico de apalancamiento institucional (37.9%)';
      else if (y === 2025) nota = 'Un tercio exacto de toda la producción Scopus (33.3%)';
      else if (y === 2026) nota = 'Vigencia actual en curso 2026-1 (24.5%)';
      return [y, sTotal, aTotal, `${pct}%`, nota];
    }),
    [],
    ['TOTAL CONSOLIDADO 2020-2026', (scopusBenchmarkData as any).totalScopus2020_2026, 373, '26.7%', '1 de cada 4 papers Scopus Unisimón financiado por Fondo APC'],
  ];
  const wsBenchmark = XLSX.utils.aoa_to_sheet(benchmarkRows);
  XLSX.utils.book_append_sheet(wb, wsBenchmark, 'Benchmark Scopus');

  // Generate buffer and save
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const fileName = `Control_Pagos_APC_${yearFilter === 'all' ? '2020-2026' : yearFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
}
