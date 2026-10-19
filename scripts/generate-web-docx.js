const fs = require('fs');
const path = require('path');
const {
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
} = require('docx');

// Institutional Color Palette (Stitch / Ediciones Unisimón)
const COLORS = {
  PRIMARY: '00682C',        // Deep Brand Green
  PRIMARY_CONTAINER: '09843B', // Emerald container
  SECONDARY: '446808',      // Olive green
  LIME_ACCENT: 'A2CD66',    // Lime accent
  DARK_SURFACE: '001D21',   // Deep dark teal/green
  SOFT_BG: 'F3F3F3',        // Soft gray
  LIGHT_GREEN: 'CDEED3',    // Light container green
  TEXT_DARK: '1A1C1C',      // Neutral dark
  TEXT_MUTED: '5B5F5C',     // Neutral gray text
  WHITE: 'FFFFFF',
  BORDER_COLOR: 'D0D7DE',
};

// Helper: Title / Heading 1
function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
  });
}

// Helper: Heading 2
function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
  });
}

// Helper: Heading 3
function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
  });
}

// Helper: Body Paragraph
function createParagraph(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22, // 11pt
        font: 'Nunito Sans',
        color: options.color || COLORS.TEXT_DARK,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
    spacing: { before: options.before || 60, after: options.after || 120, line: 280 },
    alignment: options.alignment || AlignmentType.LEFT,
  });
}

// Helper: Multi-run Paragraph
function createFormattedParagraph(runs, options = {}) {
  return new Paragraph({
    children: runs.map(r => new TextRun({
      text: r.text,
      size: r.size || 22,
      font: r.font || 'Nunito Sans',
      color: r.color || COLORS.TEXT_DARK,
      bold: r.bold || false,
      italics: r.italics || false,
      underline: r.underline ? {} : undefined,
    })),
    spacing: { before: options.before || 60, after: options.after || 120, line: 280 },
    alignment: options.alignment || AlignmentType.LEFT,
  });
}

