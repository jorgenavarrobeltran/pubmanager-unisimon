// Genera la versión Word del contenido del prototipo "Ediciones Unisimón"
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, ExternalHyperlink, AlignmentType, Footer, PageNumber,
} = require('docx');

const GREEN = '0F7A13';      // hsl(122,85%,24%) aprox.
const GREEN_OF = '09843B';
const LIGHT = 'CDEED3';
const LIME = 'A2CD66';
const DARK = '001D21';
const PEND_BG = 'FFF4E0';
const PEND = 'B26A00';
const FONT = 'Calibri';

// ---------- helpers ----------
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color });
const tag = (t) => new TextRun({ text: `[${t}] `, font: FONT, size: 18, color: '8A8F8B', bold: true });
const P = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children, o)], spacing: { after: o.after ?? 120, line: 300 }, alignment: o.align });
const pend = (text) => new TextRun({ text: ` [Pendiente: ${text}] `, font: FONT, size: 20, bold: true, color: PEND, shading: { type: ShadingType.CLEAR, color: 'auto', fill: PEND_BG } });
const link = (text, url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text, font: FONT, size: 22, color: GREEN_OF, underline: {} })] });
const bullet = (children) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], bullet: { level: 0 }, spacing: { after: 80, line: 290 } });

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [tag('H1'), new TextRun({ text: t, font: FONT, size: 52, bold: true, color: GREEN })], spacing: { before: 200, after: 160 }, keepNext: true, pageBreakBefore: true });
const H2 = (t, eyebrow) => {
  const out = [];
  if (eyebrow) out.push(new Paragraph({ children: [new TextRun({ text: eyebrow.toUpperCase(), font: FONT, size: 18, bold: true, color: GREEN_OF, characterSpacing: 30 })], spacing: { before: 360, after: 40 }, keepNext: true }));
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [tag('H2'), new TextRun({ text: t, font: FONT, size: 36, bold: true, color: GREEN })], spacing: { before: eyebrow ? 0 : 360, after: 140 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: LIME, space: 4 } } }));
  return out;
};
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [tag('H3'), new TextRun({ text: t, font: FONT, size: 28, bold: true, color: GREEN })], spacing: { before: 280, after: 100 }, keepNext: true });
const H4 = (t) => new Paragraph({ children: [new TextRun({ text: t, font: FONT, size: 22, bold: true, color: DARK })], spacing: { before: 160, after: 80 }, keepNext: true });

const cellBorders = { top: { style: BorderStyle.SINGLE, size: 4, color: LIGHT }, bottom: { style: BorderStyle.SINGLE, size: 4, color: LIGHT }, left: { style: BorderStyle.SINGLE, size: 4, color: LIGHT }, right: { style: BorderStyle.SINGLE, size: 4, color: LIGHT } };
const cell = (children, o = {}) => new TableCell({
  children: (Array.isArray(children) ? children : [children]).map((c) => (typeof c === 'string' ? P([run(c, { bold: o.bold, color: o.color, size: o.size })], { after: 40 }) : c)),
  shading: o.fill ? { type: ShadingType.CLEAR, color: 'auto', fill: o.fill } : undefined,
  borders: cellBorders, margins: { top: 80, bottom: 80, left: 120, right: 120 }, width: o.width ? { size: o.width, type: WidthType.PERCENTAGE } : undefined,
});
const table = (header, rows, widths) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, { bold: true, color: 'FFFFFF', fill: GREEN, width: widths?.[i] })) }),
    ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(c, { fill: ri % 2 ? 'F3F3F3' : undefined, width: widths?.[i] })) })),
  ],
});
// Tarjetas de métricas: número grande + etiqueta
const metrics = (items) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [new TableRow({
    children: items.map(([n, l, s]) => new TableCell({
      borders: cellBorders, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F4FBF5' }, margins: { top: 100, bottom: 100, left: 120, right: 120 },
      width: { size: Math.floor(100 / items.length), type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({ children: [new TextRun({ text: n, font: FONT, size: 36, bold: true, color: GREEN_OF })], spacing: { after: 20 } }),
        new Paragraph({ children: [run(l, { size: 18 })], spacing: { after: s ? 20 : 0 } }),
        ...(s ? [new Paragraph({ children: [run(s, { size: 16, color: '777777', italics: true })] })] : []),
      ],
    })),
  })],
});
const space = () => new Paragraph({ children: [], spacing: { after: 120 } });
const source = (t) => P([run(t, { size: 18, italics: true, color: '6B6F6C' })], { after: 160 });
const button = (label, url) => P([run('Botón: ', { bold: true, size: 20, color: '6B6F6C' }), link(label, url)], { after: 160 });

// ---------- contenido ----------
const c = [];

