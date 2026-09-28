const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.join(__dirname, '..');
const membretePath = 'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Certificados\\MEMBRETE USB.docx';
const testDocPath = path.join(rootDir, 'public', 'templates', 'Aval-varioscapitulos.docx');

const mZip = new PizZip(fs.readFileSync(membretePath));
const header1Xml = mZip.file('word/header1.xml').asText();
const header1Rels = mZip.file('word/_rels/header1.xml.rels').asText();
const membreteImg = mZip.file('word/media/image1.jpeg').asNodeBuffer();

const docZip = new PizZip(fs.readFileSync(testDocPath));

// 1. Inject media
docZip.file('word/media/image1.jpeg', membreteImg);

// 2. Inject header1.xml and header1.xml.rels
docZip.file('word/header1.xml', header1Xml);
docZip.file('word/_rels/header1.xml.rels', header1Rels);

// 3. Update [Content_Types].xml
let ctXml = docZip.file('[Content_Types].xml').asText();
if (!ctXml.includes('Extension="jpeg"')) {
  ctXml = ctXml.replace('</Types>', '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
}
if (!ctXml.includes('PartName="/word/header1.xml"')) {
  ctXml = ctXml.replace('</Types>', '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');
}
docZip.file('[Content_Types].xml', ctXml);

// 4. Update word/_rels/document.xml.rels
let docRelsXml = docZip.file('word/_rels/document.xml.rels').asText();
let headerRelId = '';
const existingRelMatch = docRelsXml.match(/<Relationship\s+[^>]*Target="header1\.xml"[^>]*\/>/);
if (existingRelMatch) {
  const idMatch = existingRelMatch[0].match(/Id="([^"]+)"/);
  if (idMatch) headerRelId = idMatch[1];
} else {
  headerRelId = 'rIdHeader1';
  docRelsXml = docRelsXml.replace('</Relationships>', `<Relationship Id="${headerRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`);
  docZip.file('word/_rels/document.xml.rels', docRelsXml);
}
console.log('Header relationship ID:', headerRelId);

// 5. Update word/document.xml margins and headerReference
let docXml = docZip.file('word/document.xml').asText();

// Ensure headerReference is in sectPr
if (!docXml.includes('headerReference')) {
  docXml = docXml.replace(/<w:sectPr\b([^>]*)>/, `<w:sectPr$1><w:headerReference w:type="default" r:id="${headerRelId}"/>`);
} else {
  docXml = docXml.replace(/<w:headerReference\b[^>]*\/>/, `<w:headerReference w:type="default" r:id="${headerRelId}"/>`);
}

// Update margins
const officialMargins = '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>';
if (docXml.includes('<w:pgMar')) {
  docXml = docXml.replace(/<w:pgSz\b[^>]*\/>/g, '<w:pgSz w:w="12240" w:h="15840"/>');
  docXml = docXml.replace(/<w:pgMar\b[^>]*\/>/g, '<w:pgMar w:top="1417" w:right="1701" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>');
} else {
  docXml = docXml.replace('</w:sectPr>', `${officialMargins}</w:sectPr>`);
}

docZip.file('word/document.xml', docXml);

const outBuf = docZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(path.join(rootDir, 'scripts', 'test-output-varios.docx'), outBuf);
console.log('Generated scripts/test-output-varios.docx successfully!');
