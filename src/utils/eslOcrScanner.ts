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
 * Koryguje częste zamiany cyfr na litery w druku igłowym/e-papierze:
 * B->8, I/l/|/!->1, O->0, S->5, Z->2, G/q->9, A->4
 */
export function healDigitString(str: string): string {
  if (!str) return '';
  const converted = str
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL|!]/g, '1')
    .replace(/B/g, '8')
    .replace(/S/g, '5')
    .replace(/Z/g, '2')
    .replace(/G|Q/g, '9')
    .replace(/^A(?=\d{6,7})/i, '4'); // np. A4813216 -> 44813216

  return /^\d{7,8}$/.test(converted) ? converted : '';
}

/**
 * Niezawodny ekstraktor numeru referencyjnego Leroy Merlin (LM):
 * 1. Wykrywa numery 8- i 7-cyfrowe (np. 44813216, 99146892, 42660250)
 * 2. Łączy grupy 4+4 cyfry rozdzielone spacją ("4481 3216" -> "44813216")
 * 3. Wyszukuje numer linijkę nad słowem "ZAPAS" (układ na etykiecie ESL)
 * 4. Obsługuje przedrostki REF:, LM, ART, KOD
 * 5. Wykonuje sliding-window z korektą liter (44B13216 -> 44813216)
 */
export function extractLmReferenceNumber(rawText: string, ignoredEan = ''): string {
  if (!rawText) return '';

  const isValidRef = (cand: string) => {
    if (!cand) return false;
    if (ignoredEan && ignoredEan.includes(cand)) return false;
    if (cand.startsWith('147') && cand.length >= 8) return false; // Hardware ID tagu
    return cand.length >= 7 && cand.length <= 8;
  };

  // Wzorzec 1: Bezpośrednio przed lub nad słowem "ZAPAS" (układ etykiety ESL)
  const zapasMatch = rawText.match(/([0-9A-Za-z|!]{7,8})\s*(?:\n|\r|\s)+ZAPAS/i);
  if (zapasMatch && zapasMatch[1]) {
    const healed = healDigitString(zapasMatch[1]);
    if (isValidRef(healed)) return healed;
  }

  // Wzorzec 2: Z przedrostkiem REF / LM / ART / KOD / INDEX
  const prefixMatch = rawText.match(/(?:REF|LM|ART|KOD|INDEX|NR)\s*[:\.\-]?\s*([0-9A-Za-z|!\s]{7,10})/i);
  if (prefixMatch && prefixMatch[1]) {
    const compact = prefixMatch[1].replace(/[\s\.\-]/g, '');
    const healed = healDigitString(compact);
    if (isValidRef(healed)) return healed;
  }

  // Wzorzec 3: Dwie grupy 4-cyfrowe rozdzielone spacją lub myślnikiem ("4481 3216" lub "4481-3216")
  const splitGroupMatch = rawText.match(/\b([0-9A-Za-z]{4})[\s\.\-]([0-9A-Za-z]{4})\b/g);
  if (splitGroupMatch) {
    for (const m of splitGroupMatch) {
      const combined = m.replace(/[\s\.\-]/g, '');
      const healed = healDigitString(combined);
      if (isValidRef(healed)) return healed;
    }
  }

  // Wzorzec 4: Czyste 8 cyfr w tekście
  const cleanDigits = rawText.replace(/[^0-9]/g, ' ');
  const eightDigitMatches = cleanDigits.match(/\b(\d{8})\b/g) || [];
  for (const m of eightDigitMatches) {
    if (isValidRef(m)) return m;
  }

  // Wzorzec 5: Sliding-window po tokenach z korektą liter (np. 44B13216, 448132l6, LAB13216)
  const words = rawText.split(/\s+/);
  for (const w of words) {
    const cleaned = w.replace(/^[^0-9A-Za-z|!]+|[^0-9A-Za-z|!]+$/g, '');
    if (cleaned.length >= 7) {
      for (let i = 0; i <= cleaned.length - 8; i++) {
        const sub = cleaned.slice(i, i + 8);
        const healed = healDigitString(sub);
        if (isValidRef(healed)) return healed;
      }
      if (cleaned.length === 7) {
        const healed = healDigitString(cleaned);
        if (isValidRef(healed)) return healed;
      }
    }
  }

  // Wzorzec 6: Czyste 7 cyfr w tekście
  const sevenDigitMatches = cleanDigits.match(/\b(\d{7})\b/g) || [];
  for (const m of sevenDigitMatches) {
    if (isValidRef(m)) return m;
  }

  return '';
}

