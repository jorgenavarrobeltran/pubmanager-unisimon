const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '..', 'public', 'templates');
const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.docx'));

for (const file of files) {
  const filePath = path.join(templatesDir, file);
  const zip = new PizZip(fs.readFileSync(filePath));
  const docXml = zip.file('word/document.xml') ? zip.file('word/document.xml').asText() : '';
  const headerXml = zip.file('word/header1.xml') ? zip.file('word/header1.xml').asText() : '';
  
  // Extract text representation
  const plainText = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  
  // Check intro
  const introMatch = plainText.match(/(?:El suscrito|La suscrita)[^:]+declara que:/i);
  
  // Check signature lines
  const sigMatch = plainText.match(/(LUIS EDUARDO ORTIZ|JORGE ARMANDO NAVARRO|DHAYANA|Director de Conocimiento|Vicerrector|Jefe del Departamento|Jefa de Publicaciones)/gi);
  
  // Check header watermark
  const hasMembreteJpeg = !!zip.file('word/media/image1.jpeg') && headerXml.includes('WordPictureWatermark350198205');
  
  console.log(`\n=================== ${file} ===================`);
  console.log(`  Intro: ${introMatch ? introMatch[0] : 'NONE'}`);
  console.log(`  Sig matches: ${sigMatch ? [...new Set(sigMatch)].join(', ') : 'NONE'}`);
  console.log(`  Has Official Membrete: ${hasMembreteJpeg}`);
}
