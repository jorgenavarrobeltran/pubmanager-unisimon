/**
 * Certificate template mapping and configuration.
 * Maps each certificate category + subtype to its corresponding .docx template
 * and required form fields according to Minciencias 2024 Measurement Model.
 */

export type CertificateCategory = 
  | 'aval' 
  | 'creditos' 
  | 'evaluacion'
  | 'erl'
  | 'no_especializada'
  | 'formacion'
  | 'manual_guia'
  | 'boletin'
  | 'certificado_editorial' 
  | 'declaracion';

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
  // ==========================================
  // PRODUCTO 1: LIBRO RESULTADO DE INVESTIGACIÓN
  // ==========================================
  {
    id: 'aval-libro',
    category: 'aval',
    label: '1. Validación Tipología — Libro de Investigación (Sello propio)',
    description: 'Certificado 1: Valida que la obra cumple los criterios como "Libro resultado de Investigación" (Minciencias Anexo 1)',
    templateFile: 'Aval-Libro.docx',
    fields: [...commonBookFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-libro-extranjera',
    category: 'aval',
    label: '1. Validación Tipología — Libro de Investigación (Ed. extranjera)',
    description: 'Certificado 1: Validación de libro resultado de investigación publicado en editorial extranjera',
    templateFile: 'Aval-Libro-Editorial extranjera.docx',
    fields: [...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'medio_divulgacion', label: 'Medio de divulgación', type: 'text', required: false, placeholder: 'Enlace o repositorio' },
    ],
  },
  {
    id: 'creditos-libro-usb',
    category: 'creditos',
    label: '1. Créditos y Financiación — Libro (Unisimón)',
    description: 'Certificado 2: Da fe de mención de patrocinadores/financiadores en los créditos del libro institucional',
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
    label: '1. Créditos y Financiación — Libro (Proyecto formal)',
    description: 'Certificado 2: Menciona nombre y código oficial del proyecto de investigación del cual derivó el libro',
    templateFile: 'Créditos-Libro-Proyecto.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'proyecto_nombre', label: 'Nombre del proyecto', type: 'text', required: true, placeholder: 'Nombre del proyecto de investigación' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'evaluacion-pares-libro',
    category: 'evaluacion',
    label: '1. Pares Externos — Libro Completo',
    description: 'Certificación del proceso de evaluación por pares ciegos para un libro resultado de investigación completo',
    templateFile: 'Evaluación por pares-libro.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título completo del libro' },
      { key: 'autores', label: 'Autor(es)', type: 'textarea', required: true, placeholder: 'Nombres completos separados por comas' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'evaluacion-pares-capitulo',
    category: 'evaluacion',
    label: '2. Pares Externos — Capítulo Individual',
    description: 'Certificación del proceso de evaluación por pares ciegos para un capítulo específico en libro de investigación',
    templateFile: 'Evaluación por pares-capitulo.docx',
    fields: [
      chapterField,
      { key: 'autores', label: 'Autor(es) del capítulo', type: 'textarea', required: true, placeholder: 'Nombres completos' },
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'evaluacion-pares-varios-capitulos',
    category: 'evaluacion',
    label: '2. Pares Externos — Libro con Varios Capítulos',
    description: 'Certificación del proceso de evaluación por pares ciegos que detalla todos los capítulos del libro compilatorio',
    templateFile: 'Evaluación por pares-varios-capitulos.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro', type: 'text', required: true, placeholder: 'Título completo del libro' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'editores', label: 'Editores', type: 'textarea', required: false, placeholder: 'Nombres de los editores' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 2: CAPÍTULO EN LIBRO DE INVESTIGACIÓN
  // ==========================================
  {
    id: 'aval-capitulo',
    category: 'aval',
    label: '2. Validación Tipología — Capítulo individual (Sello propio)',
    description: 'Certificado 1: Valida que el capítulo cumple estructura científica autónoma y criterios Minciencias',
    templateFile: 'Aval-Capítulo.docx',
    fields: [chapterField, ...commonBookFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-capitulo-extranjera',
    category: 'aval',
    label: '2. Validación Tipología — Capítulo individual (Ed. extranjera)',
    description: 'Certificado 1: Valida capítulo en libro resultado de investigación publicado en editorial extranjera',
    templateFile: 'Aval-Capítulo-Editorial extranjera.docx',
    fields: [chapterField, ...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'paginas', label: 'Pág. inicial – Pág. final', type: 'text', required: false, placeholder: 'Ej: 15-30' },
      { key: 'medio_divulgacion', label: 'Medio de divulgación', type: 'text', required: false, placeholder: 'Enlace o medio' },
    ],
  },
  {
    id: 'aval-varios-capitulos',
    category: 'aval',
    label: '2. Validación Tipología — Múltiples Capítulos (Compilatorio)',
    description: 'Certificado 1: Valida varios capítulos de una obra compilatoria resultado de investigación',
    templateFile: 'Aval-varioscapitulos.docx',
    fields: [...commonBookFields, { key: 'editores', label: 'Editores', type: 'textarea', required: false, placeholder: 'Nombres de los editores' }, ...editorialFields, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'aval-varios-capitulos-extranjera',
    category: 'aval',
    label: '2. Validación Tipología — Varios Capítulos (Ed. extranjera)',
    description: 'Certificado 1: Valida múltiples capítulos en editorial extranjera',
    templateFile: 'aval-varioscapitulos-editorial extranjera.docx',
    fields: [...commonBookFields, ...editorialFields, { key: 'editores', label: 'Editores', type: 'textarea', required: false, placeholder: 'Nombres de los editores' }, ...publicationDateFields, ...expeditionDateFields],
  },
  {
    id: 'creditos-capitulo-usb',
    category: 'creditos',
    label: '2. Créditos y Financiación — Capítulo (Unisimón)',
    description: 'Certificado 2: Créditos y financiación del capítulo publicado por la Universidad Simón Bolívar',
    templateFile: 'Créditos-Capítulo-Universidad Simón Bolívar.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro contenedor' },
      { key: 'anio_financiacion', label: 'Año de financiación', type: 'text', required: true, placeholder: '2024' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-capitulo-proyecto',
    category: 'creditos',
    label: '2. Créditos y Financiación — Capítulo (Proyecto formal)',
    description: 'Certificado 2: Nombre y código oficial del proyecto de investigación del cual derivó el capítulo',
    templateFile: 'Créditos-Capítulo-Proyecto.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro contenedor' },
      { key: 'proyecto_nombre', label: 'Nombre del proyecto', type: 'text', required: true, placeholder: 'Nombre del proyecto de investigación' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-capitulo-extranjera',
    category: 'creditos',
    label: '2. Créditos y Financiación — Capítulo (Ed. extranjera)',
    description: 'Certificado 2: Créditos de capítulo publicado en editorial extranjera',
    templateFile: 'Créditos-Cap_editorial_extranjera.docx',
    fields: [
      chapterField,
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro contenedor' },
      { key: 'isbn_impreso', label: 'ISBN (impreso)', type: 'text', required: false, placeholder: '978-...' },
      { key: 'isbn_digital', label: 'ISBN (digital)', type: 'text', required: false, placeholder: '978-...' },
      ...expeditionDateFields,
    ],
  },
  {
    id: 'creditos-varios-capitulos-usb',
    category: 'creditos',
    label: '2. Créditos y Financiación — Varios Capítulos (Compilatorio)',
    description: 'Certificado 2: Créditos de múltiples capítulos en un libro compilatorio',
    templateFile: 'Créditos-varioscapitulos-usb.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'anio_financiacion', label: 'Año de financiación', type: 'text', required: true, placeholder: '2024' },
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 3: EDICIÓN DE REVISTAS O LIBROS (ERL)
  // ==========================================
  {
    id: 'erl-revista-libro',
    category: 'erl',
    label: '3. Edición de Revistas o Libros (ERL)',
    description: 'Acredita al investigador como Editor General, Editor Invitado o Compilador de revista científica o libro',
    templateFile: 'Certificado-Edicion-Revista-Libro.docx',
    fields: [
      { key: 'nombre_investigador', label: 'Nombre completo del investigador/a', type: 'text', required: true, placeholder: 'Nombre y apellidos' },
      { key: 'tipo_documento', label: 'Tipo de documento', type: 'select', required: true, options: [
        { value: 'C.C.', label: 'Cédula de Ciudadanía (C.C.)' },
        { value: 'C.E.', label: 'Cédula de Extranjería (C.E.)' },
        { value: 'Pasaporte', label: 'Pasaporte' },
      ]},
      { key: 'numero_documento', label: 'Número de documento', type: 'text', required: true, placeholder: 'Ej: 72.002.980' },
      { key: 'rol_editorial', label: 'Rol editorial desempeñado', type: 'select', required: true, options: [
        { value: 'Editor General', label: 'Editor General' },
        { value: 'Editora General', label: 'Editora General' },
        { value: 'Editor Invitado', label: 'Editor Invitado' },
        { value: 'Editora Invitada', label: 'Editora Invitada' },
        { value: 'Compilador', label: 'Compilador' },
        { value: 'Compiladora', label: 'Compiladora' },
      ]},
      { key: 'titulo_publicacion', label: 'Título de la revista científica o libro', type: 'text', required: true, placeholder: 'Nombre de la publicación' },
      { key: 'tipo_codigo', label: 'Tipo de registro', type: 'select', required: true, options: [
        { value: 'ISSN', label: 'ISSN (Revista)' },
        { value: 'ISBN', label: 'ISBN (Libro)' },
      ]},
      { key: 'codigo_issn_isbn', label: 'Código ISSN o ISBN', type: 'text', required: true, placeholder: 'Ej: 0121-7550 / 978-958-...' },
      { key: 'volumen', label: 'Volumen', type: 'text', required: false, placeholder: 'Ej: Vol. 25' },
      { key: 'numero', label: 'Número / Fascículo', type: 'text', required: false, placeholder: 'Ej: No. 2' },
      { key: 'fecha_publicacion', label: 'Fecha / Período de publicación', type: 'text', required: true, placeholder: 'Ej: julio - diciembre de 2024' },
      { key: 'enlace_publicacion', label: 'URL / Soporte en repositorio o plataforma', type: 'text', required: true, placeholder: 'https://revistas.unisimon.edu.co/...' },
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 4: PUBLICACIONES NO ESPECIALIZADAS
  // ==========================================
  {
    id: 'pub-no-especializada',
    category: 'no_especializada',
    label: '4. Publicación No Especializada (Cartilla / Manual / Boletín)',
    description: 'Certificado de alianza estratégica, circulación social y extensión máxima permitida por Minciencias',
    templateFile: 'Certificado-Publicacion-No-Especializada.docx',
    fields: [
      { key: 'entidad_aliada', label: 'Entidad aliada / gestora / financiadora', type: 'text', required: true, placeholder: 'Nombre de la entidad o medio aliado' },
      { key: 'tipo_producto', label: 'Tipo de producto comunicativo', type: 'select', required: true, options: [
        { value: 'Cartilla divulgativa', label: 'Cartilla divulgativa (máx. 25 páginas)' },
        { value: 'Manual no especializado', label: 'Manual no especializado (máx. 20 páginas)' },
        { value: 'Boletín divulgativo', label: 'Boletín divulgativo (máx. 8 páginas)' },
      ]},
      { key: 'titulo_publicacion', label: 'Título de la obra comunicativa', type: 'text', required: true, placeholder: 'Título completo de la obra' },
      { key: 'autores', label: 'Autor(es)/Autora(s)', type: 'textarea', required: true, placeholder: 'Nombres completos de los autores' },
      { key: 'proyecto_nombre', label: 'Proyecto de investigación origen', type: 'text', required: true, placeholder: 'Nombre oficial del proyecto' },
      { key: 'proyecto_codigo', label: 'Código oficial del proyecto', type: 'text', required: true, placeholder: 'Código asignado' },
      { key: 'paginas_totales', label: 'Extensión total (páginas)', type: 'text', required: true, placeholder: 'Ej: 22 páginas' },
      { key: 'publico_objetivo', label: 'Público objetivo no especializado', type: 'text', required: true, placeholder: 'Ej: Productores agropecuarios, líderes comunales' },
      { key: 'ruta_circulacion', label: 'Ruta de circulación', type: 'select', required: true, options: [
        { value: 'nacional', label: 'Nacional' },
        { value: 'regional', label: 'Regional' },
        { value: 'ciudadana y comunitaria', label: 'Ciudadana y comunitaria' },
      ]},
      { key: 'enfoque_diferencial', label: 'Enfoque diferencial aplicado', type: 'select', required: true, options: [
        { value: 'comunidades étnicas e indígenas', label: 'Comunidades étnicas e indígenas' },
        { value: 'género y mujeres', label: 'Género y mujeres' },
        { value: 'población víctima del conflicto', label: 'Población víctima del conflicto' },
        { value: 'infancia, juventud o adulto mayor', label: 'Infancia, juventud o adulto mayor' },
        { value: 'intercultural y territorial', label: 'Intercultural y territorial' },
        { value: 'no aplica', label: 'No aplica' },
      ]},
      { key: 'url_bonga', label: 'URL pública de consulta en Bonga (PDF completo)', type: 'text', required: true, placeholder: 'https://bonga.unisimon.edu.co/handle/...' },
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 5: LIBROS / CAPÍTULOS DE DIVULGACIÓN
  // ==========================================
  {
    id: 'aval-libro-divulgacion',
    category: 'aval',
    label: '5. Validación Tipología — Libro de Divulgación (LIB_DIV)',
    description: 'Certificado de libro de divulgación o compilación de divulgación con depósito en Bonga',
    templateFile: 'Aval_LIB_DIV.docx',
    fields: [
      ...commonBookFields,
      { key: 'url_bonga', label: 'URL pública en repositorio Bonga', type: 'text', required: false, placeholder: 'https://bonga.unisimon.edu.co/handle/...' },
      ...publicationDateFields,
      ...expeditionDateFields
    ],
  },
  {
    id: 'aval-capitulo-divulgacion',
    category: 'aval',
    label: '5. Validación Tipología — Capítulo de Divulgación (CAP_DIV)',
    description: 'Certificado de verificación de capítulo en libro de divulgación científica',
    templateFile: 'AVAL-CAP-DIVULGACION.docx',
    fields: [chapterField, ...commonBookFields, ...editorialFields, ...publicationDateFields, ...expeditionDateFields,
      { key: 'paginas', label: 'Pág. inicial – Pág. final', type: 'text', required: false, placeholder: 'Ej: 15-30' },
      { key: 'url_bonga', label: 'URL pública en Bonga', type: 'text', required: false, placeholder: 'https://bonga.unisimon.edu.co/...' },
    ],
  },
  {
    id: 'aval-varios-capitulos-divulgacion',
    category: 'aval',
    label: '5. Validación Tipología — Varios Capítulos Divulgación (Compilatorio)',
    description: 'Certificado de múltiples capítulos de divulgación en obra compilatoria',
    templateFile: 'Aval-Capítulos_DIV.docx',
    fields: [
      { key: 'libro_titulo', label: 'Título del libro contenedor', type: 'text', required: true, placeholder: 'Título del libro' },
      { key: 'isbn_digital', label: 'ISBN (digital o impreso)', type: 'text', required: false, placeholder: '978-...' },
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 6: LIBROS DE FORMACIÓN (LIB_FOR)
  // ==========================================
  {
    id: 'libro-formacion',
    category: 'formacion',
    label: '6. Libro de Formación (LIB_FOR)',
    description: 'Valida orientación formativo-pedagógica, arbitraje pedagógico y adopción formal curricular',
    templateFile: 'Certificado-Libro-Formacion.docx',
    fields: [
      ...commonBookFields,
      { key: 'editorial', label: 'Sello Editorial', type: 'text', required: true, placeholder: 'Ediciones Universidad Simón Bolívar' },
      { key: 'asignaturas_curriculares', label: 'Asignatura(s) en las que se encuentra incorporado', type: 'text', required: true, placeholder: 'Ej: Metodología de la Investigación, Bioquímica I' },
      { key: 'unidad_academica', label: 'Facultad / Programa Académico', type: 'text', required: true, placeholder: 'Ej: Facultad de Ciencias de la Salud / Medicina' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 7: MANUALES Y GUÍAS ESPECIALIZADAS (MAN_GUI)
  // ==========================================
  {
    id: 'manual-guia-especializada',
    category: 'manual_guia',
    label: '7. Manuales y Guías Especializadas (MAN_GUI)',
    description: 'Certifica manual o guía técnica derivada formalmente de un proyecto de investigación aprobado',
    templateFile: 'Certificado-Manual-Guia-Especializada.docx',
    fields: [
      { key: 'titulo_obra', label: 'Título del manual o guía especializada', type: 'text', required: true, placeholder: 'Título de la obra' },
      { key: 'autores', label: 'Autor(es)/Autora(s)', type: 'textarea', required: true, placeholder: 'Nombres completos' },
      { key: 'proyecto_nombre', label: 'Nombre del proyecto de investigación origen', type: 'text', required: true, placeholder: 'Título del proyecto formal' },
      { key: 'proyecto_codigo', label: 'Código oficial del proyecto', type: 'text', required: true, placeholder: 'Código asignado al proyecto' },
      { key: 'entidad_financiadora', label: 'Entidad financiadora / Patrocinador', type: 'text', required: true, placeholder: 'Universidad Simón Bolívar / Minciencias' },
      { key: 'isbn_deposito', label: 'ISBN o registro de depósito legal', type: 'text', required: true, placeholder: 'ISBN 978-... o No. Depósito Legal' },
      { key: 'editorial', label: 'Editorial', type: 'text', required: true, placeholder: 'Ediciones Universidad Simón Bolívar' },
      ...publicationDateFields,
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // PRODUCTO 8: BOLETINES DIVULGATIVOS (BOL)
  // ==========================================
  {
    id: 'boletin-divulgativo',
    category: 'boletin',
    label: '8. Boletines Divulgativos Institucionales (BOL)',
    description: 'Certifica publicación seriada institucional de carácter divulgativo con periodicidad regular y depósito en Bonga',
    templateFile: 'Certificado-Boletin-Divulgativo.docx',
    fields: [
      { key: 'titulo_boletin', label: 'Título del boletín divulgativo institucional', type: 'text', required: true, placeholder: 'Nombre del boletín seriado' },
      { key: 'identificador_serie', label: 'ISSN o registro institucional de la serie', type: 'text', required: true, placeholder: 'ISSN o código de registro' },
      { key: 'autores', label: 'Equipo editorial / Autor(es)', type: 'textarea', required: true, placeholder: 'Nombres del equipo editorial o autores' },
      { key: 'periodicidad', label: 'Periodicidad regular de distribución', type: 'select', required: true, options: [
        { value: 'mensual', label: 'Mensual' },
        { value: 'trimestral', label: 'Trimestral' },
        { value: 'semestral', label: 'Semestral' },
      ]},
      { key: 'numero', label: 'Número / Edición', type: 'text', required: true, placeholder: 'Ej: Vol. 3, No. 2' },
      { key: 'anio_publicacion', label: 'Año de publicación', type: 'text', required: true, placeholder: '2024' },
      { key: 'url_bonga', label: 'URL pública de acceso en Bonga (PDF completo)', type: 'text', required: true, placeholder: 'https://bonga.unisimon.edu.co/handle/...' },
      ...expeditionDateFields,
    ],
  },

  // ==========================================
  // EDITORIAL EXTRANJERA & DECLARACIONES
  // ==========================================
  {
    id: 'cert-editorial-libro',
    category: 'certificado_editorial',
    label: 'Certificado Ed. Extranjera — Libro',
    description: 'Certificado de libro resultado de investigación para editorial extranjera',
    templateFile: 'Certificado para EDITORIAL EXTRANJERA_libro.docx',
    fields: [
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
  {
    id: 'declaracion-autor',
    category: 'declaracion',
    label: 'Declaración de Autor (Interna)',
    description: 'Declaración jurada de autor sobre evaluación por pares del libro/capítulo',
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
];

// ========================================
// Helper functions
// ========================================

export const CATEGORY_LABELS: Record<CertificateCategory, string> = {
  aval: 'Avales y Tipología',
  creditos: 'Créditos y Financiación',
  evaluacion: 'Evaluación por Pares',
  erl: 'Edición Revistas/Libros (ERL)',
  no_especializada: 'No Especializada (Cartillas/Manuales)',
  formacion: 'Libros de Formación (LIB_FOR)',
  manual_guia: 'Manuales y Guías (MAN_GUI)',
  boletin: 'Boletines Divulgativos (BOL)',
  certificado_editorial: 'Cert. Editorial Extranjera',
  declaracion: 'Declaraciones de Autores',
};

export const CATEGORY_COLORS: Record<CertificateCategory, { bg: string; color: string; icon: string }> = {
  aval: { bg: '#E8F5E9', color: '#2E7D32', icon: '✅' },
  creditos: { bg: '#E3F2FD', color: '#1565C0', icon: '📋' },
  evaluacion: { bg: '#FBE9E7', color: '#BF360C', icon: '🔍' },
  erl: { bg: '#EDE7F6', color: '#512DA8', icon: '📰' },
  no_especializada: { bg: '#FFF8E1', color: '#F57F17', icon: '📑' },
  formacion: { bg: '#E0F2F1', color: '#00796B', icon: '🎓' },
  manual_guia: { bg: '#FCE4EC', color: '#C2185B', icon: '📘' },
  boletin: { bg: '#E1F5FE', color: '#0288D1', icon: '📢' },
  certificado_editorial: { bg: '#FFF3E0', color: '#E65100', icon: '🏛️' },
  declaracion: { bg: '#F3E5F5', color: '#7B1FA2', icon: '✍️' },
};

export function getTemplatesByCategory(category: CertificateCategory): TemplateConfig[] {
  return TEMPLATE_CONFIGS.filter(t => t.category === category);
}

export function getTemplateById(id: string): TemplateConfig | undefined {
  return TEMPLATE_CONFIGS.find(t => t.id === id);
}