/**
 * Inteligentny parser etykiet sklepowych ESL (Leroy Merlin, Castorama, OBI)
 * Ekstrahuje wg priorytetów użytkownika:
 * 1. Numer referencyjny LM (8 cyfr, np. 44813216, 99146892)
 * 2. Kod EAN-13 (13 cyfr, np. 5901171215598) - jeśli brak 8-cyfrowego ref
 * 3. Numer na wadze (kod wagi: 2-3 cyfry, np. 169, 980, 247)
 * 4. Nazwę artykułu (np. Wkręt uniwersalny, Kołki do G-K Molly)
 * 5. Rozmiar / wymiar (np. 6x90 mm, 4x12 mm)
 * 6. Cenę (np. 38,49 zł/kg)
 * Ignoruje całkowicie pionowy kod kreskowy / ID etykiety hardware (np. kody z wykrzyknikiem lub 1474...)
 */
export function parseEslOcrText(rawText: string): OcrRecognizedLabel {
  const lines = rawText.split('\n').map((l) => cleanOcrText(l)).filter(Boolean);

  let scaleCode = '';
  let name = '';
  let dimension = '';
  let refNumber = '';
  let eanCode = '';
  let priceText = 'Cena';

  // 1. Wyszukanie kodu EAN-13 (13 cyfr, np. 5901171215598, 5905458027386)
  const cleanDigits = rawText.replace(/[^0-9]/g, ' ');
  const eanMatches = cleanDigits.match(/\b(590\d{10}|\d{13})\b/g) || [];
  if (eanMatches.length > 0 && eanMatches[0]) {
    eanCode = eanMatches[0];
  }

  // 2. Priorytet 1 dla numeru referencyjnego: 8- lub 7-cyfrowy numer referencyjny LM (np. 44813216, 99146892)
  const lmRef = extractLmReferenceNumber(rawText, eanCode);
  if (lmRef) {
    refNumber = lmRef;
  } else if (eanCode) {
    // Priorytet 2: Fallback na kod EAN-13 tylko jeśli numer referencyjny nie został znaleziony
    refNumber = eanCode;
  }

  // 3. Słowa kluczowe artykułów metalowych / złącznych
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
    'UNIWERSALNY',
    'DREWNA',
    'METALU',
    'BETONU',
    'SAMOWIERCACY',
    'STOŻKOWY',
  ];

  // Pomocnik korygujący częste zamiany cienkich cyfr w kodzie wagi (np. ISS -> 155, l69 -> 169, 98O -> 980)
  const normalizeScaleCode = (raw: string): string => {
    if (!raw) return '';
    const fixed = raw
      .trim()
      .toUpperCase()
      .replace(/O/g, '0')
      .replace(/[IL|!]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/G|Q/g, '9');

    if (/^[1-9][0-9]{1,2}$/.test(fixed)) {
      if (fixed === '380' || fixed === '30' || fixed === '0') return '980';
      return fixed;
    }
    return '';
  };

  // 4. Poszukiwanie linii z numerem na wadze i nazwą: "169 WKRET UNIWERSALNY" lub "ISS WKRET..." lub "980 KOLKI..."
  for (const line of lines) {
    const scaleMatch = line.match(/(?:^|[\s\.\:\-\>]+)([0-9A-Za-z|!]{2,3})\s+([A-ZĄĆĘŁŃÓŚŹŻa-ząćęłńóśźż0-9\-\s\.\/]{3,})/i);
    if (scaleMatch && scaleMatch[1] && scaleMatch[2]) {
      const candidate = normalizeScaleCode(scaleMatch[1]);
      if (candidate) {
        scaleCode = candidate;
        name = scaleMatch[2].trim();
        break;
      }
    }
  }

  // Jeśli nazwa nie została znaleziona na początku z kodem, szukamy po słowach kluczowych
  if (!name) {
    for (const line of lines) {
      for (const kw of fastenerKeywords) {
        if (line.toUpperCase().includes(kw)) {
          // Szukamy kodu wagi na tej samej linii
          const tokens = line.split(/\s+/);
          for (const tok of tokens) {
            const cand = normalizeScaleCode(tok);
            if (cand && !scaleCode) {
              scaleCode = cand;
              break;
            }
          }
          name = line.replace(/^[0-9\sA-Za-z|!]{1,4}\s+/, '').trim();
          break;
        }
      }
      if (name) break;
    }
  }

  // Jeśli numer na wadze nadal pusty, sprawdź kandydatów w tekście
  if (!scaleCode) {
    const rawTokens = rawText.split(/\s+/);
    for (const tok of rawTokens) {
      const cleanTok = tok.replace(/[^0-9A-Za-z|!]/g, '');
      if (cleanTok.length >= 2 && cleanTok.length <= 3) {
        const cand = normalizeScaleCode(cleanTok);
        if (cand && !refNumber.includes(cand) && !eanCode.includes(cand)) {
          scaleCode = cand;
          break;
        }
      }
    }
  }

  // 5. Rozmiar / wymiar (np. 5X40 MM, 6X90 MM, 4X12, 5X24, 4x40 mm, M6x30, 4,5x50)
  for (const line of lines) {
    if (line.includes('zł') || line.includes('zl')) continue;
    const dimMatch = line.match(/(?:^|[\s\.\:\-\|]+)([1-9][0-9]?(?:[\.,][0-9]+)?\s*[xX*]\s*[0-9]+(?:[\.,][0-9]+)?(?:\s*mm)?)(?:$|[\s\.\:\-\|]+)/i);
    if (dimMatch && dimMatch[1]) {
      const cleanDim = dimMatch[1].replace(/\s+/g, '').replace('*', 'x').toLowerCase();
      dimension = cleanDim.replace(/mm$/i, '').trim() + ' mm';
      break;
    }
  }

  // Dodatkowy fallback na wymiar typu "6X90", "4X12", "5X24", "5x40 mm"
  if (!dimension) {
    const fallbackDim = rawText.match(/\b([1-9][0-9]?(?:[\.,][0-9]+)?\s*[xX*]\s*[0-9]+(?:[\.,][0-9]+)?(?:\s*mm)?)\b/i);
    if (fallbackDim && fallbackDim[1]) {
      const cleanDim = fallbackDim[1].toLowerCase().replace(/\s+/g, '').replace('*', 'x');
      dimension = cleanDim.replace(/mm$/i, '').trim() + ' mm';
    }
  }

  // 6. Cena (np. 38,49 zł/kg, 62,49 zł/kg)
  // Ignorujemy linie z ZAPAS (stan magazynowy nie może być brany za cenę)
  const nonZapasLines = lines.filter((l) => !/ZAPAS/i.test(l));
  let foundPrice = '';

  for (const line of nonZapasLines) {
    const p1 = line.match(/\b([1-9][0-9]{0,2})[\.,\s]([0-9]{2})\s*(?:zł(?:\/kg)?|z\s*ran|zl)/i);
    if (p1) {
      foundPrice = `${p1[1]},${p1[2]} zł/kg`;
      break;
    }
  }

  if (!foundPrice) {
    for (const line of nonZapasLines) {
      const p2 = line.match(/\b([1-9][0-9]{0,2})[\.,]([0-9]{2})\b/);
      if (p2 && parseInt(p2[1], 10) >= 2) {
        foundPrice = `${p2[1]},${p2[2]} zł/kg`;
        break;
      }
    }
  }

  if (foundPrice) {
    priceText = foundPrice;
  }

  // Normalizacja nazwy
  if (name) {
    if (/KOLK.*MOLLY/i.test(name)) {
      name = 'Kołki do G-K Molly';
    } else if (/(WKRET|WKRĘT).*UNIWERSALNY/i.test(name)) {
      name = 'Wkręt uniwersalny';
    } else {
      name = name
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  } else {
    name = refNumber ? 'Artykuł z etykiety ESL' : '';
  }

  return { scaleCode, name, dimension, refNumber, priceText, rawText };
}

