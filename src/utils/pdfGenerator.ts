import { PDFDocument, rgb, TextAlignment } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FiszkaItem } from '../types/label';

const MM_TO_PT = 72 / 25.4; // 1 mm = ~2.83465 pt

export async function generateFillablePdf(
  items: FiszkaItem[],
  itemsCount: 7 = 7,
  fontRegularBytes?: Uint8Array,
  fontBoldBytes?: Uint8Array,
  logoPngBytes?: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load custom TTF font with Polish characters support
  let customFontRegular;
  let customFontBold;

  if (fontRegularBytes && fontBoldBytes) {
    customFontRegular = await pdfDoc.embedFont(fontRegularBytes);
    customFontBold = await pdfDoc.embedFont(fontBoldBytes);
  } else if (typeof window !== 'undefined') {
    try {
      const [resReg, resBold] = await Promise.all([
        fetch('./fonts/LiberationSans-Regular.ttf'),
        fetch('./fonts/LiberationSans-Bold.ttf'),
      ]);
      const [bufReg, bufBold] = await Promise.all([
        resReg.arrayBuffer(),
        resBold.arrayBuffer(),
      ]);
      customFontRegular = await pdfDoc.embedFont(new Uint8Array(bufReg));
      customFontBold = await pdfDoc.embedFont(new Uint8Array(bufBold));
    } catch {
      // fallback
    }
  }

  // Load Standers 1:1 Transparent Logo PNG (Pure white background, no scanner gray)
  let embeddedLogo;
  if (logoPngBytes) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoPngBytes);
    } catch {
      // fallback
    }
  } else if (typeof window !== 'undefined') {
    try {
      const resLogo = await fetch('./assets/standers_logo_transparent.png');
      const bufLogo = await resLogo.arrayBuffer();
      embeddedLogo = await pdfDoc.embedPng(new Uint8Array(bufLogo));
    } catch {
      // fallback
    }
  }

  // A4 Page: 210 mm x 297 mm
  const pageWidth = 210 * MM_TO_PT;
  const pageHeight = 297 * MM_TO_PT;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  const form = pdfDoc.getForm();

  // Label dimensions in points
  const labelWidth = 195 * MM_TO_PT;
  const labelHeight = 40 * MM_TO_PT;
  const leftMargin = ((210 - 195) / 2) * MM_TO_PT; // 7.5 mm

  // Vertical layout: Exactly 7 labels stacked seamlessly (280 mm total height)
  const totalContentHeightMm = 7 * 40; // 280 mm
  const topMarginMm = (297 - totalContentHeightMm) / 2; // 8.5 mm

  const count = 7;

  for (let i = 0; i < count; i++) {
    const item = items[i] || {
      id: `fiszka_${i + 1}`,
      name: 'Wkręt do drewna',
      dimension: '6x80 mm',
      scaleCode: '247',
      refNumber: '42660256',
      priceText: 'Cena',
    };

    // In PDF coordinates, (0,0) is bottom-left
    const yTopMm = 297 - topMarginMm - i * 40;
    const yBottomMm = yTopMm - 40;

    const xLeft = leftMargin;
    const yBottom = yBottomMm * MM_TO_PT;

    // 1. Draw Label Outer Border (19.5 x 4.0 cm)
    page.drawRectangle({
      x: xLeft,
      y: yBottom,
      width: labelWidth,
      height: labelHeight,
      borderColor: rgb(0.75, 0.75, 0.75),
      borderWidth: 0.75,
      color: rgb(1, 1, 1),
    });

    // 2. Left Section: 1:1 STANDERS Logo (BEZ linii pionowej za logo!)
    const logoAreaWidth = 42 * MM_TO_PT;
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: xLeft + 3 * MM_TO_PT,
        y: yBottom + 3 * MM_TO_PT,
        width: 36 * MM_TO_PT,
        height: 34 * MM_TO_PT,
      });
    }

    // 3. Middle Section: Form Fields
    const middleX = xLeft + logoAreaWidth + 2 * MM_TO_PT;
    const middleWidth = 90 * MM_TO_PT;

    // Field 1: Nazwa towaru (np. "Wkręt do drewna")
    const nameField = form.createTextField(`fiszka_${i + 1}_nazwa`);
    nameField.setText(item.name || 'Wkręt do drewna');
    nameField.setAlignment(TextAlignment.Left);
    nameField.addToPage(page, {
      x: middleX,
      y: yBottom + 25 * MM_TO_PT,
      width: middleWidth,
      height: 11 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    nameField.setFontSize(13.5);

    // Field 2: Wymiar (np. "6x80 mm") - większy i pogrubiony
    const dimField = form.createTextField(`fiszka_${i + 1}_wymiar`);
    dimField.setText(item.dimension || '6x80 mm');
    dimField.setAlignment(TextAlignment.Left);
    dimField.addToPage(page, {
      x: middleX,
      y: yBottom + 14.5 * MM_TO_PT,
      width: middleWidth,
      height: 10 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    dimField.setFontSize(14.5);

    // Field 3: Zielony pasek z numerem wagi (#d7f5c5)
    const badgeX = middleX;
    const badgeY = yBottom + 2 * MM_TO_PT;
    const badgeWidth = middleWidth;
    const badgeHeight = 12 * MM_TO_PT;

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: rgb(0.84, 0.96, 0.77), // pastel green #d7f5c5
    });

    // "Wpisz na wadze:" - większy i pogrubiony
    if (customFontBold) {
      page.drawText('Wpisz na wadze:', {
        x: badgeX + 3.5 * MM_TO_PT,
        y: badgeY + 4 * MM_TO_PT,
        size: 11.5,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Numer na wadze - duży, pogrubiony, wyrównany do prawej (np. 247)
    const scaleField = form.createTextField(`fiszka_${i + 1}_waga`);
    scaleField.setText(item.scaleCode || '247');
    scaleField.setAlignment(TextAlignment.Right);
    scaleField.addToPage(page, {
      x: badgeX + badgeWidth - 32 * MM_TO_PT,
      y: badgeY + 0.8 * MM_TO_PT,
      width: 29 * MM_TO_PT,
      height: 10.5 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    scaleField.setFontSize(22);

    // 4. Right Section: Czarna ramka 5.5 cm szerokości × 3.7 cm wysokości (55mm x 37mm)
    const frameWidth = 55 * MM_TO_PT;
    const frameHeight = 37 * MM_TO_PT;
    const frameX = xLeft + labelWidth - frameWidth - 1.5 * MM_TO_PT;
    const frameY = yBottom + 1.5 * MM_TO_PT;

    page.drawRectangle({
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.2,
      color: rgb(1, 1, 1),
    });

    // Field 4: Cena inside black frame (top, right aligned)
    const priceField = form.createTextField(`fiszka_${i + 1}_cena`);
    priceField.setText(item.priceText || 'Cena');
    priceField.setAlignment(TextAlignment.Right);
    priceField.addToPage(page, {
      x: frameX + 2 * MM_TO_PT,
      y: frameY + frameHeight - 11.5 * MM_TO_PT,
      width: frameWidth - 4 * MM_TO_PT,
      height: 9.5 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    priceField.setFontSize(11);

    // "Ref:" static label inside black frame (bottom)
    if (customFontBold) {
      page.drawText('Ref:', {
        x: frameX + 5 * MM_TO_PT,
        y: frameY + 3.8 * MM_TO_PT,
        size: 10,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Field 5: Ref Number inside black frame (bottom, right aligned)
    const refField = form.createTextField(`fiszka_${i + 1}_ref`);
    refField.setText(item.refNumber || '42660256');
    refField.setAlignment(TextAlignment.Right);
    refField.addToPage(page, {
      x: frameX + 14 * MM_TO_PT,
      y: frameY + 1.8 * MM_TO_PT,
      width: frameWidth - 17 * MM_TO_PT,
      height: 9 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    refField.setFontSize(10.5);
  }

  // Calibration 50 mm ruler on left margin
  const rulerX = 2 * MM_TO_PT;
  const rulerY = 20 * MM_TO_PT;
  const rulerHeight = 50 * MM_TO_PT;
  page.drawLine({
    start: { x: rulerX, y: rulerY },
    end: { x: rulerX + 4 * MM_TO_PT, y: rulerY },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: rulerX, y: rulerY },
    end: { x: rulerX, y: rulerY + rulerHeight },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: rulerX, y: rulerY + rulerHeight },
    end: { x: rulerX + 4 * MM_TO_PT, y: rulerY + rulerHeight },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.5,
  });

  return await pdfDoc.save({ updateFieldAppearances: false });
}

export function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
