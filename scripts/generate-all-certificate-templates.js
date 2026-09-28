const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.join(__dirname, '..');
const possibleMembretePaths = [
  'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Certificados\\MEMBRETE USB.docx',
  path.join(rootDir, '..', 'Certificados', 'MEMBRETE USB.docx'),
  path.join(rootDir, 'Certificados', 'MEMBRETE USB.docx')
];

const membretePath = possibleMembretePaths.find(p => fs.existsSync(p));
if (!membretePath) {
  console.error('MEMBRETE USB.docx not found!');
  process.exit(1);
}
console.log('Using Membrete source:', membretePath);

const targetDirs = [
  path.join(rootDir, 'public', 'templates'),
  'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Certificados'
];

const mZip = new PizZip(fs.readFileSync(membretePath));
const header1Xml = mZip.file('word/header1.xml').asText();
const header1RelsXml = mZip.file('word/_rels/header1.xml.rels').asText();
const membreteImage = mZip.file('word/media/image1.jpeg').asNodeBuffer();

console.log('Membrete image size:', membreteImage.length, 'bytes');

// Function to create a clean XML paragraph
function p(text, opts = {}) {
  const { align = 'both', bold = false, sz = '22', spaceAfter = '160', spaceBefore = '0' } = opts;
  const jc = align === 'center' ? 'center' : (align === 'right' ? 'right' : 'both');
  const bTag = bold ? '<w:b/><w:bCs/>' : '';
  return `<w:p><w:pPr><w:jc w:val="${jc}"/><w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="276" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="es-CO"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Roboto" w:hAnsi="Roboto"/>${bTag}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="es-CO"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// Function to generate standard signature block
function signatureBlock(type) {
  if (type === 'jefe') {
    return [
      p('', { spaceAfter: '400' }),
      p('__________________________________', { align: 'center', spaceAfter: '80' }),
      p('JORGE ARMANDO NAVARRO BELTRÁN', { align: 'center', bold: true, spaceAfter: '40' }),
      p('C.C. 1.045.683.896', { align: 'center', spaceAfter: '40' }),
      p('Jefe del Departamento de Publicaciones', { align: 'center', bold: true, spaceAfter: '40' }),
      p('Universidad Simón Bolívar', { align: 'center', spaceAfter: '0' })
    ].join('');
  } else {
    return [
      p('', { spaceAfter: '400' }),
      p('__________________________________', { align: 'center', spaceAfter: '80' }),
      p('LUIS EDUARDO ORTIZ OSPINO', { align: 'center', bold: true, spaceAfter: '40' }),
      p('C.C. 72.002.980', { align: 'center', spaceAfter: '40' }),
      p('Vicerrector de Investigación, Extensión e Innovación', { align: 'center', bold: true, spaceAfter: '40' }),
      p('Universidad Simón Bolívar', { align: 'center', spaceAfter: '0' })
    ].join('');
  }
}

function buildDocumentXml(bodyParagraphsXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">
<w:body>
${bodyParagraphsXml}
<w:sectPr w:rsidR="00BF782F"><w:headerReference w:type="default" r:id="rId6"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>
</w:body></w:document>`;
}

// Function to create a new template from MEMBRETE USB.docx
function createTemplateFromMembrete(filename, bodyXml) {
  const zip = new PizZip(fs.readFileSync(membretePath));
  const fullDocXml = buildDocumentXml(bodyXml);
  zip.file('word/document.xml', fullDocXml);
  
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  
  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      const outPath = path.join(dir, filename);
      fs.writeFileSync(outPath, buf);
      console.log(`[Created] ${outPath}`);
    }
  }
}

