import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputRel = process.argv[2] || 'docs/recursos-novos-sistema-ariane.html';
const outputRel = process.argv[3] || inputRel.replace(/\.html$/i, '.pdf');

const htmlPath = resolve(root, inputRel);
const pdfPath = resolve(root, outputRel);

if (!existsSync(htmlPath)) {
  console.error(`❌ HTML não encontrado: ${htmlPath}`);
  process.exit(1);
}

const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;

let puppeteer;
try {
  puppeteer = await import('puppeteer');
} catch {
  console.error('❌ Puppeteer não instalado. Rode: npm install --save-dev puppeteer');
  process.exit(1);
}

const browser = await puppeteer.default.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' },
  });
  console.log(`✅ PDF gerado: ${pdfPath}`);
} finally {
  await browser.close();
}
