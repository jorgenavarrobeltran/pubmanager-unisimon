const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const rootDir = path.join(__dirname, '..');
const possiblePaths = [
  'C:\\Users\\jorge.navarro\\OneDrive\\Unisimon\\Certificados\\MEMBRETE USB.docx',
  path.join(rootDir, '..', 'Certificados', 'MEMBRETE USB.docx'),
  path.join(rootDir, 'Certificados', 'MEMBRETE USB.docx')
];

let membretePath = possiblePaths.find(p => fs.existsSync(p));
if (!membretePath) {
  console.error('MEMBRETE USB.docx not found in possible paths:', possiblePaths);
  process.exit(1);
}
console.log('Found MEMBRETE USB.docx at:', membretePath);

const membreteZip = new PizZip(fs.readFileSync(membretePath));
const header1Xml = membreteZip.file('word/header1.xml').asText();
const header1RelsXml = membreteZip.file('word/_rels/header1.xml.rels').asText();
const membreteImageBuf = membreteZip.file('word/media/image1.jpeg').asNodeBuffer();

console.log('Successfully extracted Membrete USB assets:');
console.log(' - header1.xml:', header1Xml.length, 'bytes');
console.log(' - header1.xml.rels:', header1RelsXml.length, 'bytes');
console.log(' - image1.jpeg:', membreteImageBuf.length, 'bytes');
