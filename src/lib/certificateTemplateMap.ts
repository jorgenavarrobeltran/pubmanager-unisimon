/**
 * Certificate template mapping and configuration.
 * Maps each certificate category + subtype to its corresponding .docx template
 * and required form fields.
 */

export type CertificateCategory = 
  | 'aval' 
  | 'creditos' 
  | 'certificado_editorial' 
  | 'declaracion' 
  | 'evaluacion';

export type PublicationType = 'libro' | 'capitulo' | 'varios_capitulos';
export type EditorialType = 'sello_propio' | 'editorial_extranjera' | 'divulgacion';
export type CreditSource = 'usb' | 'proyecto' | 'editorial_extranjera';

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface TemplateConfig {
  id: string;
  category: CertificateCategory;
  label: string;
  description: string;
  templateFile: string;
  fields: TemplateField[];
}

// ========================================
// Common fields shared across templates
// ========================================
const commonBookFields: TemplateField[] = [
  { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Ingrese el título completo del libro' },
  { key: 'autores', label: 'Autor(es)/Autora(s)', type: 'textarea', required: true, placeholder: 'Nombres completos separados por comas' },
  { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
  { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
];

const publicationDateFields: TemplateField[] = [
  { key: 'mes_publicacion', label: 'Mes de publicación', type: 'select', required: true, options: monthOptions() },
  { key: 'anio_publicacion', label: 'Año de publicación', type: 'text', required: true, placeholder: '2024' },
];

const expeditionDateFields: TemplateField[] = [
  { key: 'dia_expedicion', label: 'Día de expedición', type: 'text', required: true, placeholder: 'Ej: 15' },
  { key: 'mes_expedicion', label: 'Mes de expedición', type: 'select', required: true, options: monthOptions() },
  { key: 'anio_expedicion', label: 'Año de expedición', type: 'text', required: false, placeholder: '2024' },
];

const chapterField: TemplateField = {
  key: 'capitulo_titulo', label: 'Título del capítulo', type: 'text', required: true, placeholder: 'Ingrese el título del capítulo',
};

const editorialFields: TemplateField[] = [
  { key: 'editorial', label: 'Nombre de la editorial', type: 'text', required: true, placeholder: 'Nombre de la editorial' },
  { key: 'ciudad', label: 'Ciudad de publicación', type: 'text', required: false, placeholder: 'Ciudad' },
];

function monthOptions() {
  return [
    { value: 'enero', label: 'Enero' },
    { value: 'febrero', label: 'Febrero' },
    { value: 'marzo', label: 'Marzo' },
    { value: 'abril', label: 'Abril' },
    { value: 'mayo', label: 'Mayo' },
    { value: 'junio', label: 'Junio' },
    { value: 'julio', label: 'Julio' },
    { value: 'agosto', label: 'Agosto' },
    { value: 'septiembre', label: 'Septiembre' },
    { value: 'octubre', label: 'Octubre' },
    { value: 'noviembre', label: 'Noviembre' },
    { value: 'diciembre', label: 'Diciembre' },
  ];
}

// ========================================
// Template configurations
// ========================================
export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  // ===== AVALES =====
  {
    id: 'aval-libro',
    category: 'aval',
    label: 'Aval — Libro (Sello propio)',
    description: 'Certificado de verificación de libro resultado de investigación publicado por Ediciones USB',
    templateFile: 'Aval-Libro.docx',
    fields: [...commonBookFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-capitulo',
    category: 'aval',
    label: 'Aval — Capítulo (Sello propio)',
    description: 'Certificado de verificación de capítulo en libro resultado de investigación',
    templateFile: 'Aval-Capítulo.docx',
    fields: [chapterField, ...commonBookFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-varios-capitulos',
    category: 'aval',
    label: 'Aval — Varios capítulos (Sello propio)',
    description: 'Certificado de verificación de múltiples capítulos en un libro',
    templateFile: 'Aval-varioscapitulos.docx',
    fields: [...commonBookFields, { key: 'editores', label: 'Editores', type: 'textarea', required: false, placeholder: 'Nombres de los editores (dejar vacío si no aplica)' }, ...editorialFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-libro-extranjera',
    category: 'aval',
    label: 'Aval — Libro (Editorial extranjera)',
    description: 'Certificado de verificación de libro publicado por editorial extranjera',
    templateFile: 'Aval-Libro-Editorial extranjera.docx',
    fields: [...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'medio_divulgacion', label: 'Medio de divulgación', type: 'text', required: false, placeholder: 'Enlace o medio de divulgación' },
    ],
  },
  {
    id: 'aval-capitulo-extranjera',
    category: 'aval',
    label: 'Aval — Capítulo (Editorial extranjera)',
    description: 'Certificado de verificación de capítulo publicado por editorial extranjera',
    templateFile: 'Aval-Capítulo-Editorial extranjera.docx',
    fields: [chapterField, ...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'paginas', label: 'Pág. inicial – Pág. final', type: 'text', required: false, placeholder: 'Ej: 15-30' },
      { key: 'medio_divulgacion', label: 'Medio de divulgación', type: 'text', required: false, placeholder: 'Enlace o medio' },
    ],
  },
  {
    id: 'aval-varios-capitulos-extranjera',
    category: 'aval',
    label: 'Aval — Varios capítulos (Editorial extranjera)',
    description: 'Certificado de verificación de múltiples capítulos en editorial extranjera',
    templateFile: 'aval-varioscapitulos-editorial extranjera.docx',
    fields: [...commonBookFields, ...editorialFields, { key: 'editores', label: 'Editores', type: 'textarea', required: false, placeholder: 'Nombres de los editores' }, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-libro-divulgacion',
    category: 'aval',
    label: 'Aval — Libro de divulgación',
    description: 'Certificado de verificación de libro de divulgación de investigación',
    templateFile: 'Aval_LIB_DIV.docx',
    fields: [...commonBookFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-capitulo-divulgacion',
    category: 'aval',
    label: 'Aval — Capítulo de divulgación',
    description: 'Certificado de verificación de capítulo de divulgación',
    templateFile: 'AVAL-CAP-DIVULGACION.docx',
    fields: [chapterField, ...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'paginas', label: 'Pág. inicial – Pág. final', type: 'text', required: false, placeholder: 'Ej: 15-30' },
      { key: 'medio_divulgacion', label: 'Medio de divulgación', type: 'text', required: false, placeholder: 'Enlace o medio' },
    ],
  },
  {
    id: 'aval-varios-capitulos-divulgacion',
    category: 'aval',
    label: 'Aval — Varios capítulos de divulgación',
    description: 'Certificado de verificación de múltiples capítulos de divulgación',
    templateFile: 'Aval-Capítulos_DIV.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_digital', label: 'ISBN', type: 'text', required: false, placeholder: '978-...' },
      ...expeditionDateFields,
    ],
  },

  // ===== CRÉDITOS =====
  {
    id: 'creditos-libro-usb',
    category: 'creditos',
    label: 'Créditos — Libro (USB)',
    description: 'Certificado de verificación de créditos/financiación del libro por la Universidad Simón Bolívar',
    templateFile: 'Créditos-Libro-Universidad Simón Bolívar.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'anio_financiacion', label: 'Año de financiación', type: 'text', required: true, placeholder: '2024' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-libro-proyecto',
    category: 'creditos',
    label: 'Créditos — Libro (Proyecto)',
    description: 'Certificado de verificación de créditos del libro financiado por proyecto',
    templateFile: 'Créditos-Libro-Proyecto.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'proyecto_nombre', label: 'Nombre del proyecto', type: 'text', required: true, placeholder: 'Nombre del proyecto de investigación' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-capitulo-usb',
    category: 'creditos',
    label: 'Créditos — Capítulo (USB)',
    description: 'Certificado de verificación de créditos del capítulo por USB',
    templateFile: 'Créditos-Capítulo-Universidad Simón Bolívar.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'anio_financiacion', label: 'Año de financiación', type: 'text', required: true, placeholder: '2024' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-capitulo-proyecto',
    category: 'creditos',
    label: 'Créditos — Capítulo (Proyecto)',
    description: 'Certificado de verificación de créditos del capítulo financiado por proyecto',
    templateFile: 'Créditos-Capítulo-Proyecto.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'proyecto_nombre', label: 'Nombre del proyecto', type: 'text', required: true, placeholder: 'Nombre del proyecto' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-capitulo-extranjera',
    category: 'creditos',
    label: 'Créditos — Capítulo (Ed. extranjera)',
    description: 'Certificado de créditos de capítulo en editorial extranjera',
    templateFile: 'Créditos-Cap_editorial_extranjera.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-varios-capitulos-usb',
    category: 'creditos',
    label: 'Créditos — Varios capítulos (USB)',
    description: 'Certificado de créditos de varios capítulos financiados por USB',
    templateFile: 'Créditos-varioscapitulos-usb.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'anio_financiacion', label: 'Año de financiación', type: 'text', required: true, placeholder: '2024' },
      ...expeditionDateFields,
    ],
  },

  // ===== CERTIFICADOS EDITORIAL EXTRANJERA =====
  {
    id: 'cert-editorial-libro',
    category: 'certificado_editorial',
    label: 'Certificado Ed. Extranjera — Libro',
    description: 'Certificado de libro resultado de investigación para editorial extranjera',
    templateFile: 'Certificado para EDITORIAL EXTRANJERA_libro.docx',
    fields: [
      { key: 'institucion', label: 'Institución / Sello editorial', type: 'text', required: true, placeholder: 'Nombre de la institución o sello' },
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'autores', label: 'Autor(es)', type: 'textarea', required: true, placeholder: 'Nombres completos' },
      { key: 'editorial', label: 'Editorial', type: 'text', required: true, placeholder: 'Nombre de la editorial' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'enlace_repositorio', label: 'Enlace/Repositorio', type: 'text', required: false, placeholder: 'https://...' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'cert-editorial-capitulo',
    category: 'certificado_editorial',
    label: 'Certificado Ed. Extranjera — Capítulo',
    description: 'Certificado de capítulo en libro resultado de investigación para editorial extranjera',
    templateFile: 'Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx',
    fields: [
      { key: 'institucion', label: 'Institución / Sello editorial', type: 'text', required: true, placeholder: 'Nombre de la institución o sello' },
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'autores', label: 'Autor(es)', type: 'textarea', required: true, placeholder: 'Nombres completos' },
      { key: 'editorial', label: 'Editorial', type: 'text', required: true, placeholder: 'Nombre de la editorial' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'enlace_repositorio', label: 'Enlace/Repositorio', type: 'text', required: false, placeholder: 'https://...' },
      ...expeditionDateFields,
    ],
  },

  // ===== DECLARACIONES =====
  {
    id: 'declaracion-autor',
    category: 'declaracion',
    label: 'Declaración de Autor (Interna)',
    description: 'Declaración jurada de evaluación por pares del libro/capítulo',
    templateFile: 'Declaración de autores.docx',
    fields: [
      { key: 'nombre_autor', label: 'Nombre completo del autor', type: 'text', required: true, placeholder: 'Nombre completo' },
      { key: 'nacionalidad', label: 'Nacionalidad', type: 'text', required: true, placeholder: 'Colombiana' },
      { key: 'cedula', label: 'Cédula de ciudadanía', type: 'text', required: true, placeholder: 'Número de cédula' },
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_impreso', label: 'ISBN', type: 'text', required: false, placeholder: '978-...' },
      { key: 'editorial', label: 'Editorial', type: 'text', required: true, placeholder: 'Nombre de la editorial' },
      { key: 'ciudad', label: 'Lugar', type: 'text', required: true, placeholder: 'Ciudad' },
      { key: 'telefono', label: 'Teléfono', type: 'text', required: false, placeholder: 'Número de contacto' },
      { key: 'correo', label: 'Correo electrónico', type: 'text', required: false, placeholder: 'email@ejemplo.com' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'declaracion-autor-externa',
    category: 'declaracion',
    label: 'Declaración de Autor (Ed. Externa)',
    description: 'Declaración jurada para publicación en editorial externa',
    templateFile: 'Declaración de autor editorial externa.docx',
    fields: [
      { key: 'nombre_autor', label: 'Nombre completo del autor', type: 'text', required: true, placeholder: 'Nombre completo' },
      { key: 'nacionalidad', label: 'Nacionalidad', type: 'text', required: true, placeholder: 'Colombiana' },
      { key: 'cedula', label: 'Cédula de ciudadanía', type: 'text', required: true, placeholder: 'Número de cédula' },
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'editorial', label: 'Editorial', type: 'text', required: true, placeholder: 'Nombre de la editorial' },
      { key: 'ciudad', label: 'Lugar', type: 'text', required: true, placeholder: 'Ciudad' },
      { key: 'telefono', label: 'Teléfono', type: 'text', required: false, placeholder: 'Número de contacto' },
      { key: 'correo', label: 'Correo electrónico', type: 'text', required: false, placeholder: 'email@ejemplo.com' },
      ...expeditionDateFields,
    ],
  },

  // ===== EVALUACIÓN POR PARES =====
  {
    id: 'evaluacion-pares',
    category: 'evaluacion',
    label: 'Evaluación por Pares',
    description: 'Certificado de evaluación por pares para libro o capítulo resultado de investigación',
    templateFile: 'Evaluación por pares-jefa de publicaciones.docx',
    fields: [
      chapterField,
      { key: 'autores', label: 'Autor(es)', type: 'textarea', required: true, placeholder: 'Nombres completos' },
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
];

// ========================================
// Helper functions
// ========================================

export const CATEGORY_LABELS: Record<CertificateCategory, string> = {
  aval: 'Aval',
  creditos: 'Créditos',
  certificado_editorial: 'Certificado Editorial Ext.',
  declaracion: 'Declaración de Autor',
  evaluacion: 'Evaluación por Pares',
};

export const CATEGORY_COLORS: Record<CertificateCategory, { bg: string; color: string; icon: string }> = {
  aval: { bg: '#E8F5E9', color: '#2E7D32', icon: '✅' },
  creditos: { bg: '#E3F2FD', color: '#1565C0', icon: '📋' },
  certificado_editorial: { bg: '#FFF3E0', color: '#E65100', icon: '🏛️' },
  declaracion: { bg: '#F3E5F5', color: '#7B1FA2', icon: '✍️' },
  evaluacion: { bg: '#FBE9E7', color: '#BF360C', icon: '🔍' },
};

export function getTemplatesByCategory(category: CertificateCategory): TemplateConfig[] {
  return TEMPLATE_CONFIGS.filter(t => t.category === category);
}

export function getTemplateById(id: string): TemplateConfig | undefined {
  return TEMPLATE_CONFIGS.find(t => t.id === id);
}
