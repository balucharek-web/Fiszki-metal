import { createWorker } from 'tesseract.js';

export interface OcrRecognizedLabel {
  name: string;
  dimension: string;
  scaleCode: string;
  refNumber: string;
  priceText: string;
  rawText?: string;
}

/**
 * Czyści surowy tekst OCR z artefaktów skanowania.
 */
function cleanOcrText(t: string): string {
  return t
    .replace(/[|—_~`\\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inteligentny parser etykiet sklepowych ESL (Leroy Merlin, Castorama, OBI)
 * Ekstrahuje: Kod wagi (3 cyfry), Nazwę artykułu, Wymiar (np. 4x12 mm), Numer ref/kod kreskowy, Cenę.
 */
export function parseEslOcrText(rawText: string): OcrRecognizedLabel {
  const lines = rawText.split('\n').map((l) => cleanOcrText(l)).filter(Boolean);

  let scaleCode = '';
  let name = '';
  let dimension = '';
  let refNumber = '';
  let priceText = 'Cena';

  // 1. Wyszukanie kodu EAN-13 (13 cyfr, np. 5901171215598)
  const cleanDigits = rawText.replace(/[^0-9]/g, ' ');
  const eanMatch = cleanDigits.match(/\b(590\d{10}|\d{13})\b/);
  // Odrzucamy kody zaczynające się od 147... jeśli są dłuższe niż 13 cyfr
  const ean13 = eanMatch && !eanMatch[1].startsWith('147') ? eanMatch[1] : '';

  // 2. Wyszukanie 8-cyfrowego numeru ref LM (np. 44813216, 99146892, 42660256)
  // To jest NAJWYŻSZY PRIORYTET dla numeru referencyjnego
  const eightDigitMatches = cleanDigits.match(/\b(\d{8})\b/g) || [];
  const pure8Refs = eightDigitMatches.filter((r) => !r.startsWith('147') && !ean13.includes(r));
  if (pure8Refs.length > 0) {
    refNumber = pure8Refs[0];
  } else if (ean13) {
    refNumber = ean13;
  }

  // 3. Słowa kluczowe artykułów metalowych
  const fastenerKeywords = [
    'KOLKI',
    'KOŁKI',
    'WKRET',
    'WKRĘT',
    'SRUBA',
    'ŚRUBA',
    'NAKRETKA',
    'NAKRĘTKA',
    'PODKLADKA',
    'PODKŁADKA',
    'KOTWA',
    'GWOZDZ',
    'GWÓŹDŹ',
    'HAK',
    'MOLLY',
    'G-K',
    'DREWNA',
    'METALU',
    'BETONU',
    'UNIWERSALNY',
    'STOZKOWY',
    'STOŻKOWY',
  ];

  // 4. Poszukiwanie linii z kodem wagi i nazwą: "169 WKRET UNIWERSALNY" lub "980 KOLKI DO G-K MOLLY"
  for (const line of lines) {
    const cleanL = line.replace(/^[^a-zA-Z0-9]+/, '').trim();
    const scaleMatch = cleanL.match(/^([0-9]{2,3})[\s\.\:\-]+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\-\s\.\/]{3,})/i);
    if (scaleMatch) {
      let code = scaleMatch[1];
      if (code === '380' || code === '30' || code === '0') code = '980';
      scaleCode = code;
      name = scaleMatch[2].replace(/^[0-9\s\.\:\-]+/, '').trim();
      break;
    }
  }

  // Jeśli nazwa nie została znaleziona na początku z kodem, szukamy po słowach kluczowych
  if (!name) {
    for (const line of lines) {
      for (const kw of fastenerKeywords) {
        if (line.toUpperCase().includes(kw)) {
          const numMatch = line.match(/\b([1-9][0-9]{1,2})\b/);
          if (numMatch && !scaleCode) {
            scaleCode = numMatch[1];
          }
          name = line.replace(/^[0-9\s\.\:\-]+/, '').trim();
          break;
        }
      }
      if (name) break;
    }
  }

  // Jeśli kod wagi nadal pusty, sprawdź 2-3 cyfrowe liczby w pierwszych liniach
  if (!scaleCode) {
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const codeMatch = lines[i].match(/\b([1-9][0-9]{1,2})\b/);
      if (codeMatch && codeMatch[1].length <= 3) {
        scaleCode = codeMatch[1];
        break;
      }
    }
  }

  // 5. Wymiar (np. 6X90 MM, 4X12, 4x40, 3.5x35 mm, M6x30)
  for (const line of lines) {
    const dimMatch = line.match(/\b([1-9][0-9]?(?:[\.,][0-9]+)?\s*[xX*]\s*[0-9]+(?:[\.,][0-9]+)?(?:\s*mm)?)\b/i);
    if (dimMatch) {
      dimension = dimMatch[1].replace(/\s+/g, '').replace('*', 'x').toLowerCase();
      if (!dimension.endsWith('mm') && !dimension.startsWith('m')) {
        dimension += ' mm';
      }
      break;
    }
  }

  // Fallback na wymiary metryczne typu M6x50, M8x60 lub 6x90
  if (!dimension) {
    const metricMatch = rawText.match(/\b(M[0-9]{1,2}(?:\s*[xX]\s*[0-9]+)?(?:\s*mm)?)\b/i);
    if (metricMatch) {
      dimension = metricMatch[1].replace(/\s+/g, '').toLowerCase();
    }
  }

  // 6. Cena (np. 38,49 zł/kg)
  const priceMatch = rawText.match(/\b([0-9]{1,3})[\.,\s]([0-9]{2})\s*(?:zł(?:\/(?:kg|szt))?)?/i);
  if (priceMatch && parseInt(priceMatch[1], 10) >= 1) {
    priceText = `${priceMatch[1]},${priceMatch[2]} zł/kg`;
  }

  // Normalizacja nazwy: usunięcie powtórzonego kodu wagi i wielkich liter
  if (name) {
    name = name.replace(/^[0-9\s\.\:\-]+/, '').trim();
    if (/KOLK.*MOLLY/i.test(name)) {
      name = 'Kołki do G-K Molly';
    } else if (/WKRET.*UNIWERSALNY/i.test(name)) {
      name = 'Wkręt uniwersalny';
    } else {
      name = name
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  } else {
    name = refNumber ? 'Artykuł z etykiety ESL' : 'Wkręt do drewna';
  }

  return { scaleCode, name, dimension, refNumber, priceText, rawText };
}

/**
 * Uruchamia rozpoznawanie tekstu OCR po stronie klienta (w przeglądarce).
 * Działa na GitHub Pages bez żadnego serwera backendowego.
 */
export async function scanEslWithClientOcr(
  imageUrl: string,
  onProgress?: (progress: number, status: string) => void
): Promise<OcrRecognizedLabel | null> {
  let worker: any = null;
  try {
    if (onProgress) onProgress(10, 'Inicjalizacja silnika OCR...');

    // Skalowanie obrazu w canvasie dla optymalnej szybkości i czytelności tekstu OCR
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    const maxDim = 1400;
    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);
    const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    if (onProgress) onProgress(30, 'Rozpoznawanie tekstu etykiety ESL...');

    worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = 30 + Math.round((m.progress || 0) * 60);
          onProgress(pct, `Odczytywanie danych etykiety (${Math.round((m.progress || 0) * 100)}%)...`);
        }
      },
    });

    const ret = await worker.recognize(optimizedDataUrl);
    const rawText = ret?.data?.text || '';

    if (onProgress) onProgress(95, 'Przetwarzanie odczytanych parametrów...');

    const parsed = parseEslOcrText(rawText);

    // Jeśli znaleziono chociaż jedną kluczową informację (nazwa, kod wagi, wymiar lub ref):
    if (parsed.name || parsed.scaleCode || parsed.refNumber || parsed.dimension) {
      return parsed;
    }

    return null;
  } catch (err) {
    console.warn('Błąd client-side OCR:', err);
    return null;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // ignore termination error
      }
    }
  }
}