// Portada / notas
c.push(new Paragraph({ children: [new TextRun({ text: 'Ediciones Unisimón', font: FONT, size: 60, bold: true, color: GREEN })], spacing: { after: 80 } }));
c.push(P([run('Contenidos para la sección web del Departamento de Publicaciones', { size: 28, color: DARK })], { after: 60 }));
c.push(P([run('Universidad Simón Bolívar · Vicerrectoría de Investigación, Extensión e Innovación · Octubre de 2026', { size: 20, color: '6B6F6C' })], { after: 240 }));
c.push(table(['Campo', 'Detalle'], [
  ['Dirigido a', 'Área de Sistemas – Equipo del sitio web institucional'],
  ['Remite', 'Jorge Navarro Beltrán, Jefe del Departamento de Publicaciones (dptopublicaciones@unisimon.edu.co)'],
  ['Página', 'Investigación › Ediciones Unisimón (sitio de prueba: educacionprueba.unisimon.edu.co/barranquilla/investigacion/)'],
  ['Adjuntos', 'Prototipo navegable (web-ediciones-unisimon-prototipo.zip), con las imágenes y los documentos PDF listados en el Anexo 2'],
], [22, 78]));
c.push(space());
c.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [new TableRow({ children: [cell([
    P([run('Instrucciones para el equipo web', { bold: true, color: GREEN })], { after: 60 }),
    bullet([run('El documento sigue la estructura de encabezados propuesta por Sistemas; las etiquetas '), run('[H1] [H2] [H3]', { bold: true }), run(' indican el nivel de cada título.')]),
    bullet('Los textos, cifras, tablas y enlaces están listos para publicarse tal como aparecen.'),
    bullet([run('Los textos marcados como '), pend('...'), run(' aún no deben publicarse; el Departamento enviará esa información (ver Anexo 1).')]),
    bullet('Las cifras provienen de PubManager (Departamento de Publicaciones), con corte a octubre de 2026, y de los documentos institucionales citados en cada sección.'),
    bullet([run('El prototipo adjunto ('), run('index.html', { bold: true }), run(') es una referencia visual construida con los estilos del sitio de prueba; puede adaptarse a los componentes del gestor de contenidos.')]),
    bullet('Las imágenes del prototipo son ilustrativas; se recomienda reemplazarlas por fotografías institucionales.'),
  ], { fill: 'F4FBF5' })] })],
}));

// ===== H1 / Banner =====
c.push(H1('Ediciones Unisimón'));
c.push(P([run('Above the fold (Banner)', { italics: true, color: '6B6F6C', size: 20 })]));
c.push(P([run('Ruta de navegación: ', { bold: true }), run('Inicio / Investigación / Ediciones Unisimón')]));
c.push(P([run('Subtítulo: ', { bold: true }), run('Sello editorial de la Universidad Simón Bolívar. Editamos, certificamos y divulgamos la producción científica, académica y cultural de nuestra comunidad investigadora.')]));
c.push(button('Explorar libros', 'https://bonga.unisimon.edu.co/'));
c.push(button('Revistas científicas', 'https://revistas.unisimon.edu.co/'));
c.push(metrics([['534', 'libros publicados'], ['1.726', 'capítulos de libro'], ['3.423', 'autores registrados'], ['5', 'revistas científicas']]));

// ===== H2 Sello editorial =====
c.push(...H2('Ediciones Unisimón: conocimiento que trasciende', 'Sello editorial universidad'));
c.push(P('El Departamento de Publicaciones, adscrito a la Vicerrectoría de Investigación, Extensión e Innovación, gestiona la producción y divulgación de libros, revistas científicas y textos universitarios de la Universidad Simón Bolívar.'));
c.push(P('Cada título pasa por evaluación editorial y arbitraje académico, se registra con ISBN, se describe con metadatos normalizados y se divulga en acceso abierto a través del repositorio institucional Bonga y del portal de revistas OJS.'));
c.push(P([run('Distintivos: ', { bold: true }), run('Registro de Editoriales Nacionales · Alta Calidad (Resolución 094 de 2014) · Acceso abierto')]));
c.push(button('Conocer el sello editorial', 'https://www.unisimon.edu.co/iie/index/sello-editorial-unisimon/1664'));
c.push(H4('Hitos del sello'));
c.push(table(['Año', 'Hito'], [
  ['2013', 'Política Editorial OT-IN-01 (versión 2 vigente desde el 29-08-2013).'],
  ['2013', 'Participación en la Convocatoria 693 de Colciencias – Registro de Editoriales Nacionales.'],
  ['2014', 'Reconocimiento de Alta Calidad – Resolución 094 de 2014.'],
  ['2026', '3.ª cohorte de la Escuela de Editoras y Editores.'],
], [15, 85]));
c.push(H4('Tarjetas de acceso a las áreas'));
c.push(table(['Área', 'Texto de la tarjeta'], [
  ['Equipo de Publicaciones', 'Jefatura, coeditores de las cinco revistas y apoyo editorial.'],
  ['Libros y capítulos de libros', '534 libros y 1.726 capítulos publicados.'],
  ['Revistas científicas y académicas', '5 revistas científicas (Publindex; 3 en Scopus) y 3 revistas académicas.'],
  ['Escuela de editores', '58 horas de formación y pasantía editorial.'],
  ['Certificaciones', '27 plantillas alineadas al modelo Minciencias 2024.'],
], [35, 65]));

