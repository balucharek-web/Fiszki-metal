import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FiszkaItem } from '../types/label';

const MM_TO_PT = 72 / 25.4; // 1 mm = ~2.83465 pt

export async function generateFillablePdf(
  items: FiszkaItem[],
  itemsCount: 6 | 7 = 6,
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

  // Load Standers 1:1 Logo PNG
  let embeddedLogo;
  if (logoPngBytes) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoPngBytes);
    } catch {
      // fallback
    }
  } else if (typeof window !== 'undefined') {
    try {
      const resLogo = await fetch('./assets/standers_logo_clean.png');
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

  // Vertical layout
  const verticalSpacingMm = itemsCount === 6 ? 4 : 0;
  const totalContentHeightMm = itemsCount * 40 + (itemsCount - 1) * verticalSpacingMm;
  const topMarginMm = Math.max(4, (297 - totalContentHeightMm) / 2);

  const count = Math.min(itemsCount, items.length);

  for (let i = 0; i < count; i++) {
    const item = items[i];
    // In PDF coordinates, (0,0) is bottom-left
    const yTopMm = 297 - topMarginMm - i * (40 + verticalSpacingMm);
    const yBottomMm = yTopMm - 40;

    const xLeft = leftMargin;
    const yBottom = yBottomMm * MM_TO_PT;

    // 1. Draw Label Outer Border (19.5 x 4.0 cm)
    page.drawRectangle({
      x: xLeft,
      y: yBottom,
      width: labelWidth,
      height: labelHeight,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.75,
      color: rgb(1, 1, 1),
    });

    // 2. Left Section: 1:1 STANDERS Logo (BRAK cienkiej linii pionowej za logo!)
    const logoAreaWidth = 40 * MM_TO_PT;
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: xLeft + 2.5 * MM_TO_PT,
        y: yBottom + 3 * MM_TO_PT,
        width: 36 * MM_TO_PT,
        height: 34 * MM_TO_PT,
      });
    }

    // 3. Middle Section: Form Fields
    const middleX = xLeft + logoAreaWidth + 2 * MM_TO_PT;
    const middleWidth = 92 * MM_TO_PT;

    // Field 1: Nazwa towaru (np. "Wkręt do drewna")
    const nameField = form.createTextField(`fiszka_${i + 1}_nazwa`);
    nameField.setText(item.name || 'Wkręt do drewna');
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
    dimField.addToPage(page, {
      x: middleX,
      y: yBottom + 14.5 * MM_TO_PT,
      width: middleWidth,
      height: 10 * MM_TO_PT,
      font: customFontBold,
      borderWidth: 0,
    });
    dimField.setFontSize(14.5);

    // Field 3: Zielony pasek - napis i numer powiększone i pogrubione
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
        x: badgeX + 3 * MM_TO_PT,
        y: badgeY + 3.8 * MM_TO_PT,
        size: 11.5,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Numer na wadze - duży i pogrubiony (np. 247)
    const scaleField = form.createTextField(`fiszka_${i + 1}_waga`);
    scaleField.setText(item.scaleCode || '247');
    scaleField.addToPage(page, {
      x: badgeX + badgeWidth - 30 * MM_TO_PT,
      y: badgeY + 0.8 * MM_TO_PT,
      width: 28 * MM_TO_PT,
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

    // Field 4: Cena inside black frame (top)
    const priceField = form.createTextField(`fiszka_${i + 1}_cena`);
    priceField.setText(item.priceText || 'Cena');
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
        x: frameX + 6 * MM_TO_PT,
        y: frameY + 3.8 * MM_TO_PT,
        size: 10,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Field 5: Ref Number inside black frame (bottom)
    const refField = form.createTextField(`fiszka_${i + 1}_ref`);
    refField.setText(item.refNumber || '42660256');
    refField.addToPage(page, {
      x: frameX + 16 * MM_TO_PT,
      y: frameY + 1.8 * MM_TO_PT,
      width: frameWidth - 18 * MM_TO_PT,
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