// Function to update an existing template with official letterhead & corrected texts
function updateExistingTemplateWithMembrete(filename, options = {}) {
  for (const dir of targetDirs) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) continue;

    const zip = new PizZip(fs.readFileSync(filePath));

    // 1. Inject Membrete image
    zip.file('word/media/image1.jpeg', membreteImage);

    // 2. Inject Membrete header1.xml and rels
    zip.file('word/header1.xml', header1Xml);
    zip.file('word/_rels/header1.xml.rels', header1RelsXml);

    // 3. Update Content Types
    let ct = zip.file('[Content_Types].xml').asText();
    if (!ct.includes('Extension="jpeg"')) {
      ct = ct.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
    }
    if (!ct.includes('PartName="/word/header1.xml"')) {
      ct = ct.replace('</Types>', '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
    }
    zip.file('[Content_Types].xml', ct);

    // 4. Update document rels to point to header1.xml
    let docRels = zip.file('word/_rels/document.xml.rels').asText();
    let headerRelId = 'rId6';
    const headerRelMatch = docRels.match(/<Relationship\s+[^>]*Target="header1\.xml"[^>]*\/>/);
    if (headerRelMatch) {
      const idMatch = headerRelMatch[0].match(/Id="([^"]+)"/);
      if (idMatch) headerRelId = idMatch[1];
    } else {
      docRels = docRels.replace('</Relationships>', `<Relationship Id="${headerRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`);
      zip.file('word/_rels/document.xml.rels', docRels);
    }

    // 5. Update document.xml
    let docXml = zip.file('word/document.xml').asText();

    // Update margins and header reference
    if (docXml.includes('<w:headerReference')) {
      docXml = docXml.replace(/<w:headerReference\b[^>]*\/>/g, `<w:headerReference w:type="default" r:id="${headerRelId}"/>`);
    } else {
      docXml = docXml.replace(/<w:sectPr\b([^>]*)>/, `<w:sectPr$1><w:headerReference w:type="default" r:id="${headerRelId}"/>`);
    }
    docXml = docXml.replace(/<w:pgSz\b[^>]*\/>/g, '<w:pgSz w:w="12240" w:h="15840"/>');
    docXml = docXml.replace(/<w:pgMar\b[^>]*\/>/g, '<w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>');

    // Robust paragraph-level replacement for intro and signature
    if (options.signer === 'vicerrector') {
      const vicerrectorIntro = p('El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceBefore: '240', spaceAfter: '200' });
      const vicerrectorTitle = p('Vicerrector de Investigación, Extensión e Innovación', { align: 'center', bold: true, spaceAfter: '40' });

      docXml = docXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, paraXml => {
        const plain = paraXml.replace(/<[^>]+>/g, '').trim();
        // Intro paragraph
        if (plain.toLowerCase().includes('suscrit') && plain.toLowerCase().includes('declara que')) {
          return vicerrectorIntro;
        }
        // Legacy signature title
        if (plain.toLowerCase().includes('conocimiento') && plain.toLowerCase().includes('apropiaci')) {
          return vicerrectorTitle;
        }
        // Legacy redundant vicerrectoria paragraph
        if (plain.toLowerCase() === 'vicerrectoría de investigación, extensión e innovación' || plain.toLowerCase() === 'vicerrectoria de investigacion, extension e innovacion') {
          return '';
        }
        return paraXml;
      });

      // Replace legacy signature lines
      docXml = docXml.replace(/<w:t[^>]*>(\{autores\}______|\{firmante_nombre\}|2698115[^<]*)<\/w:t>/g, '<w:t>__________________________________</w:t>');

    } else if (options.signer === 'jefe') {
      const jefeIntro = p('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceBefore: '240', spaceAfter: '200' });
      const jefeTitle = p('Jefe del Departamento de Publicaciones', { align: 'center', bold: true, spaceAfter: '40' });
      const jefeName = p('JORGE ARMANDO NAVARRO BELTRÁN', { align: 'center', bold: true, spaceAfter: '40' });
      const jefeCc = p('C.C. 1.045.683.896', { align: 'center', spaceAfter: '40' });

      docXml = docXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, paraXml => {
        const plain = paraXml.replace(/<[^>]+>/g, '').trim();
        // Intro paragraph
        if (plain.toLowerCase().includes('suscrit') && (plain.toLowerCase().includes('publicaciones') || plain.toLowerCase().includes('jefa') || plain.toLowerCase().includes('jefe')) && plain.toLowerCase().includes('declara')) {
          return jefeIntro;
        }
        // Name
        if (plain.toLowerCase().includes('dhayana') || plain.toLowerCase().includes('fernández') || plain.toLowerCase().includes('fernandez')) {
          return jefeName;
        }
        // ID
        if (plain.includes('581.440')) {
          return jefeCc;
        }
        // Title
        if (plain.toLowerCase().includes('jefa de publicaciones') || plain.toLowerCase().includes('jefe de publicaciones')) {
          return jefeTitle;
        }
        return paraXml;
      });

      docXml = docXml.replace(/<w:t[^>]*>\{firmante_nombre\}<\/w:t>/g, '<w:t>__________________________________</w:t>');
    }

    zip.file('word/document.xml', docXml);
    const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(filePath, buf);
    console.log(`[Updated letterhead & signers] ${filePath}`);
  }
}