// ----- H3 Equipo -----
c.push(H3('Equipo de Publicaciones'));
c.push(P('Un equipo interdisciplinario acompaña a investigadores y facultades en todo el ciclo editorial: gestión de revistas, edición de libros, administración de la plataforma OJS, marcación XML JATS, diagramación, analítica bibliométrica y gestión de la producción científica bajo los lineamientos de Minciencias.'));
c.push(bullet('Cada revista institucional cuenta con un(a) coeditor(a) del Departamento que acompaña al editor(a) en la gestión editorial.'));
c.push(bullet('Enlaces por facultad para revisión, traducción, APC y reporte de artículos.'));
c.push(bullet('Mentorías a grupos de investigación (GrupLAC/CvLAC).'));
c.push(P('Presentación visual: Jefatura y Apoyo editorial con retrato circular; coeditores en tarjetas de retrato con una banda de color con el nombre de la revista, seguida del rol, nombre, perfil y editor(a) de la revista (ver prototipo).'));
c.push(H4('Jefatura'));
c.push(table(['Nombre', 'Cargo', 'Perfil', 'Foto'], [
  ['Jorge Navarro Beltrán', 'Jefe del Departamento de Publicaciones', 'Ingeniero Industrial y Magíster en Salud Pública.', 'jorge-navarro-c.jpg'],
], [26, 28, 28, 18]));
c.push(H4('Coeditores de las revistas institucionales'));
c.push(table(['Revista (área)', 'Coeditor(a) – Departamento de Publicaciones', 'Perfil', 'Editor(a) de la revista', 'Foto'], [
  ['Justicia (Derecho)', 'Wendy Almendrales Escobar', [P([pend('Perfil por confirmar')], { after: 40 })], 'Sandra Viviana Díaz Rincón', [P([pend('Por enviar')], { after: 40 })]],
  ['Educación y Humanismo (Ciencias de la Educación)', 'Jair Padilla García', 'Ingeniero Industrial; estudiante de Maestría en Ciencia de Datos.', 'Yurley Karime Hernández Peña', 'jair-padilla.jpg'],
  ['Psicogente (Psicología)', 'Heidy Borja Vargas', 'Psicóloga con especialización en Inteligencia Artificial.', 'Wilmar Pineda', 'heidy-borja.jpg'],
  ['Desarrollo Gerencial (Economía y Negocios)', 'Yessica Muñoz Reyes', 'Magíster en Gerencia del Talento Humano. Investigadora Junior (Minciencias).', 'Ronald Prieto Pulido', 'yessica-munoz.jpg'],
  ['Investigación e Innovación en Ingenierías (Ingenierías y Tecnologías)', 'Alejandro Corrales Barrera', 'Ingeniero Mecánico; gestión editorial, rebranding y diagramación.', 'Paola Sánchez Sánchez', 'alejandro-corrales.jpg'],
], [22, 19, 25, 18, 16]));
c.push(H4('Apoyo editorial'));
c.push(table(['Nombre', 'Rol', 'Perfil', 'Foto'], [
  ['Sharon Benítez Ayala', 'Administradora OJS · XML JATS', 'Ingeniera de Sistemas; XML JATS y automatización editorial.', 'sharon-benitez-c.jpg'],
  ['Juan Fernando Piñeres Pérez', 'Comunicador Social', 'Comunicador Social; Magíster en Estudios Comparados de Literatura, Arte y Pensamiento.', 'juan-fernando-pineres-c.jpg'],
], [24, 22, 34, 20]));
c.push(source('Fuente: directorio del equipo y módulo de revistas de PubManager; perfiles y fotografías del brochure de la Escuela de Editoras y Editores. Fotos en assets/equipo/.'));

// ----- H3 Libros -----
c.push(H3('Libros y capítulos de libros'));
c.push(P('Publicamos libros resultado de investigación, pedagógico-didácticos, institucionales y obras literarias. Los libros de investigación son evaluados por al menos tres pares expertos —dos externos a la Universidad— y aprobados por el Comité Institucional de Publicaciones antes de su producción con ISBN y divulgación en Bonga.'));
c.push(metrics([['534', 'libros publicados'], ['1.726', 'capítulos de libro'], ['493', 'con sello propio'], ['41', 'coediciones / editoriales externas'], ['330', 'de nuevo conocimiento'], ['533', 'con enlace en repositorio']]));
c.push(H4('Libros publicados por año (2014–2026)'));
const years = [[2014, 23], [2015, 50], [2016, 28], [2017, 104], [2018, 107], [2019, 32], [2020, 60], [2021, 26], [2022, 26], [2023, 24], [2024, 8], [2025, 15], [2026, 1]];
c.push(new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ children: years.map(([y]) => cell(String(y), { bold: true, color: 'FFFFFF', fill: GREEN, size: 18 })) }),
    new TableRow({ children: years.map(([, v]) => cell(String(v), { size: 20 })) }),
  ],
}));
c.push(H4('Formato de publicación'));
c.push(table(['Formato', 'Libros'], [['Digital', '383'], ['Impreso y digital', '69'], ['Impreso', '75']], [70, 30]));
c.push(button('Ver colección en Bonga', 'https://bonga.unisimon.edu.co/handle/20.500.12442/5769'));
c.push(source('Fuente: PubManager – base de libros y capítulos, corte octubre de 2026.'));

