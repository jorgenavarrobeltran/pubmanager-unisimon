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

interface ExportWordOptions {
  title: string;
  reportMarkdown: string;
  period?: string;
  fileName?: string;
}

// Brand color palette (Universidad Simón Bolívar)
const COLORS = {
  PRIMARY: '1B5E20',       // Dark emerald / brand green
  PRIMARY_LIGHT: '2E7D32', // Secondary green
  TEXT_DARK: '1E293B',     // Slate 800
  TEXT_BODY: '334155',     // Slate 700
  TEXT_MUTED: '64748B',    // Slate 500
  BORDER: 'CBD5E1',        // Slate 300
  BORDER_LIGHT: 'E2E8F0',  // Slate 200
  BG_ALT: 'F8FAFC',        // Slate 50
  HEADER_BG: '1B5E20',     // Green header
  HEADER_TEXT: 'FFFFFF',   // White text
};

/**
 * Parse markdown inline formatting (**bold**, *italic*, `code`) into an array of TextRuns.
 */
function parseInline(text: string, baseOptions: Record<string, any> = {}): TextRun[] {
  const runs: TextRun[] = [];
  // Regex matches **bold**, *italic*, `code`, or normal text
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const part = match[0];
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          color: baseOptions.color || COLORS.TEXT_DARK,
          size: baseOptions.size || 22,
          font: 'Calibri',
        })
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          color: baseOptions.color || COLORS.TEXT_BODY,
          size: baseOptions.size || 22,
          font: 'Calibri',
        })
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          font: 'Consolas',
          size: 20,
          color: '0F172A',
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          color: baseOptions.color || COLORS.TEXT_BODY,
          size: baseOptions.size || 22,
          font: 'Calibri',
          ...baseOptions,
        })
      );
    }
  }

  return runs.length > 0
    ? runs
    : [
        new TextRun({
          text,
          color: baseOptions.color || COLORS.TEXT_BODY,
          size: baseOptions.size || 22,
          font: 'Calibri',
          ...baseOptions,
        }),
      ];
}

/**
 * Parse a markdown string into docx elements (Paragraphs, Tables, Headings).
 */
function parseMarkdownToDocx(md: string): (Paragraph | Table)[] {
  const lines = md.split('\n');
  const elements: (Paragraph | Table)[] = [];

  let inTable = false;
  let tableRowsData: string[][] = [];

  const flushTable = () => {
    if (tableRowsData.length === 0) return;

    // Filter out separator lines like | --- | --- |
    const cleanRows = tableRowsData.filter(row => {
      return !row.every(cell => /^[\s\-:]+$/.test(cell));
    });

    if (cleanRows.length === 0) {
      tableRowsData = [];
      inTable = false;
      return;
    }

    const tableRows = cleanRows.map((row, rowIndex) => {
      const isHeader = rowIndex === 0;
      const isAltRow = !isHeader && rowIndex % 2 === 1;

      return new TableRow({
        tableHeader: isHeader,
        children: row.map(cellText => {
          return new TableCell({
            width: {
              size: Math.floor(100 / (row.length || 1)),
              type: WidthType.PERCENTAGE,
            },
            shading: {
              fill: isHeader
                ? COLORS.HEADER_BG
                : isAltRow
                ? COLORS.BG_ALT
                : 'FFFFFF',
              type: ShadingType.CLEAR,
            },
            margins: {
              top: 140,
              bottom: 140,
              left: 180,
              right: 180,
            },
            borders: {
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: isHeader ? COLORS.PRIMARY : COLORS.BORDER_LIGHT,
              },
              bottom: {
                style: BorderStyle.SINGLE,
                size: isHeader ? 8 : 4,
                color: isHeader ? COLORS.PRIMARY : COLORS.BORDER_LIGHT,
              },
              left: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: isHeader ? COLORS.PRIMARY : COLORS.BORDER_LIGHT,
              },
              right: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: isHeader ? COLORS.PRIMARY : COLORS.BORDER_LIGHT,
              },
            },
            children: [
              new Paragraph({
                alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: parseInline(cellText, {
                  bold: isHeader,
                  color: isHeader ? COLORS.HEADER_TEXT : COLORS.TEXT_BODY,
                  size: isHeader ? 20 : 20,
                }),
              }),
            ],
          });
        }),
      });
    });

    elements.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      })
    );

    // Spacing after table
    elements.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [],
      })
    );

    tableRowsData = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Table line
    if (line.startsWith('|') && line.endsWith('|')) {
      inTable = true;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());
      tableRowsData.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Empty line
    if (line === '') {
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 180 },
          children: [
            new TextRun({
              text: line.slice(2),
              bold: true,
              size: 34, // 17pt
              color: COLORS.PRIMARY,
              font: 'Calibri',
            }),
          ],
        })
      );
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 260, after: 140 },
          children: [
            new TextRun({
              text: line.slice(3),
              bold: true,
              size: 28, // 14pt
              color: COLORS.PRIMARY_LIGHT,
              font: 'Calibri',
            }),
          ],
        })
      );
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: line.slice(4),
              bold: true,
              size: 24, // 12pt
              color: COLORS.TEXT_DARK,
              font: 'Calibri',
            }),
          ],
        })
      );
      continue;
    }

    // Heading 4
    if (line.startsWith('#### ')) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({
              text: line.slice(5),
              bold: true,
              size: 22, // 11pt
              color: COLORS.TEXT_MUTED,
              font: 'Calibri',
            }),
          ],
        })
      );
      continue;
    }

    // Horizontal Rule
    if (/^---+$/.test(line)) {
      elements.push(
        new Paragraph({
          spacing: { before: 140, after: 140 },
          border: {
            bottom: {
              color: COLORS.BORDER_LIGHT,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
          children: [],
        })
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { before: 100, after: 100 },
          border: {
            left: {
              color: COLORS.PRIMARY,
              space: 10,
              style: BorderStyle.SINGLE,
              size: 24,
            },
          },
          children: parseInline(line.slice(2), {
            italics: true,
            color: COLORS.TEXT_MUTED,
          }),
        })
      );
      continue;
    }

    // Unordered List (- item, * item, • item)
    if (/^[-*•]\s+/.test(line)) {
      const itemText = line.replace(/^[-*•]\s+/, '');
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 60, line: 260 },
          children: parseInline(itemText),
        })
      );
      continue;
    }

    // Ordered List (1. item)
    if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, '');
      elements.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 40, after: 60, line: 260 },
          children: parseInline(itemText),
        })
      );
      continue;
    }

    // Standard Paragraph
    elements.push(
      new Paragraph({
        spacing: { before: 60, after: 120, line: 276 },
        children: parseInline(line),
      })
    );
  }

  if (inTable) {
    flushTable();
  }

  return elements;
}

