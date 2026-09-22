import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';

import scopusBenchmarkData from './scopus-benchmark.json';

export interface APCPaymentExport {
  year: number;
  consecutive?: number;
  investigador: string;
  articulo: string;
  revista: string;
  cuartil?: string | null;
  beneficiario?: string | null;
  valor_factura_divisa?: string | null;
  valor_pagado_pesos: number;
  estado_final?: string | null;
  facultad?: string | null;
}

export interface APCBudgetExport {
  year: number;
  allocated_budget: number;
  executed_budget: number;
  remaining_budget: number;
  execution_pct: number;
}

export interface APCExportOptions {
  yearFilter: string; // "all" or specific year
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
  payments: APCPaymentExport[];
}

const COLORS = {
  PRIMARY: '09843B',       // Unisimon Green
  PRIMARY_DARK: '065F27',
  PRIMARY_LIGHT: 'E8F5E9',
  SECONDARY: '00838F',     // Cyan/Teal (Coord Proyectos)
  TEXT_DARK: '1E293B',
  TEXT_MUTED: '64748B',
  BORDER: 'CBD5E1',
  BG_ALT: 'F8FAFC',
  WHITE: 'FFFFFF',
};

export async function generateAPCWordReport(options: APCExportOptions) {
  const { yearFilter, budgetInfo, stats, payments } = options;

  const titlePeriod = yearFilter === 'all' ? 'Consolidado Histórico 2020 - 2026' : `Vigencia Fiscal ${yearFilter}`;

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'UNIVERSIDAD SIMÓN BOLÍVAR  |  Dto. de Publicaciones  |  Control Pagos APC',
                    size: 16,
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Página ',
                    size: 16,
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    bold: true,
                    color: COLORS.PRIMARY,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    bold: true,
                    color: COLORS.PRIMARY,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Institutional Banner / Title
          new Paragraph({
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'UNIVERSIDAD SIMÓN BOLÍVAR',
                size: 28,
                bold: true,
                color: COLORS.PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 150 },
            children: [
              new TextRun({
                text: 'INFORME EJECUTIVO DE APOYOS A PUBLICACIONES CIENTÍFICAS (PAGOS APC)',
                size: 24,
                bold: true,
                color: COLORS.TEXT_DARK,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 300 },
            children: [
              new TextRun({
                text: `Periodo Evaluado: ${titlePeriod}   •   Fecha de Emisión: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                size: 18,
                italics: true,
                color: COLORS.TEXT_MUTED,
                font: 'Calibri',
              }),
            ],
          }),

          // Metadata Leader Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { type: ShadingType.CLEAR, fill: 'F1F8F5' },
                    borders: {
                      left: { style: BorderStyle.SINGLE, size: 24, color: COLORS.PRIMARY },
                      top: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                    },
                    margins: { top: 150, bottom: 150, left: 200, right: 200 },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: 'Líder del Módulo / Coordinador: ', bold: true, size: 19, color: COLORS.TEXT_DARK, font: 'Calibri' }),
                          new TextRun({ text: 'Fernando Alberto Peñaranda ', bold: true, size: 19, color: COLORS.SECONDARY, font: 'Calibri' }),
                          new TextRun({ text: '(fernando.penaranda@unisimon.edu.co)', size: 18, color: COLORS.TEXT_MUTED, font: 'Calibri' }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { before: 60 },
                        children: [
                          new TextRun({ text: 'Cargo: ', bold: true, size: 18, color: COLORS.TEXT_DARK, font: 'Calibri' }),
                          new TextRun({ text: 'Coordinador de Proyectos — Departamento de Publicaciones', size: 18, color: COLORS.TEXT_DARK, font: 'Calibri' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Budget Pool Section (if applicable)
          ...(budgetInfo ? [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 150 },
              children: [
                new TextRun({
                  text: '1. Estado de la Bolsa de Presupuesto Anual',
                  bold: true,
                  size: 22,
                  color: COLORS.PRIMARY,
                  font: 'Calibri',
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    createHeaderCell('Presupuesto Asignado (Bolsa)'),
                    createHeaderCell('Total Ejecutado'),
                    createHeaderCell('Saldo Disponible'),
                    createHeaderCell('% Ejecución'),
                  ],
                }),
                new TableRow({
                  children: [
                    createDataCell(`$${budgetInfo.allocated_budget.toLocaleString('es-CO')} COP`, true),
                    createDataCell(`$${budgetInfo.executed_budget.toLocaleString('es-CO')} COP`, true, COLORS.PRIMARY),
                    createDataCell(`$${budgetInfo.remaining_budget.toLocaleString('es-CO')} COP`, true, budgetInfo.remaining_budget < 0 ? 'D32F2F' : '1565C0'),
                    createDataCell(`${budgetInfo.execution_pct}%`, true, budgetInfo.execution_pct > 90 ? 'D32F2F' : COLORS.PRIMARY),
                  ],
                }),
              ],
            }),
          ] : []),

          // Scientific Impact & Key Indicators
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: budgetInfo ? '2. Indicadores Clave de Impacto Científico' : '1. Indicadores Clave de Impacto Científico',
                bold: true,
                size: 22,
                color: COLORS.PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Indicador'),
                  createHeaderCell('Valor Registrado'),
                  createHeaderCell('Observación / Significado'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Total de Artículos Apoyados'),
                  createDataCell(`${stats.totalArticles} artículos`, true),
                  createDataCell('Publicaciones científicas con apoyo financiero del Dto.'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Inversión Total en Pesos'),
                  createDataCell(`$${stats.totalCOP.toLocaleString('es-CO')} COP`, true, COLORS.PRIMARY),
                  createDataCell('Recursos desembolsados para pagos de APC'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Artículos Alto Impacto (Q1 + Q2)'),
                  createDataCell(`${stats.q1Count + stats.q2Count} (${stats.highImpactPct}%)`, true, COLORS.PRIMARY),
                  createDataCell('Prioridad estratégica MinCiencias y Acreditación'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Distribución por Cuartiles'),
                  createDataCell(`Q1: ${stats.q1Count} | Q2: ${stats.q2Count} | Q3: ${stats.q3Count} | Q4: ${stats.q4Count}`, false),
                  createDataCell('Clasificación indexada Scopus / Web of Science'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Costo Promedio por Artículo'),
                  createDataCell(`$${stats.avgCostCOP.toLocaleString('es-CO')} COP`, true),
                  createDataCell('Eficiencia en el gasto por artículo liquidado'),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('% Subsidio en Producción Scopus Unisimón'),
                  createDataCell(
                    options.scopusBenchmark
                      ? `${options.scopusBenchmark.pct}% (${options.scopusBenchmark.apcCount} de ${options.scopusBenchmark.totalScopus} papers)`
                      : `${yearFilter === 'all' ? '26.7%' : ''} (Benchmark Oficial Scopus)`,
                    true,
                    COLORS.PRIMARY
                  ),
                  createDataCell('Artículos y revisiones indexados respaldados por el fondo APC'),
                ],
              }),
            ],
          }),

          // ─── Scopus Benchmark Section ───
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: budgetInfo
                  ? '3. Cobertura y Apalancamiento en la Producción Total Scopus Unisimón'
                  : '2. Cobertura y Apalancamiento en la Producción Total Scopus Unisimón',
                bold: true,
                size: 22,
                color: COLORS.PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 150 },
            children: [
              new TextRun({
                text: 'Comparación frente a la producción científica institucional total indexada en Scopus (Filtro oficial: Universidad Simón Bolívar Barranquilla + Cúcuta, Tipos de Documento: Articles y Reviews, 2020-2026).',
                size: 17,
                color: COLORS.TEXT_MUTED,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Vigencia / Año', 15),
                  createHeaderCell('Producción Scopus (Artículos + Revisiones)', 35),
                  createHeaderCell('Artículos con Apoyo APC', 25),
                  createHeaderCell('% Subsidiado por Fondo APC', 25),
                ],
              }),
              ...[2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => {
                const scopusTotals = (scopusBenchmarkData as any).yearlyScopusTotals as Record<string, number>;
                const sTotal = scopusTotals[y.toString()] || 0;
                const aTotal = payments.filter(p => p.year === y).length;
                const pct = sTotal > 0 ? ((aTotal / sTotal) * 100).toFixed(1) : '0';
                const isSelected = String(y) === yearFilter;
                return new TableRow({
                  children: [
                    createDataCell(String(y), isSelected, isSelected ? COLORS.PRIMARY : undefined, 15),
                    createDataCell(`${sTotal} publicaciones`, false, undefined, 35),
                    createDataCell(`${aTotal} artículos`, isSelected, isSelected ? COLORS.PRIMARY : undefined, 25),
                    createDataCell(`${pct}%`, true, Number(pct) >= 30 ? COLORS.PRIMARY : undefined, 25),
                  ],
                });
              }),
              new TableRow({
                children: [
                  createDataCell('CONSOLIDADO 2020-2026', true, COLORS.PRIMARY, 15),
                  createDataCell('1.395 publicaciones Scopus', true, undefined, 35),
                  createDataCell('373 artículos APC', true, COLORS.PRIMARY, 25),
                  createDataCell('26.7% Subsidiado', true, COLORS.PRIMARY, 25),
                ],
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 100, after: 200 },
            children: [
              new TextRun({
                text: 'Hallazgo Estratégico: ',
                bold: true,
                size: 16,
                color: COLORS.PRIMARY,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'El Departamento de Publicaciones financia de manera directa más de una cuarta parte (26.7%) de toda la producción científica Scopus de la Universidad Simón Bolívar. En 2022 se alcanzó el récord histórico de apalancamiento con el 37.9% de los papers subsidiados, y en 2025 un tercio exacto (33.3%). Para 2026-1, ya se ha cubierto el 24.5% de la producción.',
                size: 16,
                italics: true,
                color: COLORS.TEXT_DARK,
                font: 'Calibri',
              }),
            ],
          }),

          // Detailed List of Articles
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 150 },
            children: [
              new TextRun({
                text: budgetInfo ? '4. Relación Detallada de Artículos Apoyados' : '3. Relación Detallada de Artículos Apoyados',
                bold: true,
                size: 22,
                color: COLORS.PRIMARY,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('#', 5),
                  createHeaderCell('Año', 7),
                  createHeaderCell('Investigador Principal', 23),
                  createHeaderCell('Título del Artículo', 35),
                  createHeaderCell('Revista / Cuartil', 15),
                  createHeaderCell('Valor COP', 15),
                ],
              }),
              ...payments.slice(0, 100).map((p, idx) => (
                new TableRow({
                  children: [
                    createDataCell(String(p.consecutive || idx + 1), false, undefined, 5),
                    createDataCell(String(p.year), false, undefined, 7),
                    createDataCell(p.investigador, true, undefined, 23),
                    createDataCell(p.articulo, false, undefined, 35),
                    createDataCell(`${p.revista} (${p.cuartil || 'S/C'})`, false, undefined, 15),
                    createDataCell(p.valor_pagado_pesos > 0 ? `$${p.valor_pagado_pesos.toLocaleString('es-CO')}` : (p.valor_factura_divisa || 'En trámite'), true, COLORS.PRIMARY, 15),
                  ],
                })
              )),
            ],
          }),
          ...(payments.length > 100 ? [
            new Paragraph({
              spacing: { before: 150 },
              children: [
                new TextRun({
                  text: `* Mostrando los primeros 100 de ${payments.length} artículos en este resumen. El listado completo de los ${payments.length} artículos se encuentra disponible en la exportación a Excel.`,
                  size: 16,
                  italics: true,
                  color: COLORS.TEXT_MUTED,
                  font: 'Calibri',
                }),
              ],
            }),
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `Informe_Pagos_APC_${yearFilter === 'all' ? '2020-2026' : yearFilter}_${new Date().toISOString().split('T')[0]}.docx`;
  saveAs(blob, fileName);
}

function createHeaderCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { type: ShadingType.CLEAR, fill: '09843B' },
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 17,
            color: 'FFFFFF',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function createDataCell(text: string, bold = false, color?: string, widthPct?: number): TableCell {
  return new TableCell({
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold,
            size: 17,
            color: color || '1E293B',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}
