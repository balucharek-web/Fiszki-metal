import { PDFDocument, rgb, TextAlignment, PDFName, PDFString, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { FiszkaItem } from '../types/label';

const MM_TO_PT = 72 / 25.4; // 1 mm = ~2.83465 pt

export async function generateFillablePdf(
  items: FiszkaItem[],
  itemsCount = 7,
  fontRegularBytes?: Uint8Array,
  fontBoldBytes?: Uint8Array,
  logoPngBytes?: Uint8Array
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load custom TTF fonts (Leroy Merlin Sans) with Polish characters support
  let customFontBold: PDFFont | undefined;
  let customFontRegular: PDFFont | undefined;

  if (fontBoldBytes) {
    customFontBold = await pdfDoc.embedFont(fontBoldBytes);
  } else if (typeof window !== 'undefined') {
    try {
      const resBold = await fetch('./fonts/LeroyMerlinSans-Bold.ttf');
      if (resBold.ok) {
        const bufBold = await resBold.arrayBuffer();
        customFontBold = await pdfDoc.embedFont(new Uint8Array(bufBold));
      }
    } catch {
      // fallback
    }
  }

  if (fontRegularBytes) {
    customFontRegular = await pdfDoc.embedFont(fontRegularBytes);
  } else if (typeof window !== 'undefined') {
    try {
      const resReg = await fetch('./fonts/LeroyMerlinSans-Regular.ttf');
      if (resReg.ok) {
        const bufReg = await resReg.arrayBuffer();
        customFontRegular = await pdfDoc.embedFont(new Uint8Array(bufReg));
      }
    } catch {
      // fallback
    }
  }

  // Load standard HelveticaBold as universal font fallback
  const helvBold = await pdfDoc.embedStandardFont(StandardFonts.HelveticaBold);
  const boldFont = customFontBold || helvBold;

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
  const form = pdfDoc.getForm();

  // Set up AcroForm Default Resources (DR) so PDF viewers (Acrobat, Chrome, Preview)
  // correctly find and render bold fonts in interactive fields
  const dr = pdfDoc.context.obj({});
  const fontDict = pdfDoc.context.obj({});
  fontDict.set(PDFName.of('Helvetica-Bold'), helvBold.ref);
  fontDict.set(PDFName.of('HeBo'), helvBold.ref);
  fontDict.set(PDFName.of('Helvetica'), helvBold.ref);
  fontDict.set(PDFName.of('Helv'), helvBold.ref);
  if (customFontBold) {
    fontDict.set(PDFName.of('LeroyMerlinSans-Bold'), customFontBold.ref);
    fontDict.set(PDFName.of('LMSBold'), customFontBold.ref);
    fontDict.set(PDFName.of('CustomBold'), customFontBold.ref);
  }
  if (customFontRegular) {
    fontDict.set(PDFName.of('LeroyMerlinSans-Regular'), customFontRegular.ref);
    fontDict.set(PDFName.of('LMSRegular'), customFontRegular.ref);
  }
  dr.set(PDFName.of('Font'), fontDict);
  form.acroForm.dict.set(PDFName.of('DR'), dr);

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

  const totalPages = Math.max(1, Math.ceil(items.length / 7));

  for (let p = 0; p < totalPages; p++) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    for (let i = 0; i < 7; i++) {
      const globalIdx = p * 7 + i;
      const item = items[globalIdx] || {
        id: `fiszka_${globalIdx + 1}`,
        name: '',
        dimension: '',
        scaleCode: '',
        refNumber: '',
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

      // 2. Left Section: STANDERS Logo (powiększone, bez pionowej linii dzielącej)
      const logoAreaWidth = 49 * MM_TO_PT;
      if (embeddedLogo) {
        page.drawImage(embeddedLogo, {
          x: xLeft + ((49 - 37) / 2) * MM_TO_PT,
          y: yBottom + 8.5 * MM_TO_PT,
          width: 37 * MM_TO_PT,
          height: 23 * MM_TO_PT,
        });
      }

      // 3. Middle Section: przesunięty o 5mm w lewo
      const middleX = xLeft + logoAreaWidth + 2 * MM_TO_PT;
      const middleWidth = (195 - 49 - 60 - 3) * MM_TO_PT;

      // Row 1: Nazwa towaru (np. "Wkręt do drewna") - obniżona do wysokości logo Standers
      const nameField = form.createTextField(`fiszka_${globalIdx + 1}_nazwa`);
      if (item.name) {
        nameField.setText(item.name);
      }
      nameField.setAlignment(TextAlignment.Left);
      nameField.addToPage(page, {
        x: middleX,
        y: yBottom + 22.5 * MM_TO_PT,
        width: middleWidth,
        height: 9.5 * MM_TO_PT,
        borderWidth: 0,
        font: boldFont,
      });
      nameField.setFontSize(14);
      nameField.acroField.setDefaultAppearance(
        customFontBold ? '/LMSBold 14 Tf 0 0 0 rg' : '/Helvetica-Bold 14 Tf 0 0 0 rg'
      );
      nameField.acroField.getWidgets()[0].dict.set(PDFName.of('DR'), dr);
      if (item.name) {
        try {
          nameField.updateAppearances(boldFont);
        } catch {
          // ignore
        }
      }
      attachAutoClearAction(nameField, `nazwa_${globalIdx + 1}`);

      // Row 2: Wymiar (np. "6x80 mm") - bezpośrednio nad zielonym paskiem wagi
      const dimField = form.createTextField(`fiszka_${globalIdx + 1}_wymiar`);
      if (item.dimension) {
        dimField.setText(item.dimension);
      }
      dimField.setAlignment(TextAlignment.Left);
      dimField.addToPage(page, {
        x: middleX,
        y: yBottom + 14.5 * MM_TO_PT,
        width: middleWidth,
        height: 7.5 * MM_TO_PT,
        borderWidth: 0,
        font: boldFont,
      });
      dimField.setFontSize(18);
      dimField.acroField.setDefaultAppearance(
        customFontBold ? '/LMSBold 18 Tf 0 0 0 rg' : '/Helvetica-Bold 18 Tf 0 0 0 rg'
      );
      dimField.acroField.getWidgets()[0].dict.set(PDFName.of('DR'), dr);
      if (item.dimension) {
        try {
          dimField.updateAppearances(boldFont);
        } catch {
          // ignore
        }
      }
      attachAutoClearAction(dimField, `wymiar_${globalIdx + 1}`);

      // Row 3: Zaokrąglony zielony pasek (zwiększony o 5mm do 74mm)
      const badgeX = middleX;
      const badgeY = yBottom + 1.8 * MM_TO_PT;
      const badgeWidth = 74 * MM_TO_PT; // zwiększone o 5mm do 74mm
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

      // "Wpisz na wadze:" - pojedynczy, czysty, ostry napis
      page.drawText('Wpisz na wadze:', {
        x: badgeX + 3 * MM_TO_PT,
        y: badgeY + 4.2 * MM_TO_PT,
        size: 13.5,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Numer na wadze - pogrubiony, duży w czcionce Leroy Merlin Sans Bold
      const scaleField = form.createTextField(`fiszka_${globalIdx + 1}_waga`);
      if (item.scaleCode) {
        scaleField.setText(String(item.scaleCode));
      }
      scaleField.setAlignment(TextAlignment.Right);
      scaleField.addToPage(page, {
        x: badgeX + badgeWidth - 32 * MM_TO_PT,
        y: badgeY + 0.8 * MM_TO_PT,
        width: 30 * MM_TO_PT,
        height: 11.2 * MM_TO_PT,
        borderWidth: 0,
        font: boldFont,
      });
      scaleField.setFontSize(28);
      scaleField.acroField.setDefaultAppearance(
        customFontBold ? '/LMSBold 28 Tf 0 0 0 rg' : '/Helvetica-Bold 28 Tf 0 0 0 rg'
      );

      const scaleWidget = scaleField.acroField.getWidgets()[0];
      scaleWidget.dict.set(PDFName.of('DR'), dr);
      scaleWidget.getOrCreateAppearanceCharacteristics().setBackgroundColor([0.843, 0.961, 0.773]);

      if (item.scaleCode) {
        try {
          scaleField.updateAppearances(boldFont);
        } catch {
          // ignore
        }
      }
      attachAutoClearAction(scaleField, `waga_${globalIdx + 1}`);

      // 4. Right Section: Czarna ramka odsunięta o 5 mm od prawej krawędzi fiszki
      const frameWidth = 53.5 * MM_TO_PT;
      const frameHeight = 37 * MM_TO_PT;
      const frameX = xLeft + labelWidth - frameWidth - 5 * MM_TO_PT; // odsunięta o 5mm od prawej krawędzi
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
      const priceField = form.createTextField(`fiszka_${globalIdx + 1}_cena`);
      if (item.priceText) {
        priceField.setText(item.priceText);
      }
      priceField.setAlignment(TextAlignment.Right);
      priceField.addToPage(page, {
        x: frameX + 2 * MM_TO_PT,
        y: frameY + frameHeight - 11.5 * MM_TO_PT,
        width: frameWidth - 4 * MM_TO_PT,
        height: 9.5 * MM_TO_PT,
        borderWidth: 0,
        font: boldFont,
      });
      priceField.setFontSize(11.5);
      priceField.acroField.setDefaultAppearance(
        customFontBold ? '/LMSBold 11.5 Tf 0 0 0 rg' : '/Helvetica-Bold 11.5 Tf 0 0 0 rg'
      );
      priceField.acroField.getWidgets()[0].dict.set(PDFName.of('DR'), dr);
      if (item.priceText) {
        try {
          priceField.updateAppearances(boldFont);
        } catch {
          // ignore
        }
      }
      attachAutoClearAction(priceField, `cena_${globalIdx + 1}`);

      // "Ref:" static label inside black frame (bottom)
      page.drawText('Ref:', {
        x: frameX + 5 * MM_TO_PT,
        y: frameY + 3.8 * MM_TO_PT,
        size: 10.5,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Field 5: Ref Number inside black frame (bottom, right aligned)
      const refField = form.createTextField(`fiszka_${globalIdx + 1}_ref`);
      if (item.refNumber) {
        refField.setText(item.refNumber);
      }
      refField.setAlignment(TextAlignment.Right);
      refField.addToPage(page, {
        x: frameX + 14 * MM_TO_PT,
        y: frameY + 1.8 * MM_TO_PT,
        width: frameWidth - 17 * MM_TO_PT,
        height: 9 * MM_TO_PT,
        borderWidth: 0,
        font: boldFont,
      });
      refField.setFontSize(11);
      refField.acroField.setDefaultAppearance(
        customFontBold ? '/LMSBold 11 Tf 0 0 0 rg' : '/Helvetica-Bold 11 Tf 0 0 0 rg'
      );
      refField.acroField.getWidgets()[0].dict.set(PDFName.of('DR'), dr);
      if (item.refNumber) {
        try {
          refField.updateAppearances(boldFont);
        } catch {
          // ignore
        }
      }
      attachAutoClearAction(refField, `ref_${globalIdx + 1}`);
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
  }

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
