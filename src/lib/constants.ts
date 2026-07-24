export const BOOK_STAGES = [
  { key: 'propuesta', label: 'Recepción de Propuesta', icon: '📥', color: '#E3F2FD' },
  { key: 'revision_tecnica', label: 'Revisión Técnica', icon: '🔍', color: '#E3F2FD' },
  { key: 'evaluacion_pares', label: 'Evaluación de Pares', icon: '👥', color: '#FFF3E0' },
  { key: 'cotizacion', label: 'Cotización con Proveedor', icon: '💰', color: '#FFF3E0' },
  { key: 'orden_compra', label: 'Orden de Compra', icon: '📋', color: '#E8F5E9' },
  { key: 'con_proveedor', label: 'Envío al Proveedor', icon: '📦', color: '#E8F5E9' },
  { key: 'correccion_diagramacion', label: 'Corrección y Diagramación', icon: '✏️', color: '#F3E5F5' },
  { key: 'revision_entrega', label: 'Revisión de Entrega', icon: '✅', color: '#F3E5F5' },
  { key: 'isbn_issn', label: 'Asignación ISBN/ISSN/DOI', icon: '🔢', color: '#FFFDE7' },
  { key: 'publicacion', label: 'Publicación e Impresión', icon: '📚', color: '#C8E6C9' },
] as const;

export const BOOK_TYPES = [
  { key: 'libro_completo', label: 'Libro Completo' },
  { key: 'libro_compilatorio', label: 'Libro Compilatorio' },
  { key: 'memorias', label: 'Memorias' },
  { key: 'cartilla_manual', label: 'Cartilla / Manual / Guía' },
] as const;

export const EDITION_TYPES = [
  { key: 'propio', label: 'Sello Propio' },
  { key: 'coedicion', label: 'Coedición' },
  { key: 'participacion_externa', label: 'Participación Externa' },
] as const;

export const BOOK_STATUSES = [
  { key: 'en_proceso', label: 'En Proceso', color: '#1565C0' },
  { key: 'publicado', label: 'Publicado', color: '#2E7D32' },
  { key: 'cancelado', label: 'Cancelado', color: '#D32F2F' },
  { key: 'pausado', label: 'Pausado', color: '#FF8F00' },
  { key: 'isbn_fantasma', label: 'ISBN Fantasma', color: '#9E9E9E' },
] as const;

export const INDEXERS = [
  { key: 'scopus', label: 'Scopus', color: '#E65100' },
  { key: 'publindex', label: 'Publindex', color: '#1565C0' },
  { key: 'wos', label: 'Web of Science', color: '#6A1B9A' },
  { key: 'latindex', label: 'Latindex', color: '#00838F' },
  { key: 'scielo', label: 'SciELO', color: '#D32F2F' },
  { key: 'doaj', label: 'DOAJ', color: '#2E7D32' },
  { key: 'redalyc', label: 'Redalyc', color: '#F57F17' },
] as const;

export const SCOPUS_QUARTILES = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
export const PUBLINDEX_CATEGORIES = ['A1', 'A2', 'B', 'C'] as const;

export const EXPENSE_CATEGORIES = [
  { key: 'proveedor', label: 'Pago a Proveedores' },
  { key: 'materiales', label: 'Materiales e Insumos' },
  { key: 'eventos_talleres', label: 'Eventos / Talleres' },
  { key: 'viaticos', label: 'Viáticos' },
  { key: 'suscripciones', label: 'Suscripciones' },
  { key: 'otro', label: 'Otro' },
] as const;

export const SERVICE_TYPES = [
  { key: 'diagramacion', label: 'Diagramación' },
  { key: 'asesoria_editorial', label: 'Asesoría Editorial' },
  { key: 'formacion', label: 'Formación' },
  { key: 'otro', label: 'Otro' },
] as const;

export const CERTIFICATE_TYPES = [
  { key: 'par_evaluador', label: 'Par Evaluador' },
  { key: 'autor', label: 'Autor' },
  { key: 'escuela_editores', label: 'Escuela de Editores' },
  { key: 'comite_editorial', label: 'Comité Editorial' },
  { key: 'generico', label: 'Genérico' },
] as const;

export const NAV_MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', href: '/' },
  { key: 'journals', label: 'Revistas', icon: 'BookOpen', href: '/journals' },
  { key: 'books', label: 'Libros', icon: 'Library', href: '/books' },
  { key: 'editors-school', label: 'Escuela de Editores', icon: 'GraduationCap', href: '/editors-school' },
  { key: 'finances', label: 'Finanzas', icon: 'DollarSign', href: '/finances' },
  { key: 'certificates', label: 'Certificados', icon: 'Award', href: '/certificates' },
  { key: 'policies', label: 'Políticas', icon: 'FileText', href: '/policies' },
  { key: 'reports', label: 'Informes', icon: 'BarChart3', href: '/reports' },
  { key: 'settings', label: 'Configuración', icon: 'Settings', href: '/settings' },
] as const;