// -------------------------------------------------------------
// 1. UPDATE EXISTING 16 TEMPLATES (Vicerrector & Jefe)
// -------------------------------------------------------------
const vicerrectorTemplates = [
  'AVAL-CAP-DIVULGACION.docx',
  'Aval-Capítulo-Editorial extranjera.docx',
  'Aval-Capítulo.docx',
  'Aval-Capítulos_DIV.docx',
  'Aval-Libro-Editorial extranjera.docx',
  'Aval-Libro.docx',
  'aval-varioscapitulos-editorial extranjera.docx',
  'Aval-varioscapitulos.docx',
  'Aval_LIB_DIV.docx',
  'Créditos-Cap_editorial_extranjera.docx',
  'Créditos-Capítulo-Proyecto.docx',
  'Créditos-Capítulo-Universidad Simón Bolívar.docx',
  'Créditos-Libro-Proyecto.docx',
  'Créditos-Libro-Universidad Simón Bolívar.docx',
  'Créditos-varioscapitulos-usb.docx'
];

for (const f of vicerrectorTemplates) {
  updateExistingTemplateWithMembrete(f, { signer: 'vicerrector' });
}

updateExistingTemplateWithMembrete('Evaluación por pares-jefa de publicaciones.docx', { signer: 'jefe' });

// Also update foreign certificates & declarations to have official margins and header
const otherTemplates = [
  'Certificado para EDITORIAL EXTRANJERA_capítulo_libro.docx',
  'Certificado para EDITORIAL EXTRANJERA_libro.docx',
  'Declaración de autor editorial externa.docx',
  'Declaración de autores.docx',
  'FORMATO SOLICITUD Certificados Libros y Capítulos.docx'
];
for (const f of otherTemplates) {
  updateExistingTemplateWithMembrete(f);
}

// -------------------------------------------------------------
// 2. CREATE NEW TEMPLATES FOR THE 8 MINCIENCIAS PRODUCTS
// -------------------------------------------------------------