// Helper: Callout Box / Highlight
function createCallout(title, text, actionText = null, actionUrl = null) {
  const children = [
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 22,
          font: 'Lexend',
          color: COLORS.PRIMARY,
        }),
      ],
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: text,
          size: 20,
          font: 'Nunito Sans',
          color: COLORS.TEXT_DARK,
        }),
      ],
      spacing: { before: 0, after: actionText ? 100 : 0 },
    }),
  ];

  if (actionText && actionUrl) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Enlace oficial: ${actionText} (${actionUrl})`,
            bold: true,
            size: 20,
            font: 'Lexend',
            color: COLORS.PRIMARY_CONTAINER,
            underline: {},
          }),
        ],
        spacing: { before: 40, after: 0 },
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 12, color: COLORS.LIGHT_GREEN },
      bottom: { style: BorderStyle.SINGLE, size: 12, color: COLORS.LIGHT_GREEN },
      left: { style: BorderStyle.SINGLE, size: 36, color: COLORS.PRIMARY },
      right: { style: BorderStyle.SINGLE, size: 12, color: COLORS.LIGHT_GREEN },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: children,
            shading: { type: ShadingType.CLEAR, fill: 'F4FAF5' },
            margins: { top: 160, bottom: 160, left: 240, right: 240 },
          }),
        ],
      }),
    ],
  });
}

// Helper: Bullet list item
function createBullet(title, description) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [
      new TextRun({ text: `${title}: `, bold: true, size: 22, font: 'Nunito Sans', color: COLORS.TEXT_DARK }),
      new TextRun({ text: description, size: 22, font: 'Nunito Sans', color: COLORS.TEXT_DARK }),
    ],
    spacing: { before: 40, after: 60, line: 260 },
  });
}

// Helper: Table
function createTable(headers, rows) {
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map(h => new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: h, bold: true, size: 20, font: 'Lexend', color: COLORS.WHITE }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
        shading: { type: ShadingType.CLEAR, fill: COLORS.PRIMARY },
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
      })),
    }),
  ];

  rows.forEach((row, i) => {
    tableRows.push(
      new TableRow({
        children: row.map(cell => new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: cell, size: 20, font: 'Nunito Sans', color: COLORS.TEXT_DARK }),
              ],
            }),
          ],
          shading: { type: ShadingType.CLEAR, fill: i % 2 === 0 ? COLORS.WHITE : COLORS.SOFT_BG },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
        })),
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: COLORS.BORDER_COLOR },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: COLORS.BORDER_COLOR },
      left: { style: BorderStyle.SINGLE, size: 8, color: COLORS.BORDER_COLOR },
      right: { style: BorderStyle.SINGLE, size: 8, color: COLORS.BORDER_COLOR },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.BORDER_COLOR },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.BORDER_COLOR },
    },
    rows: tableRows,
  });
}

async function generateDocx() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Nunito Sans',
            size: 22,
            color: COLORS.TEXT_DARK,
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Lexend',
            size: 36, // 18pt
            bold: true,
            color: COLORS.PRIMARY,
          },
          paragraph: {
            spacing: { before: 360, after: 180 },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Lexend',
            size: 28, // 14pt
            bold: true,
            color: COLORS.PRIMARY_CONTAINER,
          },
          paragraph: {
            spacing: { before: 280, after: 120 },
          },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: 'Lexend',
            size: 24, // 12pt
            bold: true,
            color: COLORS.DARK_SURFACE,
          },
          paragraph: {
            spacing: { before: 200, after: 80 },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }, // 1 inch (2.54cm)
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Universidad Simón Bolívar · Vicerrectoría de Investigación, Extensión e Innovación · Ediciones Unisimón',
                    size: 18,
                    font: 'Lexend',
                    color: COLORS.TEXT_MUTED,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Documento Maestro de Contenidos — Portal Web Ediciones Unisimón | Página ',
                    size: 18,
                    font: 'Nunito Sans',
                    color: COLORS.TEXT_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    font: 'Nunito Sans',
                    color: COLORS.TEXT_MUTED,
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 18,
                    font: 'Nunito Sans',
                    color: COLORS.TEXT_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    font: 'Nunito Sans',
                    color: COLORS.TEXT_MUTED,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // PORTADA / ENCABEZADO PRINCIPAL
          new Paragraph({
            children: [
              new TextRun({
                text: 'UNIVERSIDAD SIMÓN BOLÍVAR',
                size: 26,
                bold: true,
                font: 'Lexend',
                color: COLORS.PRIMARY,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'VICERRECTORÍA DE INVESTIGACIÓN, EXTENSIÓN E INNOVACIÓN\nDEPARTAMENTO DE PUBLICACIONES — EDICIONES UNISIMÓN',
                size: 20,
                bold: true,
                font: 'Lexend',
                color: COLORS.DARK_SURFACE,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'DOCUMENTO MAESTRO DE CONTENIDOS Y ARQUITECTURA DEL PORTAL WEB OFICIAL',
                size: 32,
                bold: true,
                font: 'Lexend',
                color: COLORS.PRIMARY,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
          }),
          createCallout(
            'Ficha Técnica del Documento',
            'Versión Oficial Actualizada 2026. Documento que consolida y estructura la totalidad de textos, secciones, políticas, fichas técnicas de libros y revistas, directorio de talento humano, la sección completa de la Revista IRAKA, el programa formativo de la Escuela de Editores, el procedimiento de Certificaciones Minciencias 2024 y las 5 Preguntas Frecuentes con enlaces oficiales de radicación.'
          ),

          // SECCIÓN 1: IDENTIDAD
          createHeading1('1. El Sello Editorial Ediciones Unisimón'),
          createParagraph(
            'Ediciones Unisimón es el sello editorial oficial de la Universidad Simón Bolívar, adscrito a la Vicerrectoría de Investigación, Extensión e Innovación. Su misión fundamental es editar, certificar, publicar y divulgar la producción científica, académica, cultural y formativa de alta calidad generada por investigadores, docentes y creadores de la Universidad y la comunidad académica global.'
          ),
          createParagraph(
            'El fondo editorial opera bajo los más rigurosos estándares de evaluación por pares académicos ciegos, depósito legal, preservación digital, catalogación internacional y principios de Acceso Abierto Diamante, garantizando que el conocimiento generado responda al compromiso institucional con el desarrollo social, científico y económico del Caribe colombiano y del país.'
          ),
          createHeading2('Pilares Estratégicos del Sello'),
          createBullet('Rigor y Excelencia Académica', 'Evaluación sistemática bajo modalidad doble ciego por pares evaluadores externos categorizados en Minciencias o bases de datos globales.'),
          createBullet('Acceso Abierto Diamante', 'Democratización del conocimiento científico sin costos de publicación ni lectura (cero APC en revistas institucionales).'),
          createBullet('Pertinencia e Identidad Caribe', 'Fomento de obras que impactan problemáticas sociales, ambientales, jurídicas y tecnológicas de la región y América Latina.'),
          createBullet('Transparencia y Trazabilidad', 'Procesos auditados, asignación de DOI, código ORCID para autores y preservación en el Repositorio Institucional Bonga.'),

          // SECCIÓN 2: CATÁLOGO DE LIBROS Y CAPÍTULOS
          createHeading1('2. Catálogo de Libros y Capítulos de Investigación'),
          createParagraph(
            'El fondo editorial cuenta con una robusta trayectoria de publicaciones que recopila el avance científico institucional en todas las áreas del conocimiento:'
          ),
          createTable(
            ['Indicador / Rubro', 'Cifra Institucional', 'Descripción y Alcance'],
            [
              ['Libros en Catálogo Histórico', '400+ Títulos', 'Obras de investigación, académicas, de texto y de divulgación.'],
              ['Capítulos de Libro Certificados', '1.200+ Capítulos', 'Capítulos categorizados en convocatorias Minciencias.'],
              ['Pares Evaluadores Registrados', '350+ Árbitros', 'Red de árbitros nacionales e internacionales.'],
              ['Colecciones Editoriales', '6 Grandes Áreas', 'Salud, Ciencias Básicas, Ingeniería, Derecho, Educación y Negocios.'],
              ['Preservación Digital', '100% Digital', 'Custodia permanente con DOI y metadatos OAI-PMH en Bonga.'],
              ['Acceso Abierto Institucional', 'Repositorio Bonga', 'Consulta y descarga libre en https://bonga.unisimon.edu.co'],
            ]
          ),
          createParagraph(
            'Todos los libros publicados por Ediciones Unisimón son sometidos a revisión por al menos tres árbitros (mínimo dos externos), aprobación del Comité Institucional de Publicaciones y aval de Rectoría.'
          ),

          // SECCIÓN 3: REVISTAS CIENTÍFICAS INDEXADAS
          createHeading1('3. Revistas Científicas Indexadas'),
          createParagraph(
            'La Universidad Simón Bolívar edita 5 revistas científicas de alta visibilidad, arbitradas y posicionadas en los principales índices globales como Scopus, Publindex, Redalyc, DOAJ y SciELO. Todas operan bajo Open Journal Systems (OJS) y modelo de Acceso Abierto Diamante:'
          ),
          createTable(
            ['Nombre de la Revista', 'ISSN / e-ISSN', 'Área Temática', 'Indexaciones Destacadas', 'Editor / Enlace'],
            [
              ['Justicia', '0124-7441\n2590-4566', 'Derecho, Ciencias Jurídicas y Sociales', 'Publindex B 2026\nScopus Q3\nDOAJ, Redalyc', 'Sandra Viviana Díaz Rincón\nrevistas.unisimon.edu.co/index.php/justicia'],
              ['Educación y Humanismo', '0122-2678\n2665-2420', 'Educación, Pedagogía, Ciencias Humanas', 'Publindex B 2026\nScopus Q2\nDOAJ, SciELO', 'Equipo Editorial\nrevistas.unisimon.edu.co/index.php/educacion'],
              ['Psicogente', '0124-0137\n2027-212X', 'Psicología, Salud Mental, Neurociencias', 'Publindex B 2026\nScopus Q3\nDOAJ, Redalyc', 'Equipo Editorial\nrevistas.unisimon.edu.co/index.php/psicogente'],
              ['Desarrollo Gerencial', '2145-5147\n2145-5147', 'Administración, Economía y Gestión', 'Publindex B 2026\nLatindex, DOAJ', 'Equipo Editorial\nrevistas.unisimon.edu.co/index.php/desarrollogerencial'],
              ['Investigación e Innovación en Ingenierías', '2344-8652\n2344-8652', 'Ingeniería, TIC, Inteligencia Artificial', 'Publindex C 2026\nLatindex, DOAJ', 'Equipo Editorial\nrevistas.unisimon.edu.co/index.php/innovacioningenierias'],
            ]
          ),

          // SECCIÓN 4: REVISTAS ACADÉMICAS DE FACULTAD
          createHeading1('4. Revistas Académicas de Facultad'),
          createParagraph(
            'Medios institucionales orientados al fomento de la investigación formativa, semilleros y avances de cátedra de los diferentes programas de pregrado y posgrado:'
          ),
          createBullet('Investigación y Desarrollo en TIC (Facultad de Ingenierías)', 'Publicación orientada a la divulgación de experiencias de semilleros y grupos en desarrollo de software, inteligencia artificial, robótica y telecomunicaciones.'),
          createBullet('Liderazgo Estratégico (Facultad de Administración y Negocios)', 'Espacio de difusión académica en modelos de negocio sostenibles, gerencia empresarial, emprendimiento y competitividad.'),
          createBullet('Tejidos Sociales (Facultad de Ciencias Jurídicas y Sociales)', 'Publicación formativa en desarrollo humano, sociología, políticas públicas, trabajo social y derechos fundamentales.'),

          // SECCIÓN 5: REVISTA IRAKA
          createHeading1('5. Revista IRAKA — Periodismo Científico y Divulgación'),
          createCallout(
            'Ficha de Identidad de la Revista IRAKA',
            'Medio oficial de periodismo científico y divulgación de la Universidad Simón Bolívar. Periodicidad semestral con versiones impresa y digital de acceso libre y gratuito. ISSN: 2711-2578. Edición Actual: Edición No. 9 (Enero - Junio 2026).',
            'Portal Digital IRAKA',
            'https://iraka.unisimon.edu.co/'
          ),
          createParagraph(
            'La Universidad Simón Bolívar presentó el 27 de mayo de 2020 una alternativa informativa que divulga masivamente las novedades de la ciencia colombiana: Iraka, su revista de periodismo científico. La revista se publica cada semestre y se soporta en la experticia de 313 profesores investigadores escalafonados por Minciencias y 44 grupos de investigación reconocidos institucionalmente.'
          ),
          createHeading2('Misión Editorial y Vocería Institucional'),
          createFormattedParagraph([
            { text: '«Dentro de la misión institucional de responder a nuestro compromiso con el desarrollo del entorno social, político, cultural y económico, surge Iraka, el medio informativo especializado que divulgará masivamente el trabajo de los grupos de investigación de Unisimón». ', italics: true },
            { text: '— José Consuegra Bolívar, Rector de la Universidad Simón Bolívar.', bold: true },
          ]),
          createHeading2('¿Por qué el nombre IRAKA?'),
          createParagraph(
            'Con Iraka, la Universidad Simón Bolívar aúna esfuerzos para posicionar al Caribe colombiano como idóneo y pertinente para la ciencia. También destaca la biodiversidad del país y homenajea la identidad y la cultura regional, al recordar que la palma de iraca es la herencia viva de la cultura ancestral Mokaná, hoy aprovechada principalmente como legado por los pobladores y la comunidad indígena del municipio de Usiacurí (Atlántico).'
          ),
          createFormattedParagraph([
            { text: '«El cambio acelerado y la complejidad tecnológica implica que los problemas deben ser abordados de forma transdisciplinaria, revaluando los esquemas y las metodologías para generar y difundir los conocimientos, de manera que los imaginarios sociales sobre ciencia, tecnología e innovación evolucionen a tal punto que se conviertan en tema de conversación cotidiana». ', italics: true },
            { text: '— Dra. Paola Amar Sepúlveda, Vicerrectora de Investigación, Extensión e Innovación.', bold: true },
          ]),
          createHeading2('Soporte Investigativo de Respaldo'),
          createTable(
            ['Métrica Científica', 'Cifra Oficial', 'Detalle'],
            [
              ['Investigadores Escalafonados Minciencias', '313 Investigadores', '6 Eméritos, 94 Senior, 128 Asociados y Junior.'],
              ['Grupos de Investigación Reconocidos', '44 Grupos', '22 en categoría A1 y 15 en categoría A (categorías de excelencia).'],
              ['Facultades Integradas', '5 Facultades', 'Salud, Biomédicas, Ingenierías, Derecho y Ciencias Sociales, Negocios.'],
              ['Periodicidad y Formato', 'Semestral', 'Edición digital e impresa. Impresión con Casa Editorial El Tiempo y diagramación con El Espectador.'],
            ]
          ),
          createHeading2('Artículos y Temas Destacados (Edición Actual No. 9)'),
          createBullet('Virología e Inteligencia Artificial', 'Diagnósticos médicos, análisis masivo de datos y el misterio de por qué el 99% de los virus siguen siendo desconocidos.'),
          createBullet('Pixsound: Arte y Algoritmos', 'Sistema de inteligencia artificial que convierte píxeles de obras pictóricas en composiciones sonoras.'),
          createBullet('Nanopartículas de Oro', 'Detección de cambios moleculares tempranos asociados a infertilidad masculina y medicina de precisión.'),
          createBullet('Diplomacia Científica en el Caribe', 'Articulación entre ciencia, cooperación internacional y sostenibilidad territorial.'),

          // SECCIÓN 6: EQUIPO EDITORIAL
          createHeading1('6. Directorio del Equipo de Publicaciones'),
          createParagraph(
            'El Departamento de Publicaciones cuenta con un equipo multidisciplinar calificado para la gestión editorial, indexación, corrección y producción:'
          ),
          createTable(
            ['Nombre', 'Cargo / Función', 'Sede'],
            [
              ['Liderazgo y Coordinación', 'Coordinador del Departamento de Publicaciones', 'Barranquilla'],
              ['Gestión de Revistas', 'Editores Técnicos y Gestores OJS', 'Barranquilla y Cúcuta'],
              ['Procesamiento de Libros', 'Especialistas en Arbitraje y Edición de Obras', 'Barranquilla'],
              ['Diseño y Diagramación', 'Diseñadores Gráficos y Maquetadores XML/ePub', 'Barranquilla'],
              ['Certificaciones y Soporte', 'Gestores de Certificaciones Minciencias y PubManager', 'Barranquilla'],
              ['Publicaciones Cúcuta', 'Enlace Editorial y Administrativo Campus Cúcuta', 'Cúcuta'],
            ]
          ),

          // SECCIÓN 7: ESCUELA DE EDITORES
          createHeading1('7. Escuela de Editoras y Editores Unisimón'),
          createParagraph(
            'Programa de formación extracurricular pionero en el país que fortalece capacidades en redacción académica, ética de la publicación, arbitraje por pares y gestión de revistas científicas.'
          ),
          createHeading2('Convocatoria 3.ª Cohorte 2026'),
          createBullet('Población Objetivo', 'Estudiantes de pregrado entre 4.º y 7.º semestre de la Universidad Simón Bolívar.'),
          createBullet('Requisito de Investigación', 'Estar certificados en semilleros de investigación institucional en categoría Amateur o superior.'),
          createBullet('Plan de Estudios', '4 módulos teórico-prácticos: Gestión editorial en OJS, arbitraje por pares ciegos, normas COPE de integridad y visibilidad en Scopus/WoS.'),
          createBullet('Certificación', 'Aval institucional emitido por la Vicerrectoría de Investigación, Extensión e Innovación.'),

          // SECCIÓN 8: CERTIFICACIONES MINCIENCIAS 2024
          createHeading1('8. Certificaciones y Avales Minciencias 2024'),
          createParagraph(
            'El Departamento de Publicaciones emite las certificaciones institucionales de producción bibliográfica requeridas para las convocatorias nacionales de medición y reconocimiento de grupos e investigadores de Minciencias.'
          ),
          createTable(
            ['Tipología de Producto', 'Requisitos de Existencia y Calidad', 'Documentos Soporte Requeridos'],
            [
              ['Libro de Investigación', 'ISBN registrado, revisión por al menos 2 pares externos ciegos y sello reconocido.', 'Enlace web permanente de descarga, certificado editorial y formato de pares.'],
              ['Capítulo de Libro Propio', 'ISBN del libro, tabla de contenido, autoría explícita y evaluación por pares.', 'Copia digital o URL del repositorio Bonga donde conste el capítulo.'],
              ['Capítulo Editorial Externa', 'Editorial categorizada, ISBN válido, pares académicos externos y enlace público.', 'Certificado editorial original, cartas de pares y URL accesible sin muro de pago.'],
              ['Pares Evaluadores', 'Constancia de arbitraje de libro o artículo para sello Unisimón o revistas OJS.', 'Título de la obra arbitrada, fecha de dictamen y código de verificación.'],
            ]
          ),
          createCallout(
            'Canal Único Autorizado para Solicitar Certificados',
            'Todas las solicitudes se radican exclusivamente a través del formulario institucional de Microsoft Forms. El tiempo de respuesta es de 3 a 5 días hábiles tras la verificación contra los criterios de Minciencias.',
            'Formulario Institucional en Microsoft Forms',
            'https://forms.office.com'
          ),

          // SECCIÓN 9: PROCESO EDITORIAL
          createHeading1('9. Proceso Editorial y Ciclo de Publicación'),
          createBullet('Fase 1: Postulación', 'Envío de propuesta con formato de presentación, manuscrito anonimizado y carta de aval de grupo.'),
          createBullet('Fase 2: Evaluación por Pares', 'Revisión preliminar de similitud (máximo 20%) y dictamen de mínimo 2 pares ciegos externos.'),
          createBullet('Fase 3: Decisión y Ajustes', 'Plazo de hasta 10 días hábiles para subsanar observaciones de los evaluadores.'),
          createBullet('Fase 4: Aprobación', 'Concepto favorable del Comité Institucional de Publicaciones y aval de Rectoría.'),
          createBullet('Fase 5: Producción', 'Corrección ortotipográfica y de estilo, diseño de cubierta, diagramación de interiores y marcado.'),
          createBullet('Fase 6: Publicación y Depósito', 'Asignación de ISBN/DOI, entrega de Depósito Legal y carga en el Repositorio Bonga.'),

          // SECCIÓN 10: MARCO NORMATIVO
          createHeading1('10. Marco Político y Normativo Editorial'),
          createBullet('Política Editorial Institucional', 'Reglamenta los criterios de selección, funciones del comité editorial, derechos morales y patrimoniales de autor.'),
          createBullet('Lineamiento de Publicación 2026', 'Define topes de apoyo a APC en revistas Scopus/WoS Q1 y Q2, y fija un límite de similitud menor al 20%.'),
          createBullet('Comité Institucional de Publicaciones', 'Órgano consultivo y decisorio que garantiza el rigor, pertinencia ética y calidad científica del fondo.'),

          // SECCIÓN 11: PREGUNTAS FRECUENTES (DETALLADAS)
          createHeading1('11. Preguntas Frecuentes (FAQs)'),
          createParagraph(
            'Respuestas detalladas a las inquietudes más recurrentes de profesores, investigadores y autores sobre el fondo editorial y los trámites de certificación:'
          ),

          createHeading2('Pregunta 1: ¿Cómo postulo un manuscrito de libro para publicación?'),
          createParagraph(
            'Debes remitir la propuesta editorial a través de la convocatoria institucional anual o directamente al correo dptopublicaciones@unisimon.edu.co adjuntando: manuscrito completo anonimizado, formato de presentación de propuesta y carta de aval del grupo de investigación respectivo. El manuscrito es evaluado por al menos tres árbitros (dos pares externos bajo doble ciego) y el Comité Institucional de Publicaciones antes de su aval por Rectoría.'
          ),

          createHeading2('Pregunta 2: ¿Cuánto tarda la emisión de un certificado para Minciencias?'),
          createParagraph(
            'Una vez recibida la solicitud completa en el formulario de Microsoft Forms con todos los soportes (enlace a la obra, certificación editorial y evaluación por pares), el tiempo estimado de emisión es de 3 a 5 días hábiles, tras la verificación rigurosa de los criterios normativos de Minciencias 2024. Los certificados emitidos quedan cargados y verificables con código único en la plataforma PubManager.'
          ),

          createHeading2('Pregunta 3: ¿Dónde y a través de qué enlace radico la solicitud de certificación o aval de mis publicaciones?'),
          createParagraph(
            'Todas las solicitudes institucionales de certificación y aval bibliográfico deben radicarse exclusivamente a través del enlace oficial del formulario institucional: «Solicitud de Certificación y/o Aval de Publicaciones Bibliográficas».'
          ),
          createCallout(
            'Enlace Oficial de Radicación de Certificados',
            'Canal único autorizado para solicitar certificaciones de libros, capítulos, pares evaluadores y avales institucionales. En el formulario se solicitan datos de CvLAC/GrupLAC y carga de soportes verificables.',
            'Diligenciar Solicitud en Microsoft Forms',
            'https://forms.office.com'
          ),
          createParagraph(
            'Para la sede Cúcuta, las consultas también pueden ser remitidas a publicacionescucuta@unisimon.edu.co. No se gestionan certificaciones por canales informales sin el debido registro en este formulario.'
          ),

          createHeading2('Pregunta 4: ¿Qué requisitos debe cumplir un capítulo de libro en editorial externa para ser certificado y cómo se postula?'),
          createParagraph(
            'Para que un capítulo publicado con un sello editorial externo sea certificado con validez ante Minciencias, debe cumplir los siguientes requisitos normativos de existencia y calidad:'
          ),
          createBullet('ISBN válido y registrado', 'Registrado en la cámara o agencia nacional del libro correspondiente.'),
          createBullet('Evidencia accesible de publicación', 'Es obligatorio suministrar una URL pública o repositorio donde se pueda consultar o descargar la obra o el capítulo completo. No se aceptan enlaces a páginas de venta o catálogos comerciales que requieran pago y no permitan verificar el contenido.'),
          createBullet('Certificación explícita de evaluación por pares', 'Certificado emitido por la editorial externa donde conste que la obra pasó por arbitraje académico (mínimo 2 pares externos bajo doble ciego).'),
          createBullet('Editorial categorizada', 'La editorial debe encontrarse registrada o categorizada en los listados reconocidos por Minciencias o por la Universidad.'),
          createCallout(
            'Radicación de Solicitud de Capítulo Externo',
            'Ingresa al formulario oficial de Microsoft Forms y adjunta el ISBN, la URL de descarga verificable y la constancia de pares evaluadores.',
            'Radicar Solicitud de Capítulo',
            'https://forms.office.com'
          ),

          createHeading2('Pregunta 5: ¿La Universidad apoya el pago de cargos por publicación (APC) o traducción, y cómo se solicita?'),
          createParagraph(
            'Sí. La Universidad Simón Bolívar, a través de la Vicerrectoría de Investigación, Extensión e Innovación y el Departamento de Publicaciones, apoya económicamente a profesores investigadores activos con vinculación laboral para el pago de Article Processing Charges (APC) y servicios de traducción en revistas de alto impacto:'
          ),
          createBullet('Criterio de indexación', 'Artículos aceptados en revistas indexadas vigentes en Scopus (SJR) o Web of Science (JCR) en cuartiles Q1 y Q2.'),
          createBullet('Filiación de autores', 'El solicitante debe figurar con filiación institucional principal a la Universidad Simón Bolívar como primer autor o autor de correspondencia.'),
          createBullet('Revistas propias de Unisimón', 'Operan bajo el modelo Acceso Abierto Diamante (100% gratuitas, cero cobro de APC a autores).'),
          createCallout(
            '¿Dónde solicitar el apoyo de APC o traducción?',
            'Radica la solicitud a través del enlace de solicitudes o remite la factura proforma y carta de aceptación a nuestro correo dptopublicaciones@unisimon.edu.co. Consulta el Lineamiento de Publicación 2026 completo en el portal.',
            'Contactar al Departamento de Publicaciones',
            'mailto:dptopublicaciones@unisimon.edu.co'
          ),

          // SECCIÓN 12: CANALES DE ATENCIÓN Y CONTACTO
          createHeading1('12. Canales de Atención, Sedes y Contacto'),
          createTable(
            ['Campus / Canal', 'Dirección Física / Ubicación', 'Contacto / Horario'],
            [
              ['Campus Barranquilla', 'Carrera 59 No. 59-65\nVicerrectoría de Investigación, Extensión e Innovación', 'PBX: +57 (605) 3444333 Ext. 1002\nLunes a Viernes: 8:00 a.m. - 12:00 m. / 2:00 p.m. - 6:00 p.m.'],
              ['Campus Cúcuta', 'Sede Villa del Rosario / Los Patios\nNorte de Santander', 'publicacionescucuta@unisimon.edu.co\nPBX: +57 (607) 5827070'],
              ['Correo General', 'Atención permanente a investigadores y autores', 'dptopublicaciones@unisimon.edu.co'],
              ['Repositorio Bonga', 'Catálogo libre de libros institucionales', 'https://bonga.unisimon.edu.co'],
              ['Portal OJS Revistas', '5 Revistas científicas indexadas', 'https://revistas.unisimon.edu.co'],
              ['Revista IRAKA', 'Periodismo científico y divulgación', 'https://iraka.unisimon.edu.co'],
              ['PubManager', 'Gestión y verificación de certificaciones', 'http://localhost:3000'],
            ]
          ),
          createParagraph(
            '© 2026 Universidad Simón Bolívar — Ediciones Unisimón. Todos los derechos reservados. Barranquilla y Cúcuta, Colombia.',
            { alignment: AlignmentType.CENTER, before: 300, color: COLORS.TEXT_MUTED }
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  
  // Guardar en web-ediciones-unisimon/Contenido_Web_Ediciones_Unisimon_Actualizado.docx
  const outputPath = path.resolve(__dirname, '../web-ediciones-unisimon/Contenido_Web_Ediciones_Unisimon_Actualizado.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Documento creado con éxito en:', outputPath);

  // También actualizar el archivo original Contenido_Web_Ediciones_Unisimon.docx
  const legacyPath = path.resolve(__dirname, '../web-ediciones-unisimon/Contenido_Web_Ediciones_Unisimon.docx');
  fs.writeFileSync(legacyPath, buffer);
  console.log('Documento maestro actualizado en:', legacyPath);
}

generateDocx().catch(err => {
  console.error('Error generando documento Word:', err);
  process.exit(1);
});
