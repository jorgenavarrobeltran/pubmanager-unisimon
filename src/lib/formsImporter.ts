import * as XLSX from 'xlsx';
import { type CertificateCategory } from './certificateTemplateMap';

export interface FormSubmissionRow {
  rowNumber: number;
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  correo: string;
  sede: string;
  facultad: string;
  grupoInvestigacion: string;
  tipologiaRaw: string;
  tipologiaKey: string;
  targetTemplateId: string;
  documentCategory: CertificateCategory;
  formData: Record<string, string>;
  rawRow: Record<string, any>;
}

/**
 * Normalizes question strings from Microsoft Forms exports
 */
function findValue(row: Record<string, any>, matchers: (string | RegExp)[]): string {
  const keys = Object.keys(row);
  for (const matcher of matchers) {
    for (const key of keys) {
      if (typeof matcher === 'string') {
        if (key.toLowerCase().includes(matcher.toLowerCase())) {
          const val = row[key];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      } else if (matcher instanceof RegExp) {
        if (matcher.test(key)) {
          const val = row[key];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }
  }
  return '';
}

/**
 * Maps a single row from Microsoft Forms Excel export into our certificate schema
 */
export function parseFormsRow(row: Record<string, any>, index: number): FormSubmissionRow {
  const tipoDoc = findValue(row, ['Tipo de identificación', 'identificación']);
  const numDoc = findValue(row, ['Número de identificación', 'numero de identificación']);
  const nombres = findValue(row, ['Nombres']);
  const apellidos = findValue(row, ['Apellidos']);
  const correo = findValue(row, ['Correo institucional', 'Correo']);
  const sede = findValue(row, ['Sede']);
  const facultad = findValue(row, ['Facultad']);
  const grupo = findValue(row, ['Grupo de investigación', 'Grupo']);
  
  const nombreCompleto = nombres && apellidos ? `${nombres} ${apellidos}`.trim() : (nombres || apellidos || findValue(row, ['Nombre']) || 'Investigador');

  // Tipología selection (Pregunta 10)
  const tipologiaRaw = findValue(row, [
    'Seleccione el tipo de producto',
    'Tipología de producto',
    'tipo de producto que desea certificar'
  ]);

  const tLower = tipologiaRaw.toLowerCase();
  let tipologiaKey = 'libro_investigacion';
  let targetTemplateId = 'aval-libro';
  let documentCategory: CertificateCategory = 'aval';

  if (tLower.includes('capítulo') && tLower.includes('investigación')) {
    tipologiaKey = 'capitulo_investigacion';
    targetTemplateId = 'aval-capitulo';
    documentCategory = 'aval';
  } else if (tLower.includes('formación')) {
    tipologiaKey = 'libro_formacion';
    targetTemplateId = 'libro-formacion';
    documentCategory = 'formacion';
  } else if (tLower.includes('divulgación')) {
    tipologiaKey = 'divulgacion';
    targetTemplateId = 'aval-libro-divulgacion';
    documentCategory = 'aval';
  } else if (tLower.includes('manuales') || tLower.includes('guías')) {
    tipologiaKey = 'manual_guia';
    targetTemplateId = 'manual-guia-especializada';
    documentCategory = 'manual_guia';
  } else if (tLower.includes('boletines')) {
    tipologiaKey = 'boletin';
    targetTemplateId = 'boletin-divulgativo';
    documentCategory = 'boletin';
  } else if (tLower.includes('no especializadas')) {
    tipologiaKey = 'no_especializada';
    targetTemplateId = 'pub-no-especializada';
    documentCategory = 'no_especializada';
  } else if (tLower.includes('ediciones de revistas')) {
    tipologiaKey = 'erl';
    targetTemplateId = 'erl-revista-libro';
    documentCategory = 'erl';
  }

  const today = new Date();
  const MONTH_NAMES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  // Extract common and specific fields
  const formData: Record<string, string> = {
    // Researcher info
    nombre_investigador: nombreCompleto,
    nombre_autor: nombreCompleto,
    autores: findValue(row, ['Nombre de los autores', 'autores']) || nombreCompleto,
    cedula: numDoc,
    numero_documento: numDoc,
    tipo_documento: tipoDoc || 'C.C.',
    correo: correo,
    facultad: facultad,
    grupo: grupo,
    sede: sede,

    // Book/Work info
    libro_titulo: findValue(row, [
      'Título completo del libro',
      'Título completo del libro contenedor',
      'Título completo de la obra',
      'Título completo del libro o compendio',
      'Título completo del libro de formación'
    ]),
    capitulo_titulo: findValue(row, ['Título específico del capítulo', 'capítulo']),
    titulo_obra: findValue(row, ['Título completo del manual', 'Título de la publicación', 'Título completo de la obra']),
    titulo_publicacion: findValue(row, ['Título de la revista científica', 'Título de la obra comunicativa', 'Título de la publicación']),
    titulo_boletin: findValue(row, ['Título completo del boletín divulgativo']),

    // Identifiers & Publication
    isbn_impreso: findValue(row, ['Código ISBN oficial', 'Código ISBN']),
    isbn_digital: findValue(row, ['Código ISBN oficial del libro contenedor', 'ISBN (digital)']),
    isbn_deposito: findValue(row, ['Código ISBN o número de registro de depósito legal', 'ISBN']),
    codigo_issn_isbn: findValue(row, ['Código ISSN (para revista) o ISBN', 'ISSN']),
    tipo_codigo: findValue(row, ['Código ISSN']) ? 'ISSN' : 'ISBN',
    editorial: findValue(row, ['Indique el sello editorial', 'Sello editorial']) || 'Ediciones Universidad Simón Bolívar',

    // Dates
    mes_publicacion: 'septiembre',
    anio_publicacion: findValue(row, ['año de publicación', 'Año']) || today.getFullYear().toString(),
    dia_expedicion: today.getDate().toString(),
    mes_expedicion: MONTH_NAMES[today.getMonth()],
    anio_expedicion: today.getFullYear().toString(),
    ciudad: 'Barranquilla, Colombia',

    // Pages & Chapters
    paginas: findValue(row, ['Páginas del capítulo']),
    paginas_totales: findValue(row, ['Extensión máxima', 'páginas']),

    // Funding / Project
    proyecto_nombre: findValue(row, [
      'Nombre y código del proyecto de investigación financiado',
      'Proyecto de investigación del cual deriva'
    ]),
    proyecto_codigo: 'PRY-INV-2024',
    entidad_financiadora: findValue(row, ['Entidad financiadora o patrocinadora']) || 'Universidad Simón Bolívar',

    // URLs & Channels
    url_bonga: findValue(row, ['repositorio Bonga', 'URL en repositorio Bonga', 'Enlace web o del repositorio']),
    enlace_publicacion: findValue(row, ['Enlace web de la revista', 'Enlace web o del repositorio']),
  };

  return {
    rowNumber: index + 1,
    nombreCompleto,
    tipoDocumento: tipoDoc,
    numeroDocumento: numDoc,
    correo,
    sede,
    facultad,
    grupoInvestigacion: grupo,
    tipologiaRaw,
    tipologiaKey,
    targetTemplateId,
    documentCategory,
    formData,
    rawRow: row,
  };
}

/**
 * Parses a buffer of an Excel file downloaded from Microsoft Forms
 */
export function parseMicrosoftFormsExcel(buffer: ArrayBuffer | Buffer): FormSubmissionRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

  return rawRows.map((row, index) => parseFormsRow(row, index));
}