/**
 * Generates and downloads a .docx file formatted with Universidad Simón Bolívar standards.
 */
export async function exportReportToWord({
  title,
  reportMarkdown,
  period,
  fileName,
}: ExportWordOptions): Promise<void> {
  const currentDate = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const parsedElements = parseMarkdownToDocx(reportMarkdown);

  const doc = new Document({
    title,
    description: 'Informe generado por PubManager AI - Universidad Simón Bolívar',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
            color: COLORS.TEXT_BODY,
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch (2.54 cm)
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
                children: [
                  new TextRun({
                    text: 'UNIVERSIDAD SIMÓN BOLÍVAR · DIRECCIÓN DE PUBLICACIONES',
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
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: COLORS.BORDER_LIGHT,
                  },
                },
                spacing: { before: 120 },
                children: [
                  new TextRun({
                    text: `PubManager · Generado el ${currentDate} | `,
                    size: 16,
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: 'Página ',
                    size: 16,
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: COLORS.TEXT_MUTED,
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
                    color: COLORS.TEXT_MUTED,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Institutional Banner / Subtitle
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({
                text: 'SISTEMA PUBMANAGER · INFORME EDITORIAL INTELIGENTE',
                size: 18,
                bold: true,
                color: COLORS.PRIMARY_LIGHT,
                font: 'Calibri',
              }),
            ],
          }),

          // Date & period sub-info
          new Paragraph({
            spacing: { after: 240 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 8,
                color: COLORS.PRIMARY,
              },
            },
            children: [
              new TextRun({
                text: `Fecha de emisión: ${currentDate}`,
                size: 18,
                color: COLORS.TEXT_MUTED,
                font: 'Calibri',
              }),
              ...(period
                ? [
                    new TextRun({
                      text: `  |  Período analizado: ${period}`,
                      size: 18,
                      color: COLORS.TEXT_MUTED,
                      font: 'Calibri',
                    }),
                  ]
                : []),
            ],
          }),

          // Parsed markdown content
          ...parsedElements,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanFileName =
    fileName ||
    `${title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-_]/g, '').trim().replace(/\s+/g, '_')}.docx`;

  saveAs(blob, cleanFileName);
}
