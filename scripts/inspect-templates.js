const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '..', 'public', 'templates');
const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.docx'));

console.log('Inspecting ' + files.length + ' templates in ' + templatesDir);

for (const file of files) {
  const filePath = path.join(templatesDir, file);
  const zip = new PizZip(fs.readFileSync(filePath));
  
  const docRels = zip.file('word/_rels/document.xml.rels') ? zip.file('word/_rels/document.xml.rels').asText() : '';
  const headerRels = zip.file('word/_rels/header1.xml.rels') ? zip.file('word/_rels/header1.xml.rels').asText() : '';
  
  const docImages = docRels.match(/Target="media\/[^"]+"/g) || [];
  const headerImages = headerRels.match(/Target="media\/[^"]+"/g) || [];
  const hasHeader1 = !!zip.file('word/header1.xml');
  const mediaFiles = Object.keys(zip.files).filter(k => k.startsWith('word/media/'));
  
  console.log(`[${file}]`);
  console.log(`  hasHeader1: ${hasHeader1}`);
  console.log(`  headerImages: ${headerImages.join(', ')}`);
  console.log(`  docImages: ${docImages.join(', ')}`);
  console.log(`  media: ${mediaFiles.join(', ')}`);
}