// --- Product 3: Ediciones de Revistas o Libros (ERL) ---
const erlBody = [
  p('CERTIFICADO DE EDICIÓN DE REVISTAS O LIBROS CIENTÍFICOS (ERL)', { align: 'center', bold: true, sz: '24', spaceAfter: '280' }),
  p('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceAfter: '240' }),
  p('Que el/la investigador/a {nombre_investigador}, identificado/a con {tipo_documento} No. {numero_documento}, se encuentra formalmente acreditado/a en calidad de {rol_editorial} (Editor/a General, Editor/a Invitado/a o Compilador/a) de la publicación científica titulada "{titulo_publicacion}", con código {tipo_codigo} (ISSN/ISBN): {codigo_issn_isbn}, volumen: {volumen}, número: {numero}, correspondiente a la fecha de publicación: {fecha_publicacion}, editada bajo el Sello Editorial Ediciones Universidad Simón Bolívar.', { spaceAfter: '180' }),
  p('Se expide la presente constancia dando fe de que el ejemplar completo editado se encuentra publicado y disponible con soporte digital en el repositorio institucional o plataforma editorial a través del enlace: {enlace_publicacion}.', { spaceAfter: '240' }),
  p('La presente constancia se expide a solicitud de la parte interesada, en la ciudad de Barranquilla, a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.', { spaceAfter: '280' }),
  signatureBlock('jefe')
].join('');
createTemplateFromMembrete('Certificado-Edicion-Revista-Libro.docx', erlBody);

// --- Product 4: Publicaciones Editoriales No Especializadas (Cartilla, Manual no especializado, Boletín) ---
const noEspecializadaBody = [
  p('CERTIFICADO DE ALIANZA Y DIFUSIÓN DE PUBLICACIÓN EDITORIAL NO ESPECIALIZADA', { align: 'center', bold: true, sz: '24', spaceAfter: '280' }),
  p('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, en articulación con las entidades aliadas, declara que:', { align: 'center', spaceAfter: '240' }),
  p('Se certifica la existencia de la alianza estratégica entre la Universidad Simón Bolívar y {entidad_aliada} para la producción, coedición y circulación social del producto de comunicación pública de la ciencia de tipo {tipo_producto} (Cartilla, Manual no especializado o Boletín divulgativo) titulado "{titulo_publicacion}", derivado directamente del proyecto de investigación formal: "{proyecto_nombre}", con código oficial: {proyecto_codigo}.', { spaceAfter: '180' }),
  p('Se deja expresa constancia del cumplimiento de los requisitos establecidos en el Modelo de Medición de Minciencias: (1) Cuenta con una extensión total de {paginas_totales} páginas (cumpliendo los límites máximos exigidos); (2) Fue diseñado para el público objetivo no especializado: {publico_objetivo}; (3) Cuenta con una ruta de circulación {ruta_circulacion} (nacional, regional o comunitaria); (4) Incorpora un enfoque diferencial de tipo: {enfoque_diferencial}; y (5) Cuenta con depósito de ejemplar completo en PDF en el repositorio institucional (Bonga) disponible en: {url_bonga}. Autores/as: {autores}.', { spaceAfter: '240' }),
  p('La presente constancia se expide en la ciudad de Barranquilla, a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.', { spaceAfter: '280' }),
  signatureBlock('jefe')
].join('');
createTemplateFromMembrete('Certificado-Publicacion-No-Especializada.docx', noEspecializadaBody);

// --- Product 6: Libros de Formación (LIB_FOR) ---
const libForBody = [
  p('CERTIFICADO DE VALIDACIÓN DE LIBRO DE FORMACIÓN', { align: 'center', bold: true, sz: '24', spaceAfter: '280' }),
  p('El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceAfter: '240' }),
  p('Una vez revisados los soportes de la obra {libro_titulo}, con ISBN (impreso): {isbn_impreso}, ISBN (digital): {isbn_digital}, se puede validar como "Libro de Formación", de acuerdo con los criterios y lineamientos del Modelo de Reconocimiento y Medición de Minciencias.', { spaceAfter: '180' }),
  p('Se certifica su carácter y orientación formativo-pedagógica (libro de texto, guía de laboratorio, manual de aprendizaje) y su correspondiente arbitraje pedagógico. Asimismo, consta formalmente su adopción curricular en el programa de la(s) asignatura(s): {asignaturas_curriculares}, adscrita(s) a la unidad académica / facultad: {unidad_academica}, según syllabus y constancia curricular anexa. Publicado por {editorial} en el mes de {mes_publicacion} del año {anio_publicacion}. Autor(es)/Autora(s): {autores}.', { spaceAfter: '240' }),
  p('La presente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.', { spaceAfter: '280' }),
  signatureBlock('vicerrector')
].join('');
createTemplateFromMembrete('Certificado-Libro-Formacion.docx', libForBody);

// --- Product 7: Manuales y Guías Especializadas (MAN_GUI) ---
const manGuiBody = [
  p('CERTIFICADO DE VALIDACIÓN DE MANUALES O GUÍAS ESPECIALIZADAS', { align: 'center', bold: true, sz: '24', spaceAfter: '280' }),
  p('El suscrito Vicerrector de Investigación, Extensión e Innovación de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceAfter: '240' }),
  p('Una vez revisados los soportes de la publicación "{titulo_obra}", se puede validar como "Manuales o Guías Especializadas", conforme a los criterios del Sistema Nacional de Ciencia, Tecnología e Innovación (Minciencias).', { spaceAfter: '180' }),
  p('Se hace constar de manera explícita que los procedimientos, técnicas, protocolos o metodologías descritas en esta publicación se derivan directamente del Proyecto de Investigación formal titulado: "{proyecto_nombre}", con código oficial: {proyecto_codigo}, financiado/aprobado por {entidad_financiadora}. La obra cuenta con el registro {isbn_deposito} (ISBN o constancia de cumplimiento de depósito legal). Publicado por {editorial} en el mes de {mes_publicacion} del año {anio_publicacion}. Autor(es)/Autora(s): {autores}.', { spaceAfter: '240' }),
  p('La presente constancia se expide a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.', { spaceAfter: '280' }),
  signatureBlock('vicerrector')
].join('');
createTemplateFromMembrete('Certificado-Manual-Guia-Especializada.docx', manGuiBody);

// --- Product 8: Boletines Divulgativos (BOL) ---
const bolBody = [
  p('CERTIFICADO DE BOLETÍN DIVULGATIVO INSTITUCIONAL', { align: 'center', bold: true, sz: '24', spaceAfter: '280' }),
  p('El suscrito Jefe del Departamento de Publicaciones de la Universidad Simón Bolívar, declara que:', { align: 'center', spaceAfter: '240' }),
  p('Se certifica que la publicación seriada titulada "{titulo_boletin}", con registro {identificador_serie} (ISSN o código institucional), compila y presenta trabajos científicos, tecnológicos y académicos con fines divulgativos de carácter institucional bajo el sello de la Universidad Simón Bolívar.', { spaceAfter: '180' }),
  p('Se hace constar formalmente su periodicidad y distribución regular {periodicidad} (mensual, trimestral o semestral), correspondiente al número {numero}, año {anio_publicacion}, y su alojamiento y disponibilidad en PDF completo en el repositorio institucional (Bonga) a través de la URL: {url_bonga}. Equipo editorial / Autores/as: {autores}.', { spaceAfter: '240' }),
  p('La presente constancia se expide a solicitud de los interesados a los {dia_expedicion} días del mes de {mes_expedicion} del año {anio_expedicion}.', { spaceAfter: '280' }),
  signatureBlock('jefe')
].join('');
createTemplateFromMembrete('Certificado-Boletin-Divulgativo.docx', bolBody);

console.log('Finished generating and updating all certificate templates successfully!');
