import { PDFDocument, rgb, TextAlignment, PDFName, PDFString } from 'pdf-lib';
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
  let customFontBold;

  if (fontBoldBytes) {
    customFontBold = await pdfDoc.embedFont(fontBoldBytes);
  } else if (typeof window !== 'undefined') {
    try {
      const resBold = await fetch('./fonts/LiberationSans-Bold.ttf');
      const bufBold = await resBold.arrayBuffer();
      customFontBold = await pdfDoc.embedFont(new Uint8Array(bufBold));
    } catch {
      // fallback
    }
  }

  // Load Standers 1:1 Transparent Logo PNG
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

  // Helper to attach auto-empty on focus and restore on empty blur to AcroForm field
  const attachAutoClearAction = (field: any, fieldKey: string) => {
    try {
      const focusJs = pdfDoc.context.obj({
        S: PDFName.of('JavaScript'),
        JS: PDFString.of(`this._prev_${fieldKey} = event.target.value; event.target.value = "";`),
      });
      const blurJs = pdfDoc.context.obj({
        S: PDFName.of('JavaScript'),
        JS: PDFString.of(`if (event.target.value === "") { event.target.value = this._prev_${fieldKey} || ""; }`),
      });
      const aaDict = pdfDoc.context.obj({
        Fo: focusJs,
        Bl: blurJs,
      });
      field.acroField.dict.set(PDFName.of('AA'), aaDict);
    } catch (e) {
      console.warn('Could not attach AA JavaScript:', e);
    }
  };

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

    // 2. Left Section: 1:1 STANDERS Logo (wymiary 36mm x 23mm, idealne proporcje 1.58:1)
    const logoAreaWidth = 42 * MM_TO_PT;
    if (embeddedLogo) {
      page.drawImage(embeddedLogo, {
        x: xLeft + 3 * MM_TO_PT,
        y: yBottom + 8.5 * MM_TO_PT,
        width: 36 * MM_TO_PT,
        height: 23 * MM_TO_PT,
      });
    }

    // 3. Middle Section: Form Fields
    const middleX = xLeft + logoAreaWidth + 2 * MM_TO_PT;
    const middleWidth = 90 * MM_TO_PT;

    // Field 1: Nazwa towaru (np. "Wkręt do drewna")
    const nameField = form.createTextField(`fiszka_${i + 1}_nazwa`);
    nameField.setText(item.name ?? '');
    nameField.setAlignment(TextAlignment.Left);
    nameField.addToPage(page, {
      x: middleX,
      y: yBottom + 25.5 * MM_TO_PT,
      width: middleWidth,
      height: 11 * MM_TO_PT,
      borderWidth: 0,
      font: customFontBold,
    });
    nameField.setFontSize(14);
    nameField.acroField.setDefaultAppearance('/Helvetica-Bold 14 Tf 0 0 0 rg');
    attachAutoClearAction(nameField, `nazwa_${i + 1}`);

    // Field 2: Wymiar (np. "6x80 mm") - WYRAŹNIE MOCNO POGRUBIONY I WIĘKSZY
    const dimField = form.createTextField(`fiszka_${i + 1}_wymiar`);
    dimField.setText(item.dimension ?? '');
    dimField.setAlignment(TextAlignment.Left);
    dimField.addToPage(page, {
      x: middleX,
      y: yBottom + 14 * MM_TO_PT,
      width: middleWidth,
      height: 11 * MM_TO_PT,
      borderWidth: 0,
      font: customFontBold,
    });
    dimField.setFontSize(18);
    dimField.acroField.setDefaultAppearance('/Helvetica-Bold 18 Tf 0 0 0 rg');
    attachAutoClearAction(dimField, `wymiar_${i + 1}`);

    // Field 3: Zaokrąglony zielony pasek DOKŁADNIE 7,5 cm (75mm) z numerem wagi (#d7f5c5)
    const badgeX = middleX;
    const badgeY = yBottom + 1.8 * MM_TO_PT;
    const badgeWidth = 75 * MM_TO_PT; // dokładnie 7.5 cm
    const badgeHeight = 12.2 * MM_TO_PT;
    const badgeR = 2.5 * MM_TO_PT;
    const greenColor = rgb(0.843, 0.961, 0.773);

    // Native geometric rounded rectangle
    page.drawCircle({ x: badgeX + badgeR, y: badgeY + badgeR, size: badgeR, color: greenColor });
    page.drawCircle({ x: badgeX + badgeWidth - badgeR, y: badgeY + badgeR, size: badgeR, color: greenColor });
    page.drawCircle({ x: badgeX + badgeR, y: badgeY + badgeHeight - badgeR, size: badgeR, color: greenColor });
    page.drawCircle({ x: badgeX + badgeWidth - badgeR, y: badgeY + badgeHeight - badgeR, size: badgeR, color: greenColor });
    page.drawRectangle({ x: badgeX + badgeR, y: badgeY, width: badgeWidth - 2 * badgeR, height: badgeHeight, color: greenColor });
    page.drawRectangle({ x: badgeX, y: badgeY + badgeR, width: badgeR, height: badgeHeight - 2 * badgeR, color: greenColor });
    page.drawRectangle({ x: badgeX + badgeWidth - badgeR, y: badgeY + badgeR, width: badgeR, height: badgeHeight - 2 * badgeR, color: greenColor });

    // "Wpisz na wadze:" - większy i mocno pogrubiony
    if (customFontBold) {
      page.drawText('Wpisz na wadze:', {
        x: badgeX + 3.2 * MM_TO_PT,
        y: badgeY + 4 * MM_TO_PT,
        size: 13,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Numer na wadze - EKSTRA POGRUBIONY (28pt), wyrównany do prawej (np. 247)
    const scaleField = form.createTextField(`fiszka_${i + 1}_waga`);
    scaleField.setText(item.scaleCode ?? '');
    scaleField.setAlignment(TextAlignment.Right);
    scaleField.addToPage(page, {
      x: badgeX + badgeWidth - 28 * MM_TO_PT,
      y: badgeY + 0.8 * MM_TO_PT,
      width: 26 * MM_TO_PT,
      height: 11.2 * MM_TO_PT,
      borderWidth: 0,
      font: customFontBold,
    });
    scaleField.setFontSize(28);
    scaleField.acroField.setDefaultAppearance('/Helvetica-Bold 28 Tf 0 0 0 rg');

    // Set widget background to matching green (eliminates any white cutout box!)
    scaleField.acroField.getWidgets().forEach((w) => {
      w.getOrCreateAppearanceCharacteristics().setBackgroundColor([0.843, 0.961, 0.773]);
    });
    attachAutoClearAction(scaleField, `waga_${i + 1}`);

    // 4. Right Section: Czarna ramka 5.5 cm szerokości × 3.7 cm wysokości (55mm x 37mm) z marginesem 5mm od końca
    const frameWidth = 55 * MM_TO_PT;
    const frameHeight = 37 * MM_TO_PT;
    const frameX = xLeft + labelWidth - frameWidth - 5 * MM_TO_PT; // margines od końca 5mm
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
    priceField.setText(item.priceText ?? '');
    priceField.setAlignment(TextAlignment.Right);
    priceField.addToPage(page, {
      x: frameX + 2 * MM_TO_PT,
      y: frameY + frameHeight - 11.5 * MM_TO_PT,
      width: frameWidth - 4 * MM_TO_PT,
      height: 9.5 * MM_TO_PT,
      borderWidth: 0,
      font: customFontBold,
    });
    priceField.setFontSize(11.5);
    priceField.acroField.setDefaultAppearance('/Helvetica-Bold 11.5 Tf 0 0 0 rg');
    attachAutoClearAction(priceField, `cena_${i + 1}`);

    // "Ref:" static label inside black frame (bottom)
    if (customFontBold) {
      page.drawText('Ref:', {
        x: frameX + 5 * MM_TO_PT,
        y: frameY + 3.8 * MM_TO_PT,
        size: 10.5,
        font: customFontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Field 5: Ref Number inside black frame (bottom, right aligned)
    const refField = form.createTextField(`fiszka_${i + 1}_ref`);
    refField.setText(item.refNumber ?? '');
    refField.setAlignment(TextAlignment.Right);
    refField.addToPage(page, {
      x: frameX + 14 * MM_TO_PT,
      y: frameY + 1.8 * MM_TO_PT,
      width: frameWidth - 17 * MM_TO_PT,
      height: 9 * MM_TO_PT,
      borderWidth: 0,
      font: customFontBold,
    });
    refField.setFontSize(11);
    refField.acroField.setDefaultAppearance('/Helvetica-Bold 11 Tf 0 0 0 rg');
    attachAutoClearAction(refField, `ref_${i + 1}`);
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
    end: { x: rulerX + 4 * MM_TO_PT, y: rulerY + rulerHeight },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: rulerX, y: rulerY + rulerHeight },
    end: { x: rulerX + 4 * MM_TO_PT, y: rulerY + rulerHeight },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.5,
  });

  // Apply bold embedded font to all form field appearances
  if (customFontBold) {
    try {
      form.updateFieldAppearances(customFontBold);
    } catch {
      // fallback
    }
  }

  return await pdfDoc.save();
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