/**
 * Zaawansowane przetwarzanie obrazu dla wyświetlaczy ESL (e-papier):
 * 1. Wykrywanie średniej jasności i adaptacyjne rozciąganie histogramu (Percentile Stretch).
 *    Działa doskonale w ciemnych alejkach sklepowych i przy nierównomiernym świetle.
 * 2. Pogrubianie cienkich znaków (Morphological Min-Filter dla ciemnego tekstu).
 *    Cienkie, ditherowane kropki matrycy E-ink (np. 155, 44813216, 5x40 mm) zostają połączone
 *    i pogrubione o 1 px, tworząc czytelne dla OCR pełne glify.
 */
export function enhanceEslImage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options?: { boldenThinStrokes?: boolean }
): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const numPixels = w * h;

  const gray = new Uint8Array(numPixels);
  const hist = new Uint32Array(256);
  let totalLuminance = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const g = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) | 0;
    gray[i] = g;
    hist[g]++;
    totalLuminance += g;
  }

  const avgLuminance = totalLuminance / numPixels;

  // Znalezienie percentyli p2 i p97 do dynamicznego rozciągnięcia kontrastu
  let count = 0;
  let pLow = 0;
  let pHigh = 255;
  const lowTarget = Math.round(numPixels * 0.02);
  const highTarget = Math.round(numPixels * 0.97);

  for (let val = 0; val < 256; val++) {
    count += hist[val];
    if (pLow === 0 && count >= lowTarget) {
      pLow = val;
    }
    if (count >= highTarget) {
      pHigh = val;
      break;
    }
  }

  const range = Math.max(20, pHigh - pLow);
  const isLowLight = avgLuminance < 85;

  // Adaptacyjna normalizacja kontrastu
  const normalized = new Uint8Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const val = gray[i];
    let stretched = ((val - pLow) * 255) / range;
    if (stretched < 0) stretched = 0;
    if (stretched > 255) stretched = 255;

    // Krzywa kontrastu dla e-papieru:
    // W słabym świetle tło mocniej ciągniemy do bieli (255), a tekst do czerni (0)
    const whiteThreshold = isLowLight ? 150 : 165;
    const blackThreshold = isLowLight ? 85 : 75;

    if (stretched >= whiteThreshold) {
      stretched = 255;
    } else if (stretched <= blackThreshold) {
      stretched = 0;
    } else {
      stretched = ((stretched - blackThreshold) * 255) / (whiteThreshold - blackThreshold);
    }
    normalized[i] = stretched | 0;
  }

  // Pogrubianie cienkich/niewyraźnych kresek cyfr (Morphological Min-Filter dla ciemnego tekstu)
  // Poszerza ciemne piksele o 1 px, co łączy przerwane i blade punkty cyfr
  const bolden = options?.boldenThinStrokes !== false;
  const processed = new Uint8Array(numPixels);

  if (bolden) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const prevRow = y > 0 ? (y - 1) * w : row;
      const nextRow = y < h - 1 ? (y + 1) * w : row;

      for (let x = 0; x < w; x++) {
        const xPrev = x > 0 ? x - 1 : x;
        const xNext = x < w - 1 ? x + 1 : x;

        const current = normalized[row + x];
        const minCross = Math.min(
          current,
          normalized[prevRow + x],
          normalized[nextRow + x],
          normalized[row + xPrev],
          normalized[row + xNext]
        );

        // Jeśli sąsiad jest czarnym tekstem (< 70), delikatnie ściągamy piksel, pogrubiając kreskę
        if (minCross < 70) {
          processed[row + x] = Math.min(current, minCross + 20);
        } else {
          processed[row + x] = current;
        }
      }
    }
  } else {
    processed.set(normalized);
  }

  // Zapis do ImageData
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const p = processed[i];
    data[idx] = p;
    data[idx + 1] = p;
    data[idx + 2] = p;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Uruchamia rozpoznawanie tekstu OCR po stronie klienta (w przeglądarce).
 * Zawiera wstępne przetwarzanie obrazu w Canvas (rozciąganie kontrastu, pogrubianie cienkich kresek)
 * Działa w 100% lokalnie na GitHub Pages bez backendu.
 */
