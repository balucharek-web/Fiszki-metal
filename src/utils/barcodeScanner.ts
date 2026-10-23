import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';

export interface DecodedBarcodeResult {
  code: string;
  rawText: string;
  format?: string;
}

/**
 * Sprawdza czy dany kod kreskowy to techniczny kod zawieszki ESL (np. 147450750900346!),
 * który bezwzględnie należy zignorować.
 */
export function isIgnoredEslHardwareBarcode(raw: string, isVertical = false): boolean {
  if (!raw) return true;
  if (isVertical) return true;
  const trimmed = raw.trim();
  // Kody seryjne modułów ESL (np. SES-imagotag, Hanshow, Pricer)
  if (trimmed.includes('!')) return true;
  if (trimmed.startsWith('147') && trimmed.length >= 13) return true;
  if (/^[A-Za-z0-9]{15,}$/.test(trimmed) && !/^\d{13}$/.test(trimmed)) return true;
  return false;
}

/**
 * Czyści odczytany kod kreskowy (np. kody paczkowe/odbioru z sufiksem XX lub APS).
 */
export function cleanBarcodeText(raw: string): string {
  if (!raw) return '';
  let trimmed = raw.trim();
  if (trimmed.includes('XX')) {
    trimmed = trimmed.split('XX')[0].trim();
  }
  // Usuń przyrostki typu "APS" z kodów EAN na etykietach ESL
  if (trimmed.endsWith('APS') || trimmed.endsWith('aps')) {
    trimmed = trimmed.slice(0, -3).trim();
  }
  return trimmed;
}

/**
 * Skanuje obraz i dekoduje kody kreskowe artykułu (EAN-13, EAN-8, Code 128 itp.).
 * Filtruje i ignoruje pionowe kody seryjne samej zawieszki ESL.
 */
export async function scanBarcodeClientSide(imageUrl: string): Promise<DecodedBarcodeResult | null> {
  // 1. Próba użycia natywnego BarcodeDetector (Chrome / Android / Edge)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const formats = [
        'ean_13',
        'ean_8',
        'code_128',
        'code_39',
        'upc_a',
        'upc_e',
        'qr_code',
        'itf',
        'data_matrix',
      ];
      const detector = new BarcodeDetectorClass({ formats });
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      const barcodes = await detector.detect(img);
      if (barcodes && barcodes.length > 0) {
        // Filtrujemy i szukamy wyłącznie poziomych kodów artykułu
        const validBarcodes = barcodes.filter((b: any) => {
          if (!b.rawValue) return false;
          const box = b.boundingBox;
          const isVertical = box && box.height > box.width * 1.15;
          return !isIgnoredEslHardwareBarcode(b.rawValue, isVertical);
        });

        // Priorytet 1: EAN-13 (kod kreskowy towaru na dole etykiety)
        const ean13 = validBarcodes.find((b: any) => b.format === 'ean_13' || /^\d{13}$/.test(b.rawValue.trim()));
        if (ean13) {
          const raw = ean13.rawValue;
          return {
            code: cleanBarcodeText(raw),
            rawText: raw,
            format: 'ean_13',
          };
        }

        // Priorytet 2: EAN-8 lub inny prawidłowy kod artykułu
        if (validBarcodes.length > 0) {
          const raw = validBarcodes[0].rawValue;
          return {
            code: cleanBarcodeText(raw),
            rawText: raw,
            format: validBarcodes[0].format || 'BARCODE',
          };
        }
      }
    } catch (err) {
      console.warn('Natywny BarcodeDetector nie znalazł poziomego kodu, próba ZXing:', err);
    }
  }

  // 2. Dekodowanie silnikiem ZXing (MultiFormatReader)
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const len = canvas.width * canvas.height;
    const luminances = new Uint8ClampedArray(len);
    const data = imgData.data;

    for (let i = 0; i < len; i++) {
      luminances[i] = ((data[i * 4] + 2 * data[i * 4 + 1] + data[i * 4 + 2]) / 4) | 0;
    }

    const source = new RGBLuminanceSource(luminances, canvas.width, canvas.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));

    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    const result = reader.decode(bitmap);

    if (result && result.getText()) {
      const raw = result.getText();
      if (!isIgnoredEslHardwareBarcode(raw)) {
        return {
          code: cleanBarcodeText(raw),
          rawText: raw,
          format: String(result.getBarcodeFormat()),
        };
      }
    }
  } catch {
    // Nie znaleziono kodu kreskowego
  }

  return null;
}