// ----- H3 Revistas -----
c.push(H3('Revistas científicas y académicas'));
c.push(P('Cinco revistas científicas activas, gestionadas en Open Journal Systems con evaluación por pares. El equipo editorial acompaña su indexación en Publindex y Scopus, la marcación XML JATS y la visibilidad en bases de datos. Además, tres revistas académicas de facultad divulgan el trabajo formativo e investigativo de estudiantes y profesores.'));
c.push(metrics([['5', 'revistas científicas activas'], ['4', 'en categoría B Publindex 2026'], ['1', 'en categoría C Publindex 2026'], ['3', 'indexadas en Scopus (2025)'], ['3', 'revistas académicas de facultad']]));
c.push(space());
c.push(H4('Revistas científicas'));
c.push(table(['Revista', 'Área', 'ISSN', 'Indexación', 'Enlace'], [
  ['Justicia', 'Derecho', '0124-7441 / e-ISSN 2590-4566', 'Publindex B 2026 · Scopus Q2 2025 · SJR 0,296', P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/justicia')], { after: 0 })],
  ['Educación y Humanismo', 'Ciencias de la Educación', '0124-2121 / e-ISSN 2665-2420', 'Publindex B 2026 · Scopus Q3–Q4 2025 · SJR 0,137', P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/educacion')], { after: 0 })],
  ['Psicogente', 'Psicología', '0124-0137 / e-ISSN 2027-212X', 'Publindex C 2026 · Scopus Q4 2025', P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/psicogente')], { after: 0 })],
  ['Desarrollo Gerencial', 'Economía y Negocios', '2145-5147', 'Publindex B 2026', P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/desarrollogerencial')], { after: 0 })],
  ['Investigación e Innovación en Ingenierías', 'Ingenierías y Tecnologías', 'e-ISSN 2344-8652', 'Publindex B 2026 · Google Scholar h17 · Acceso abierto diamante, sin APC', P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/innovacioning')], { after: 0 })],
], [22, 17, 22, 27, 12]));
c.push(source('Fuente: PubManager – módulo de revistas e indexaciones.'));
c.push(H4('Revistas académicas'));
c.push(table(['Revista', 'Facultad / área', 'Descripción para la tarjeta', 'ISSN y enlace'], [
  ['Investigación y Desarrollo en TIC', 'Ingeniería y Tecnología', 'Estructura científica y metodológica, integral y flexible, para que estudiantes de las disciplinas de Ingeniería y Tecnología den cuenta de los resultados de su proceso de formación para la investigación.', [P('e-ISSN 2216-1570', { after: 40 }), P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/identic')], { after: 0 })]],
  ['Liderazgo Estratégico', 'Administración y Negocios', 'Medio de divulgación de la Facultad de Administración y Negocios que articula el trabajo de los programas de pregrado y posgrado en la disciplina de Negocios y Management de las ciencias económicas, administrativas y contables.', [P('ISSN 2463-0217', { after: 40 }), P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/liderazgo')], { after: 0 })]],
  ['Tejidos Sociales', 'Ciencias Jurídicas y Sociales', 'Revista académica (virtual) que impulsa el intercambio de nuevo conocimiento en ciencias sociales mediante artículos originales, artículos de revisión y ensayos. Dirigida a profesores, investigadores y estudiantes.', [P('e-ISSN 2539-262X', { after: 40 }), P([link('Visitar', 'https://revistas.unisimon.edu.co/index.php/tejsociales')], { after: 0 })]],
], [22, 18, 44, 16]));
c.push(source('Fuente: portal de revistas revistas.unisimon.edu.co (sección Revistas académicas). ISSN suministrados por el Departamento de Publicaciones (versiones en línea).'));

// ----- H3 Escuela -----
c.push(H3('Escuela de Editoras y Editores'));
c.push(P([run('“Donde el saber también se edita.” ', { italics: true }), run('Una apuesta del Departamento de Publicaciones por consolidar una comunidad editorial de relevo: juvenil, diversa, rigurosa y comprometida con la ética en la investigación y la democratización del conocimiento.')]));
c.push(P('Curso teórico-práctico e híbrido que forma en tipologías de publicación, gestión editorial, normas de citación, ética, inteligencia artificial, XML JATS, OJS, bibliometría, diagramación y categorización de la producción científica, con prácticas supervisadas en las revistas de la Universidad.'));
c.push(bullet('Dirigido a estudiantes de pregrado de 4.º a 7.º semestre certificados como semillero de investigación (categoría Amateur).'));
c.push(bullet('Otorga 30 puntos para la certificación como Semillero de Investigación Élite.'));
c.push(bullet([run('Constancia como '), run('Gestor de Procesos Editoriales', { bold: true }), run(' (mínimo 80 % de asistencia + 30 horas de prácticas).')]));
c.push(space());
c.push(metrics([['3.ª', 'cohorte (2026–2027)'], ['58', 'horas: 28 teóricas + 30 de pasantía'], ['14', 'sesiones (12 virtuales, 2 presenciales)'], ['9', 'docentes del Dpto. de Publicaciones y editores']]));
c.push(P([run('Botón: ', { bold: true, size: 20, color: '6B6F6C' }), run('Formulario de inscripción'), pend('enlace del formulario')], { after: 120 }));
c.push(H4('Contenido programático · jueves de 3:30 a 5:30 p.m.'));
c.push(table(['Fecha', 'Sesión', 'Docente', 'Modalidad'], [
  ['6 ago 2026', 'Introducción a la edición científica', 'Jorge Navarro Beltrán', 'Virtual'],
  ['13 ago', '¿Cómo se escribe un artículo?', 'Juan Fernando Piñeres Pérez', 'Virtual'],
  ['20 ago', 'Gestión editorial en revistas científicas', 'Jair Padilla García', 'Virtual'],
  ['27 ago', 'Normas de publicación (APA, IEEE)', 'Yessica Muñoz Reyes', 'Virtual'],
  ['3 sep', 'Ética en la investigación', 'Yessica Muñoz Reyes', 'Virtual'],
  ['10 sep', 'Inteligencia artificial', 'Heidy Borja Vargas', 'Virtual'],
  ['17 sep', 'Marcación en XML JATS (parte 1)', 'Sharon Benítez Ayala', 'Virtual'],
  ['24 sep', 'Marcación en XML JATS (parte 2)', 'Sharon Benítez Ayala', 'Presencial'],
  ['1 oct', 'Plataforma OJS', 'Alejandro Corrales Barrera', 'Presencial'],
  ['15 oct', 'Bibliometría', 'Heidy Borja Vargas', 'Virtual'],
  ['22 oct', 'Bases de datos (Scopus, WoS)', 'Biblioteca', 'Virtual'],
  ['29 oct', 'Huella digital e identificadores únicos', 'Juan Manuel Arenas P.', 'Virtual'],
  ['5 nov', 'Diagramación', 'Alejandro Corrales Barrera', 'Virtual'],
  ['12 nov', 'Categorización de producción científica (Minciencias 2024)', 'Danilo Valenzuela L.', 'Virtual'],
  ['9 feb – 25 may 2027', 'Prácticas editoriales supervisadas (30 h)', 'Mentores de las revistas', 'Presencial'],
], [18, 42, 26, 14]));
c.push(source('Fuente: Brochure Escuela de Editoras y Editores V2 (3.ª cohorte).'));

// ----- H3 Certificaciones -----
c.push(H3('Certificaciones de productos'));
c.push(P('El servicio de certificación de productos resultado de investigación (libros y capítulos de libro) está abierto de manera permanente. Los productos deben cumplir los requisitos de existencia y calidad del modelo de medición de grupos e investigadores vigente y estar registrados en CvLAC y GrupLAC.'));
c.push(P('El aval de productos se realiza trimestralmente, en coordinación con la Dirección de Investigación y la Oficina de Metri-k, una vez verificada la vinculación de los productos a los GrupLAC.'));
c.push(metrics([['27', 'plantillas de certificación', 'Modelo Minciencias 2024'], ['10', 'categorías de certificado'], ['Permanente', 'recepción de solicitudes']]));
c.push(H4('Tipos de certificado que expedimos'));
['Validación de tipología (libro y capítulo)', 'Créditos y financiación', 'Evaluación por pares externos', 'Edición de revistas o libros (ERL)', 'Publicación no especializada (cartilla, manual, boletín)', 'Libro y capítulo de divulgación', 'Libro de formación (LIB_FOR)', 'Manuales y guías especializadas', 'Boletines divulgativos institucionales', 'Certificado editorial externa', 'Declaración de autor'].forEach((t) => c.push(bullet(t)));
c.push(button('Solicitar certificación', 'https://metrik.unisimon.edu.co/certificaciones'));
c.push(P([run('Sede Cúcuta: libros y capítulos se gestionan en publicacionescucuta@unisimon.edu.co.', { size: 20 })]));
c.push(source('Fuente: Lineamiento de publicación 2026 y catálogo de plantillas de PubManager.'));

// ===== H2 Proceso editorial =====
c.push(...H2('Así publicamos con Ediciones Unisimón', 'Proceso editorial'));
c.push(P('Rutas basadas en la Política Editorial OT-IN-01 de la Universidad. En la web se presentan como pestañas: «Libros» y «Artículos en revistas».'));
c.push(H4('Ruta para libros'));
c.push(table(['#', 'Etapa', 'Descripción'], [
  ['1', 'Propuesta editorial', 'Los autores presentan el manuscrito con el Formato de Presentación de Proyectos Editoriales ante el comité de su centro, programa o dependencia.'],
  ['2', 'Evaluación editorial', 'Se revisa la calidad estructural y de forma del libro según los lineamientos editoriales.'],
  ['3', 'Evaluación académica', 'Al menos tres pares expertos, dos externos a la Universidad, emiten su dictamen en el formato institucional.'],
  ['4', 'Comité Institucional', 'El Comité Institucional de Publicaciones realiza la evaluación editorial, económica y ético-legal.'],
  ['5', 'Ajustes y cesión de derechos', 'Los autores incorporan las correcciones y firman la cesión de derechos patrimoniales de autor.'],
  ['6', 'Aval de Rectoría', 'La Oficina de Rectoría recibe el acta del Comité, las evaluaciones y el texto para su autorización.'],
  ['7', 'Producción', 'Corrección de estilo, diagramación, ISBN, catalogación en la fuente y depósito legal.'],
  ['8', 'Divulgación', 'Publicación en acceso abierto en el repositorio Bonga y difusión institucional.'],
], [6, 26, 68]));
c.push(H4('Ruta para artículos en revistas'));
c.push(table(['#', 'Etapa', 'Descripción'], [
  ['1', 'Postulación', 'El autor envía su artículo a la revista con la carta de presentación, hoja de vida y declaración de conflictos de intereses.'],
  ['2', 'Preselección', 'El equipo editorial verifica el cumplimiento de requisitos y el ajuste a las normas de la revista.'],
  ['3', 'Arbitraje', 'Pares evaluadores emiten un dictamen cuantitativo (1 a 5) y cualitativo (aceptar, aceptar con sugerencias, revisión amplia o rechazar).'],
  ['4', 'Ajustes del autor', 'El autor responde a las recomendaciones en un plazo no mayor a 10 días hábiles.'],
  ['5', 'Aceptación', 'El Comité Editorial y el Editor deciden la aceptación y el número de publicación.'],
  ['6', 'Corrección de estilo', 'Revisión de coherencia, cohesión, adecuación y corrección en español y luego en inglés.'],
  ['7', 'Revisión final', 'Los autores dan su visto bueno a la versión editada y diagramada.'],
  ['8', 'Publicación y divulgación', 'Publicación en OJS en acceso abierto, actualización en bases e índices y notificación a autores.'],
], [6, 26, 68]));
c.push(source('Fuente: Política Editorial OT-IN-01, versión 2 (Vicerrectoría de Investigación, Extensión e Innovación – Departamento de Publicaciones).'));

// ===== H2 Políticas y documentos =====
c.push(...H2('Políticas editoriales y documentos', 'Documentos para publicaciones'));
c.push(P('Consulte la normativa, los lineamientos y las guías que orientan la publicación de libros, capítulos y artículos en la Universidad Simón Bolívar.'));
c.push(table(['Documento', 'Descripción', 'Acción / archivo'], [
  ['Política Editorial (OT-IN-01)', 'Comités, reglamento y rutas de publicación · 32 págs.', 'Descargar archivo · politica-editorial.pdf'],
  ['Lineamientos editoriales para la presentación de libros', 'Formato, resumen, citación APA 7 y extensión · 12 págs.', 'Descargar archivo · lineamientos-editoriales.pdf'],
  ['Lineamiento de publicación 2026', 'Integridad, afiliación, APC y certificaciones · 7 págs.', 'Descargar archivo · lineamiento-de-publicacion-2026.pdf'],
  [P([run('Constitución del Comité Editorial')], { after: 0 }), P([run('Responsabilidades del comité.'), pend('verificar vigencia, documento de 2024')], { after: 0 }), 'Descargar archivo · comite-editorial.pdf'],
  ['Protocolo para la selección de revistas', 'Verificación de reputación e idoneidad', P([link('metrik.unisimon.edu.co/protocolo', 'https://metrik.unisimon.edu.co/protocolo')], { after: 0 })],
  ['Guía de afiliación institucional', 'Cómo declarar la afiliación Unisimón', P([link('unisimon.edu.co/iie/afiliacion', 'https://www.unisimon.edu.co/iie/afiliacion')], { after: 0 })],
], [32, 40, 28]));
c.push(P([pend('enlaces a los formatos de la Política Editorial: Presentación de Propuesta Editorial, Hoja de Vida, Cesión de Derechos Patrimoniales y Declaración de Conflictos de Intereses, Carta de Presentación de Artículo y Formatos de Arbitraje')], { after: 160 }));
c.push(source('Los archivos PDF se entregan en la carpeta assets/docs del prototipo.'));

// ===== H2 Evento anual =====
c.push(...H2('Jornada de Fortalecimiento de la Investigación y Divulgación Científica', 'Evento anual'));
c.push(P([run('La 3.ª edición —'), run('Integridad, Desarrollo Tecnológico y Apropiación Social', { italics: true }), run('— fortaleció las competencias investigativas de profesores y administrativos con ponencias sobre propiedad intelectual, innovación, divulgación pública de la CTeI, ética de la publicación y verificación de revistas científicas.')]));
c.push(P([run('Datos: ', { bold: true }), run('18 y 19 de junio · Microsoft Teams · 9 horas certificadas · Organizan: Vicerrectoría de Investigación, Extensión e Innovación, Departamento de Publicaciones y Departamento de Pedagogía (CEAEP).')]));
c.push(metrics([['200', 'asistentes'], ['176', 'inscritos'], ['169', 'certificados']]));
c.push(space());
c.push(metrics([['19,56', 'promedio evaluación de conocimientos (de 20)'], ['91,7 %', 'satisfacción general', 'Muy satisfecho + satisfecho'], ['91,8 %', 'recomendaría la jornada']]));
c.push(H4('Perfil de los asistentes'));
c.push(table(['Indicador', 'Valor'], [
  ['Profesores', '84,5 %'], ['Administrativos', '15,5 %'], ['Sede Barranquilla / Cúcuta', '79 % / 21 %'],
  ['Pertenecen a un grupo de investigación', '73 %'], ['Asistencia día 1 / día 2', '179 / 174'],
], [70, 30]));
c.push(H4('Ponencias y satisfacción («muy satisfecho»)'));
c.push(table(['Ponencia', 'Ponente', 'Muy satisfecho'], [
  ['Propiedad intelectual, innovación y desarrollo tecnológico: estrategias para la generación de nuevo conocimiento', 'MSc. Fredy Sánchez-Merino', '72,2 %'],
  ['La Nueva Biblioteca: IA, innovación y nuevas experiencias', 'MSc. Mario Bonfante-Aldana', '63,9 %'],
  ['El alcance interdisciplinar del desarrollo tecnológico y la innovación', 'Abg. Kevin Pérez-Díaz', '64,9 %'],
  ['Ciencia que Conecta: lineamientos y perspectivas de la Divulgación Pública de la CTeI', 'Esp. Luis Varela-Ariza', '70,1 %'],
  ['Más allá de la mala conducta: retractaciones y déficits de alfabetización ética en el sistema de publicación científica', 'PhD (c) Heiner Mercado-Percia', '71,1 %'],
  ['Presentación del protocolo para la verificación de la reputación e idoneidad de revistas científicas y la detección de malas prácticas editoriales', 'Esp. Heidy Borja-Vargas', '70,1 %'],
], [56, 28, 16]));
c.push(source('Fuente: Agenda y Estadísticas de la 3.ª Jornada de Fortalecimiento (encuesta de satisfacción: 98 respuestas).'));

// ===== H2 Cifras de valor =====
c.push(...H2('El impacto de nuestro sello en números', 'Cifras de valor'));
c.push(metrics([['+534', 'Libros publicados', '493 con sello propio y 41 coediciones'], ['+1.726', 'Capítulos de libro'], ['+3.423', 'Autores registrados'], ['5', 'Revistas científicas', '4 en B y 1 en C Publindex 2026 · 3 en Scopus']]));
c.push(source('Fuente: PubManager – Departamento de Publicaciones, corte octubre de 2026.'));

// ===== H2 Acceso abierto =====
c.push(...H2('Ciencia abierta para todos', 'Acceso abierto'));
c.push(P([run('La divulgación de nuestras revistas sigue la política de acceso abierto ('), run('Open Access', { italics: true }), run(') establecida en la Política Editorial de la Universidad Simón Bolívar. Nuestros libros se divulgan en el repositorio institucional Bonga.')]));
c.push(table(['Bloque', 'Texto'], [
  ['Revistas en OJS', 'Los números se publican en Open Journal Systems y se actualizan en las bases e índices donde está incluida cada revista.'],
  ['533 libros en repositorio', '533 de los 534 libros publicados cuentan con enlace en el repositorio institucional; 383 en formato digital.'],
  ['Acceso abierto diamante', 'La revista Investigación e Innovación en Ingenierías opera en acceso abierto diamante, sin cobro de APC y con evaluación doble ciego.'],
], [30, 70]));
c.push(P([pend('licencias Creative Commons por revista/libro y si las demás revistas cobran o no APC')], { after: 160 }));

// ===== H2 IRAKA =====
c.push(...H2('IRAKA', 'Revista de divulgación'));
c.push(P('Revista de divulgación de la Universidad Simón Bolívar.'));
c.push(P([pend('texto introductorio de IRAKA')]));
c.push(button('Visitar IRAKA', 'https://iraka.unisimon.edu.co/'));

// ===== H2 Revistas / Libros de la universidad =====
c.push(...H2('Revistas de la universidad'));
c.push(P('Portal OJS con las cinco revistas científicas (Justicia, Psicogente, Educación y Humanismo, Desarrollo Gerencial e Investigación e Innovación en Ingenierías) y las tres revistas académicas (Investigación y Desarrollo en TIC, Liderazgo Estratégico y Tejidos Sociales).'));
c.push(button('revistas.unisimon.edu.co', 'https://revistas.unisimon.edu.co/'));
c.push(...H2('Libros de la universidad'));
c.push(P('Repositorio institucional Bonga: libros de investigación, textos académicos, divulgación y creación literaria, con ISBN y metadatos normalizados.'));
c.push(button('bonga.unisimon.edu.co', 'https://bonga.unisimon.edu.co/'));

// ===== H2 FAQs =====
c.push(...H2('Preguntas frecuentes', 'FAQs'));
c.push(P([run('Redactadas a partir de las políticas y lineamientos institucionales. ', { italics: true, color: '6B6F6C', size: 20 }), pend('revisión y aprobación del Departamento')]));
const faqs = [
  ['¿Cómo solicito un certificado o aval para mi libro o capítulo?', 'Las certificaciones se gestionan a través de metrik.unisimon.edu.co/certificaciones. En la sede Cúcuta, los libros y capítulos se tramitan por publicacionescucuta@unisimon.edu.co.'],
  ['¿Qué requisitos debe cumplir mi producto para ser certificado?', 'Debe cumplir los requisitos de existencia y calidad del modelo de medición de grupos e investigadores vigente de Minciencias y estar registrado y actualizado en CvLAC y GrupLAC.'],
  ['¿Cómo publico un libro con el sello Ediciones Unisimón?', 'Presente su propuesta con el Formato de Presentación de Proyectos Editoriales ante el comité de su centro, programa o dependencia. Los libros de investigación son evaluados por al menos tres pares (dos externos), luego por el Comité Institucional de Publicaciones y finalmente avalados por Rectoría.'],
  ['¿Qué formato deben tener los capítulos de libro?', 'Letra Book Antiqua 12, interlineado 1,5, márgenes de 2,5 cm y extensión de 20 a 25 páginas. Incluya título en español e inglés, ORCID y afiliación de los autores, resumen de máximo 300 palabras, 3 a 6 palabras clave y referencias en APA 7.ª edición.'],
  ['¿Cuál es el porcentaje máximo de similitud permitido?', 'Según el Lineamiento de publicación 2026, los artículos pasan por revisión de originalidad y el resultado no podrá superar el 20 % de similitud.'],
  ['¿La Universidad apoya la revisión, traducción o pago de APC?', 'Sí, para investigadores activos con vinculación laboral que figuren como autor principal y con afiliación principal a la Universidad, en revistas vigentes de Web of Science/JCR o Scopus/SJR ubicadas en cuartiles Q1 y Q2.'],
  ['¿Cómo verifico que una revista es confiable antes de postular?', 'Compare la URL de la revista con la registrada en Scopus, WoS, Scimago o JCR y consulte el protocolo para la selección de revistas (metrik.unisimon.edu.co/protocolo). También puede solicitar apoyo técnico al Departamento de Publicaciones.'],
  ['¿Cuánto tiempo tengo para responder a los evaluadores de una revista?', 'La Política Editorial establece un plazo no mayor a 10 días hábiles cada vez que el autor recibe retroalimentación de los árbitros, el Comité Editorial o el Editor.'],
  ['¿Quién puede inscribirse en la Escuela de Editoras y Editores?', 'Estudiantes de pregrado de la Universidad Simón Bolívar entre 4.º y 7.º semestre, certificados como semillero de investigación en categoría Amateur, con interés en la lectura y escritura científica y disponibilidad para las sesiones.'],
  ['¿Dónde consulto los libros y revistas publicados?', 'Los libros están en el repositorio Bonga (bonga.unisimon.edu.co) y las revistas en el portal revistas.unisimon.edu.co.'],
];
faqs.forEach(([q, a], i) => {
  c.push(P([run(`${i + 1}. ${q}`, { bold: true, color: GREEN })], { after: 40 }));
  c.push(P(a, { after: 160 }));
});
c.push(H4('Tarjeta de contacto'));
c.push(P([run('Departamento de Publicaciones', { bold: true })], { after: 20 }));
c.push(P('Vicerrectoría de Investigación, Extensión e Innovación', { after: 20 }));
c.push(P('Carrera 54 No. 64-223, Sede Posgrados, Barranquilla', { after: 20 }));
c.push(P('dptopublicaciones@unisimon.edu.co', { after: 20 }));
c.push(P([run('Tel. 3160921 ext. 1002'), pend('confirmar teléfono y extensión')]));

// ===== Footer =====
c.push(...H2('Footer'));
c.push(P('Se conserva el pie de página institucional del sitio (Campus Barranquilla y Cúcuta, enlaces de interés, La Universidad, Links rápidos, Portales y «BARRANQUILLA Y CÚCUTA - COLOMBIA | VIGILADA MINEDUCACIÓN»). En «Links rápidos» se sugiere agregar: Proceso editorial, Políticas editoriales, Certificaciones y Preguntas frecuentes; y en «Portales»: IRAKA y Metri-k.'));

// ===== Anexo: pendientes =====
c.push(...H2('Anexo 1 · Información pendiente y observaciones'));
[
  'Enlace del formulario de inscripción a la Escuela de Editoras y Editores.',
  'Enlaces a los formatos de la Política Editorial (propuesta editorial, hoja de vida, cesión de derechos, carta de presentación, arbitraje).',
  'Licencias Creative Commons y política de APC de cada revista.',
  'Texto introductorio de IRAKA.',
  'Teléfono y extensión vigentes del Departamento.',
  'Vigencia del certificado del Comité Editorial (2024).',
  'Directorio del sitio de prueba: actualizar «Jefe de Publicaciones» a Jorge Navarro Beltrán.',
  'Las imágenes del prototipo son ilustrativas; se recomienda reemplazarlas por fotografías institucionales.',
  'Equipo: fotografía y perfil profesional de Wendy Almendrales Escobar (coeditora de Justicia).',
  'Equipo: las fotos actuales se tomaron del brochure de la Escuela (baja resolución); enviar originales en alta resolución de las 7 personas.',
].forEach((t) => c.push(bullet(t)));

// ===== Anexo 2: recursos =====
c.push(...H2('Anexo 2 · Recursos para cargar en el sitio'));
c.push(P('Todos los archivos se encuentran en la carpeta assets/ del prototipo adjunto.'));
c.push(H4('Documentos PDF (sección Políticas editoriales y documentos)'));
c.push(table(['Archivo', 'Documento', 'Botón'], [
  ['assets/docs/politica-editorial.pdf', 'Política Editorial (OT-IN-01)', 'Descargar archivo'],
  ['assets/docs/lineamientos-editoriales.pdf', 'Lineamientos editoriales para la presentación de libros', 'Descargar archivo'],
  ['assets/docs/lineamiento-de-publicacion-2026.pdf', 'Lineamiento de publicación 2026', 'Descargar archivo'],
  [[P([run('assets/docs/comite-editorial.pdf')], { after: 40 })], [P([run('Constitución del Comité Editorial'), pend('verificar vigencia')], { after: 40 })], 'Descargar archivo'],
], [40, 40, 20]));
c.push(H4('Imágenes'));
c.push(table(['Archivo', 'Uso en la página', 'Observación'], [
  ['assets/hero.jpg', 'Banner principal (H1) y tarjeta Equipo de Publicaciones', 'Ilustrativa; reemplazar'],
  ['assets/libros.jpg', 'Tarjeta Libros y capítulos; bloque Libros de la universidad', 'Ilustrativa; reemplazar'],
  ['assets/revistas.jpg', 'Tarjeta Revistas; bloque Revistas de la universidad', 'Ilustrativa; reemplazar'],
  ['assets/escuela.jpg', 'Tarjeta Escuela de editores', 'Ilustrativa; reemplazar'],
  ['assets/certificaciones.jpg', 'Tarjeta Certificaciones', 'Ilustrativa; reemplazar'],
  ['assets/jornada-portada.png', 'Evento anual (portada de la programación de la Jornada)', 'Pieza oficial del evento'],
  ['assets/equipo/*.jpg (14 archivos)', 'Equipo de Publicaciones: retrato 4:5 (nombre.jpg) y circular (nombre-c.jpg) de 7 personas', 'Fotos reales del brochure; reemplazar por alta resolución'],
], [32, 46, 22]));
c.push(H4('Enlaces externos'));
c.push(table(['Enlace', 'Dónde se usa'], [
  ['https://www.unisimon.edu.co/iie/index/sello-editorial-unisimon/1664', 'Sello editorial – botón «Conocer el sello editorial»'],
  ['https://bonga.unisimon.edu.co/', 'Banner, Libros de la universidad, FAQs'],
  ['https://bonga.unisimon.edu.co/handle/20.500.12442/5769', 'Libros y capítulos – «Ver colección en Bonga»'],
  ['https://revistas.unisimon.edu.co/', 'Banner, Revistas de la universidad, FAQs'],
  ['https://revistas.unisimon.edu.co/index.php/justicia', 'Revista Justicia'],
  ['https://revistas.unisimon.edu.co/index.php/educacion', 'Revista Educación y Humanismo'],
  ['https://revistas.unisimon.edu.co/index.php/psicogente', 'Revista Psicogente'],
  ['https://revistas.unisimon.edu.co/index.php/desarrollogerencial', 'Revista Desarrollo Gerencial'],
  ['https://revistas.unisimon.edu.co/index.php/innovacioning', 'Revista Investigación e Innovación en Ingenierías'],
  ['https://metrik.unisimon.edu.co/certificaciones', 'Certificaciones – «Solicitar certificación», FAQs'],
  ['https://metrik.unisimon.edu.co/protocolo', 'Políticas y documentos, FAQs'],
  ['https://www.unisimon.edu.co/iie/afiliacion', 'Políticas y documentos – Guía de afiliación'],
  ['https://iraka.unisimon.edu.co/', 'IRAKA'],
  ['mailto:dptopublicaciones@unisimon.edu.co', 'Tarjeta de contacto'],
  ['mailto:publicacionescucuta@unisimon.edu.co', 'Certificaciones (sede Cúcuta), FAQs'],
], [55, 45]));

// ---------- documento ----------
const doc = new Document({
  creator: 'Departamento de Publicaciones – Universidad Simón Bolívar',
  title: 'Ediciones Unisimón – Contenido web',
  styles: { default: { document: { run: { font: FONT, size: 22 } } } },
  sections: [{
    properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: 'Ediciones Unisimón · Contenidos para el sitio web · Página ', font: FONT, size: 16, color: '8A8F8B' }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '8A8F8B' }),
      ] })] }),
    },
    children: c,
  }],
});

const out = path.join(__dirname, '..', 'web-ediciones-unisimon', 'Contenido_Web_Ediciones_Unisimon.docx');
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('ok', out, buf.length); });
