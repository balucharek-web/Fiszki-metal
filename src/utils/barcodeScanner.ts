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
 * Czyści odczytany kod kreskowy (np. kody paczkowe/odbioru z sufiksem XX...).
 */
export function cleanBarcodeText(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('XX')) {
    return trimmed.split('XX')[0].trim();
  }
  return trimmed;
}

/**
 * Skanuje obraz i dekoduje kody kreskowe (Code 128, EAN-13, EAN-8, QR, Code 39, ITF itp.)
 * Działa w 100% lokalnie w przeglądarce, bez potrzeby serwera ani połączenia z internetem.
 */
export async function scanBarcodeClientSide(imageUrl: string): Promise<DecodedBarcodeResult | null> {
  // 1. Próba użycia natywnego BarcodeDetector (Chrome / Android / Edge)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const formats = [
        'code_128',
        'ean_13',
        'ean_8',
        'code_39',
        'qr_code',
        'upc_a',
        'upc_e',
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
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        const raw = barcodes[0].rawValue;
        return {
          code: cleanBarcodeText(raw),
          rawText: raw,
          format: barcodes[0].format || 'BARCODE',
        };
      }
    } catch (err) {
      console.warn('Natywny BarcodeDetector nie znalazł kodu, próba ZXing:', err);
    }
  }

  // 2. Dekodowanie silnikiem ZXing (MultiFormatReader z binarizerem)
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
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.DATA_MATRIX,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new MultiFormatReader();
    reader.setHints(hints);
    const result = reader.decode(bitmap);

    if (result && result.getText()) {
      const raw = result.getText();
      return {
        code: cleanBarcodeText(raw),
        rawText: raw,
        format: String(result.getBarcodeFormat()),
      };
    }
  } catch {
    // Nie znaleziono kodu kreskowego
  }

  return null;
}
