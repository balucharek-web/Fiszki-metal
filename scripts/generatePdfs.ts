import fs from 'fs';
import path from 'path';
import { generateFillablePdf } from '../src/utils/pdfGenerator.ts';

const SAMPLE_ITEMS = [
  { id: '1', name: 'Wkręt do drewna', dimension: '6x80 mm', scaleCode: '247', refNumber: '42660256', priceText: 'Cena' },
  { id: '2', name: 'Wkręt do drewna', dimension: '5x70 mm', scaleCode: '246', refNumber: '42660255', priceText: 'Cena' },
  { id: '3', name: 'Wkręt do drewna', dimension: '5x60 mm', scaleCode: '245', refNumber: '42660254', priceText: 'Cena' },
  { id: '4', name: 'Wkręt do drewna', dimension: '4.5x50 mm', scaleCode: '244', refNumber: '42660253', priceText: 'Cena' },
  { id: '5', name: 'Wkręt do drewna', dimension: '4x40 mm', scaleCode: '243', refNumber: '42660252', priceText: 'Cena' },
  { id: '6', name: 'Wkręt do drewna', dimension: '3.5x30 mm', scaleCode: '242', refNumber: '42660251', priceText: 'Cena' },
  { id: '7', name: 'Wkręt do drewna', dimension: '3.5x25 mm', scaleCode: '241', refNumber: '42660250', priceText: 'Cena' },
];

const EMPTY_ITEMS = Array.from({ length: 7 }, (_, i) => ({
  id: `empty_${i + 1}`,
  name: '',
  dimension: '',
  scaleCode: '',
  refNumber: '',
  priceText: 'Cena',
}));

async function main() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const fontRegular = fs.readFileSync(path.join(publicDir, 'fonts', 'LiberationSans-Regular.ttf'));
  const fontBold = fs.readFileSync(path.join(publicDir, 'fonts', 'LiberationSans-Bold.ttf'));
  const logoBytes = fs.readFileSync(path.join(publicDir, 'assets', 'standers_logo_transparent.png'));

  // 1. Generate 7-label PDF with sample values
  const pdfBytesSample = await generateFillablePdf(SAMPLE_ITEMS, 7, fontRegular, fontBold, logoBytes);
  fs.writeFileSync(path.join(publicDir, 'szablon_fiszek_7_a4.pdf'), pdfBytesSample);
  console.log('Successfully created public/szablon_fiszek_7_a4.pdf');

  // 2. Generate 7-label PDF with blank empty fields
  const pdfBytesEmpty = await generateFillablePdf(EMPTY_ITEMS, 7, fontRegular, fontBold, logoBytes);
  fs.writeFileSync(path.join(publicDir, 'szablon_fiszek_7_pusty_a4.pdf'), pdfBytesEmpty);
  console.log('Successfully created public/szablon_fiszek_7_pusty_a4.pdf (puste pola do szybkiego wpisywania)');
}

main().catch(console.error);
