const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const url = 'https://yonklzparwtjdwzltivr.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvbmtsenBhcnd0amR3emx0aXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjA1MTksImV4cCI6MjA5NjY5NjUxOX0.Q8qQwV-LXd262RfibOTiggSB0YjwpZH1vmxwOtyItZM';
const supabase = createClient(url, key);

async function fetchAll(tableName, selectQuery = '*', orderCol = 'id') {
  const records = [];
  let offset = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .range(offset, offset + batchSize - 1);
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    records.push(...data);
    if (data.length < batchSize) break;
    offset += batchSize;
  }
  return records;
}

async function exportDatabase() {
  console.log('Descargando datos desde Supabase...');
  
  // 1. Fetch books
  const books = await fetchAll('books', '*, faculties(name)');
  console.log(`- ${books.length} libros recuperados`);

  // 2. Fetch chapters
  const chapters = await fetchAll('book_chapters', '*');
  console.log(`- ${chapters.length} capítulos recuperados`);

  // 3. Fetch people
  const people = await fetchAll('people', 'id, full_name, email, cedula');
  const peopleMap = new Map(people.map(p => [p.id, p]));
  console.log(`- ${people.length} personas/autores recuperados`);

  // 4. Fetch book authors
  const bookAuthors = await fetchAll('book_authors', '*');
  console.log(`- ${bookAuthors.length} relaciones libro-autor recuperadas`);

  // 5. Fetch chapter authors
  const chapterAuthors = await fetchAll('chapter_authors', '*');
  console.log(`- ${chapterAuthors.length} relaciones capítulo-autor recuperadas`);

  // 6. Fetch external certificates
  const { data: certs } = await supabase
    .from('certificates')
    .select('*')
    .order('consecutive_number', { ascending: true });
  console.log(`- ${(certs || []).length} certificados recuperados`);

  // Map authors to books
  const authorsByBook = new Map();
  for (const ba of bookAuthors) {
    const p = peopleMap.get(ba.person_id);
    const authorName = p ? p.full_name : 'Desconocido';
    const role = ba.role ? ` (${ba.role})` : '';
    if (!authorsByBook.has(ba.book_id)) {
      authorsByBook.set(ba.book_id, []);
    }
    authorsByBook.get(ba.book_id).push(`${authorName}${role}`);
  }

  // Map authors to chapters
  const authorsByChapter = new Map();
  for (const ca of chapterAuthors) {
    const p = peopleMap.get(ca.person_id);
    const authorName = p ? p.full_name : 'Desconocido';
    if (!authorsByChapter.has(ca.chapter_id)) {
      authorsByChapter.set(ca.chapter_id, []);
    }
    authorsByChapter.get(ca.chapter_id).push(authorName);
  }

  // Map book titles for chapter references
  const bookMap = new Map(books.map(b => [b.id, b]));

  // Build Workbook
  const wb = XLSX.utils.book_new();

  // ==========================================
  // HOJA 1: LIBROS
  // ==========================================
  const booksHeaders = [
    'Código',
    'Título del Libro',
    'Subtítulo',
    'Autores / Editores / Compiladores',
    'Editorial',
    'Tipo de Edición',
    'Tipo de Libro',
    'Tipo Minciencias',
    'Subtipo Minciencias',
    'Año Publicación',
    'Mes Publicación',
    'ISBN Digital',
    'ISBN Impreso',
    'DOI / Handle / Repositorio',
    'Facultad / Unidad',
    'Etapa Editorial',
    'Estado',
    'Páginas',
    'Tiraje (Ejemplares)',
    'Formato',
    'Proyecto Origen',
    'Financiación',
    'Grupo de Investigación',
    'Número de Capítulos',
    'Número de Autores',
    'Notas'
  ];

  const editionTypeLabels = {
    propio: 'Sello Propio',
    coedicion: 'Coedición',
    participacion_externa: 'Participación Externa / Avalado'
  };

  const bookTypeLabels = {
    libro_completo: 'Libro Completo',
    libro_compilatorio: 'Libro Compilatorio',
    memorias: 'Memorias',
    cartilla_manual: 'Cartilla / Manual / Guía'
  };

  const stageLabels = {
    propuesta: 'Recepción de Propuesta',
    revision_tecnica: 'Revisión Técnica',
    evaluacion_pares: 'Evaluación de Pares',
    cotizacion: 'Cotización con Proveedor',
    orden_compra: 'Orden de Compra',
    con_proveedor: 'Envío al Proveedor',
    correccion_diagramacion: 'Corrección y Diagramación',
    revision_entrega: 'Revisión de Entrega',
    isbn_issn: 'Asignación ISBN/ISSN/DOI',
    publicacion: 'Publicación e Impresión'
  };

  const statusLabels = {
    en_proceso: 'En Proceso',
    publicado: 'Publicado',
    cancelado: 'Cancelado',
    pausado: 'Pausado',
    isbn_fantasma: 'ISBN Fantasma'
  };

  const booksRows = books.map(b => {
    const authors = authorsByBook.get(b.id) || [];
    return [
      b.code || '',
      b.title || '',
      b.subtitle || '',
      authors.join('; '),
      b.editorial || 'Ediciones Universidad Simón Bolívar',
      editionTypeLabels[b.edition_type] || b.edition_type || (b.editorial && !b.editorial.includes('Simón Bolívar') ? 'Participación Externa' : 'Sello Propio'),
      bookTypeLabels[b.book_type] || b.book_type || '',
      b.tipo_minciencias || '',
      b.subtipo_minciencias || '',
      b.year_published || '',
      b.month_published || '',
      b.isbn_digital || '',
      b.isbn_print || '',
      b.repository_url || b.url_doi || b.doi || '',
      b.faculties?.name || '',
      stageLabels[b.current_stage] || b.current_stage || '',
      statusLabels[b.status] || b.status || '',
      b.page_count || '',
      b.print_run || '',
      b.format || '',
      b.project_name || '',
      b.financing || '',
      b.research_group_code || '',
      b.num_chapters || 0,
      b.num_authors || authors.length || 0,
      b.notes || ''
    ];
  });

  const wsBooks = XLSX.utils.aoa_to_sheet([booksHeaders, ...booksRows]);
  wsBooks['!cols'] = [
    { wch: 10 }, { wch: 45 }, { wch: 25 }, { wch: 40 },
    { wch: 35 }, { wch: 22 }, { wch: 20 }, { wch: 22 },
    { wch: 32 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 25 },
    { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 30 }, { wch: 25 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsBooks, 'Libros');

  // ==========================================
  // HOJA 2: CAPÍTULOS DE LIBROS
  // ==========================================
  const chaptersHeaders = [
    'Código Capítulo',
    'Libro Contenedor',
    'Editorial del Libro',
    'ISBN del Libro',
    'Número de Capítulo',
    'Título del Capítulo',
    'Autores del Capítulo',
    'Página Inicial',
    'Página Final',
    'Rango de Páginas',
    'Tipo Minciencias',
    'Subtipo Minciencias',
    'Año',
    'DOI',
    'Notas'
  ];

  const chaptersRows = chapters.map(c => {
    const parentBook = bookMap.get(c.book_id);
    const chapterAuthorsList = authorsByChapter.get(c.id) || [];
    const pageRange = (c.start_page && c.end_page) 
      ? `${c.start_page}-${c.end_page}` 
      : (c.start_page ? `${c.start_page}` : '');

    return [
      c.code || '',
      parentBook?.title || 'Libro no identificado',
      parentBook?.editorial || '',
      parentBook?.isbn_digital || parentBook?.isbn_print || '',
      c.chapter_number || '',
      c.title || '',
      chapterAuthorsList.join('; '),
      c.start_page || '',
      c.end_page || '',
      pageRange,
      c.tipo_minciencias || '',
      c.subtipo_minciencias || '',
      c.year || parentBook?.year_published || '',
      c.doi || '',
      c.notes || ''
    ];
  });

  const wsChapters = XLSX.utils.aoa_to_sheet([chaptersHeaders, ...chaptersRows]);
  wsChapters['!cols'] = [
    { wch: 14 }, { wch: 45 }, { wch: 30 }, { wch: 20 },
    { wch: 12 }, { wch: 45 }, { wch: 35 }, { wch: 12 },
    { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 35 },
    { wch: 10 }, { wch: 25 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsChapters, 'Capítulos');

  // ==========================================
  // HOJA 3: CERTIFICADOS Y EDITORIALES EXTERNAS
  // ==========================================
  const certHeaders = [
    'Consecutivo',
    'Tipo de Certificado / Aval',
    'Categoría',
    'Destinatario / Autor',
    'Cédula / Documento',
    'Título de Referencia',
    'Tipo Publicación',
    'Editorial / Tipo Editorial',
    'Canal de Solicitud',
    'Solicitante',
    'Correo Solicitante',
    'Estado',
    'Fecha de Expedición / Creación'
  ];

  const certRows = (certs || []).map(c => {
    const gen = c.generated_data || {};
    const editorialName = gen.editorial || (c.editorial_type === 'sello_propio' ? 'Ediciones Universidad Simón Bolívar' : 'Editorial Externa');
    const pubType = c.publication_type === 'capitulo' ? 'Capítulo' : 'Libro';
    return [
      c.consecutive_number ? `No. ${c.consecutive_number}` : 'S/N',
      c.description || c.certificate_type || '',
      c.document_category || '',
      c.recipient_name || '',
      c.recipient_cedula || '',
      c.title_reference || gen.libro_titulo || gen.capitulo_titulo || '',
      pubType,
      editorialName,
      c.request_channel || 'formulario',
      c.requester_name || '',
      c.requester_email || '',
      c.status || 'generado',
      c.issue_date || c.created_at?.split('T')[0] || ''
    ];
  });

  const wsCerts = XLSX.utils.aoa_to_sheet([certHeaders, ...certRows]);
  wsCerts['!cols'] = [
    { wch: 14 }, { wch: 35 }, { wch: 22 }, { wch: 30 },
    { wch: 18 }, { wch: 45 }, { wch: 15 }, { wch: 32 },
    { wch: 16 }, { wch: 25 }, { wch: 28 }, { wch: 14 },
    { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsCerts, 'Certificados y Avales');

  // ==========================================
  // HOJA 4: RESUMEN Y ESTADÍSTICAS
  // ==========================================
  const totalBooks = books.length;
  const publishedBooks = books.filter(b => b.status === 'publicado').length;
  const inProcessBooks = books.filter(b => b.status === 'en_proceso').length;
  const externalBooks = books.filter(b => b.editorial && !b.editorial.includes('Simón Bolívar')).length;
  const ownBooks = totalBooks - externalBooks;
  const totalChapters = chapters.length;

  const statsHeaders = ['Métrica / Indicador', 'Total Registrado'];
  const statsRows = [
    ['Total de Libros Registrados', totalBooks],
    ['Libros Publicados', publishedBooks],
    ['Libros en Proceso Editorial', inProcessBooks],
    ['Libros Sello Propio / Coedición Institucional', ownBooks],
    ['Libros con Editorial Externa / Otras Instituciones', externalBooks],
    ['Total de Capítulos de Libros', totalChapters],
    ['Total de Autores e Investigadores Registrados', people.length],
    ['Total de Certificados / Avales Expedidos', (certs || []).length],
    ['Fecha de Generación del Reporte', new Date().toLocaleString('es-CO')]
  ];

  const wsStats = XLSX.utils.aoa_to_sheet([statsHeaders, ...statsRows]);
  wsStats['!cols'] = [{ wch: 45 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsStats, 'Resumen');

  // Guardar archivo en la raíz y en public/downloads
  const fileName = 'Base_de_Datos_Libros_Unisimon_Actualizada.xlsx';
  const rootPath = path.join(__dirname, '..', fileName);
  const publicDir = path.join(__dirname, '..', 'public', 'downloads');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicPath = path.join(publicDir, fileName);

  XLSX.writeFile(wb, rootPath);
  XLSX.writeFile(wb, publicPath);

  console.log(`\n✅ Archivo generado con éxito en:\n1. ${rootPath}\n2. ${publicPath}`);
}

exportDatabase().catch(console.error);