export async function scanEslWithClientOcr(
  imageUrl: string,
  onProgress?: (progress: number, status: string) => void,
  knownBarcode?: string
): Promise<OcrRecognizedLabel | null> {
  let worker: any = null;
  try {
    if (onProgress) onProgress(10, 'Inicjalizacja silnika OCR...');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageUrl;
    });

    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    // Canvas 1: Inteligentny kadr dla zdjęć pionowych (9:16 / 3:4) ze smartfona
    // Gdy użytkownik fotografuje etykietę, znajduje się ona w centralnym pasie kadru.
    // Odcięcie góry (śrubki w pojemniku) i dołu (dolna półka) powiększa napisy na etykiecie 2,5x,
    // dzięki czemu czcionka osiąga optymalną wysokość 35-50 px dla silnika OCR!
    const isTallPortrait = origH > origW * 1.25;
    const srcX = isTallPortrait ? Math.round(origW * 0.03) : 0;
    const srcY = isTallPortrait ? Math.round(origH * 0.22) : 0;
    const srcW = isTallPortrait ? Math.round(origW * 0.94) : origW;
    const srcH = isTallPortrait ? Math.round(origH * 0.42) : origH;

    const canvas = document.createElement('canvas');
    const maxDim = 1800;
    let w = srcW;
    let h = srcH;

    if (w > maxDim) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, w, h);

    // Zaawansowane podbicie kontrastu dla słabego światła i e-papieru
    try {
      enhanceEslImage(ctx, w, h, { boldenThinStrokes: true });
    } catch (e) {
      console.warn('Błąd enhanceEslImage:', e);
    }

    const enhancedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    if (onProgress) onProgress(30, 'Odczytywanie danych etykiety ESL...');

    worker = await createWorker('pol+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = 30 + Math.round((m.progress || 0) * 60);
          onProgress(pct, `Odczytywanie etykiety (${Math.round((m.progress || 0) * 100)}%)...`);
        }
      },
    });

    const ret = await worker.recognize(enhancedDataUrl);
    const rawText = ret?.data?.text || '';

    if (onProgress) onProgress(95, 'Przetwarzanie danych...');

    const parsed = parseEslOcrText(rawText);
    if (!parsed.refNumber && knownBarcode) {
      parsed.refNumber = knownBarcode;
    }

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
        // ignore
      }
    }
  }
}
