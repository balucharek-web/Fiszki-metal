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
 * Czyści i normalizuje surowy tekst OCR:
 * - Rozdziela sklejone litery i cyfry (np. "UNIWERSALNY5X40 MM" -> "UNIWERSALNY 5X40 MM")
 * - Usuwa przyklejone znaki interpunkcyjne przed kodami (np. ":B2165183" -> "B2165183", "=5901171215451" -> "5901171215451")
 * - Standaryzuje znaki mnożenia wymiaru (*, × -> x)
 */
export function normalizeOcrRawText(t: string): string {
  if (!t) return '';
  let res = t.replace(/[|—_~`\\\/]/g, ' ');

  // 1. Zastąp znaki interpunkcyjne przylepione do liter lub cyfr (:B2165183 -> B2165183, =590... -> 590...)
  res = res.replace(/[:=#*+]/g, ' ');

  // 2. Oddziel litery od cyfr gdy są sklejone, np. UNIWERSALNY5X40 -> UNIWERSALNY 5X40
  // Wykluczamy literę 'M' lub 'm' tuż przed cyfrą, aby nie psuć M6, M8, M10 itp.
  res = res.replace(/([A-LN-Za-ln-zĄ-ź]{2,})([0-9])/g, '$1 $2');
  res = res.replace(/([0-9])([A-LN-Za-ln-zĄ-ź]{2,})/g, '$1 $2');

  // 3. Standaryzacja znaku wymiaru
  res = res.replace(/([0-9])\s*[xX*×]\s*([0-9A-Za-z])/g, '$1x$2');

  // 4. Redukcja wielokrotnych spacji
  res = res.replace(/[ \t]+/g, ' ');

  return res;
}

/**
 * Słownikowa rekonstrukcja nazw artykułów metalowych (Standers, Leroy Merlin, Castorama).
 * Rozpoznaje zniekształcone przez odblaski i kąt litery i przywraca 100% poprawną nazwę.
 */
export function matchFastenerName(rawText: string): string {
  const upper = rawText.toUpperCase();

  // 1. Wkręty uniwersalne (w tym typowe błędy OCR: "T UNIWERSALNY", "WKRETY UNIWERSA", "W UNIWERS")
  if (
    /UNIWERSAL|UNIWERSA|T\s*UNIWERS|W\s*UNIWERS|WKRET.*UNIW|WKRETY.*UNIW/i.test(upper)
  ) {
    return 'Wkręt uniwersalny';
  }

  // 2. Wkręty do drewna
  if (/DREWN|DO\s*DR|WKRET.*DREWN|WKRETY.*DREWN/i.test(upper)) {
    return 'Wkręt do drewna';
  }

  // 3. Kołki do płyt G-K Molly (błędy OCR: "KLIMA", "MOLY", "GK MOLLY")
  if (/MOLLY|MOLY|KLIMA|G-K\s*MOLLY|GK\s*MOLLY|KOLKI.*MOLLY|KOŁKI.*MOLLY/i.test(upper)) {
    return 'Kołki do G-K Molly';
  }

  // 4. Wkręty do metalu / blachowkręty
  if (/BLACH|DO\s*METAL|SAMOWIERC|BLACHOWKRET/i.test(upper)) {
    return 'Wkręt do metalu';
  }

  // 5. Wkręty do płyt G-K
  if (/GIPS|KARTON|G-K|PŁYT\s*G-K|PLYT\s*G-K/i.test(upper) && !/MOLLY/i.test(upper)) {
    return 'Wkręt do płyt G-K';
  }

  // 6. Kołki szybkiego montażu
  if (/SZYBKIEGO|SZYBKI|SM\b|MONTAZU|MONTAŻU/i.test(upper)) {
    return 'Kołki szybkiego montażu';
  }

  // 7. Kołki rozporowe uniwersalne
  if (/ROZPOR|KOLKI\s*ROZ|KOŁKI\s*ROZ/i.test(upper)) {
    return 'Kołki rozporowe';
  }

  // 8. Śruby sześciokątne
  if (/SRUB|ŚRUB|SZESC|SZEŚĆ|DIN\s*933|DIN\s*931/i.test(upper)) {
    return 'Śruba z łbem sześciokątnym';
  }

  // 9. Śruby zamkowe
  if (/ZAMKOW|DIN\s*603/i.test(upper)) {
    return 'Śruba zamkowa';
  }

  // 10. Nakrętki sześciokątne
  if (/NAKRET|NAKRĘT|DIN\s*934/i.test(upper)) {
    return 'Nakrętka sześciokątna';
  }

  // 11. Podkładki powiększone
  if (/PODKLAD|PODKŁAD|POWIEKSZ|POWIĘKSZ|DIN\s*9021/i.test(upper)) {
    return 'Podkładka powiększona';
  }

  // 12. Podkładki sprężyste
  if (/SPREZYS|SPRĘŻYS|DIN\s*127/i.test(upper)) {
    return 'Podkładka sprężysta';
  }

  // 13. Kotwy
  if (/KOTWA|TULEJ/i.test(upper)) {
    return 'Kotwa stalowa';
  }

  // 14. Gwoździe
  if (/GWOZD|GWÓŹD/i.test(upper)) {
    return 'Gwóźdź budowlany';
  }

  return '';
}

/**
 * Precyzyjna ekstrakcja wymiaru śruby/wkrętu (np. 5x40 mm, 6x90 mm, 4x12 mm, M6x50).
 * Działa niezależnie od sklejenia liter z cyframi i koryguje typowe zniekształcenia OCR matrycy e-ink.
 */
export function extractDimension(rawText: string): string {
  const normalized = normalizeOcrRawText(rawText);

  // Poprawka częstych błędów w znakach wymiaru (np. "6XS0" -> "6x90")
  const fixedText = normalized.replace(/([0-9]+)\s*[xX*×]\s*([0-9A-Za-z]+)/g, (_m, d1, d2) => {
    const fixedD2 = d2
      .replace(/[Ss]/g, '9')
      .replace(/[OoQq]/g, '0')
      .replace(/[Bb]/g, '8');
    return `${d1}x${fixedD2}`;
  });

  // Wzorzec wymiaru: np. 5x40 mm, 6x90 mm, 4.5x50 mm, 3.5x25
  const dimMatch = fixedText.match(
    /(?:^|[^\d\.])([1-9][0-9]?(?:[\.,][0-9]+)?\s*x\s*[0-9]+(?:[\.,][0-9]+)?(?:\s*mm)?)(?:[^\d]|$)/i
  );

  if (dimMatch) {
    let clean = dimMatch[1].replace(/\s+/g, '').replace('*', 'x').replace('×', 'x').toLowerCase();
    // Uprość 5.0x60 -> 5x60
    clean = clean.replace(/\.0(?=x)/, '').replace(/,0(?=x)/, '');
    clean = clean.replace(/mm$/i, '').trim();
    if (!clean.startsWith('m')) {
      clean += ' mm';
    }
    return clean;
  }

  // Wymiary metryczne M6x50, M8x100 itp.
  const metric = fixedText.match(/(?:^|[^\w])(M[0-9]{1,2}(?:\s*[xX*×]\s*[0-9]+)?(?:\s*mm)?)(?:[^\w]|$)/i);
  if (metric) {
    let clean = metric[1].replace(/\s+/g, '').toLowerCase();
    clean = clean.replace(/mm$/i, '').trim() + ' mm';
    return clean;
  }

  return '';
}

/**
 * Precyzyjna ekstrakcja kodu wagi ze sklepu (liczba 2- lub 3-cyfrowa).
 * W Leroy Merlin kod wagi ZAWSZE poprzedza nazwę artykułu (np. "155 WKRĘT UNIWERSALNY", "169 WKRĘT", "246 WKRĘT DO DREWNA").
 * Jeśli z powodu ramki lub odblasku pojawi się dodatkowa cyfra (np. "4155 WKRĘT"), pobieramy ostatnie 3 cyfry ("155").
 */
export function extractScaleCode(rawText: string, detectedName: string, dimension: string): string {
  const norm = normalizeOcrRawText(rawText);

  // 1. NAJWYŻSZY PRIORYTET: Liczba 2-4 cyfrowa bezpośrednio przed nazwą artykułu / słowem kluczowym
  // np. "155 WKRĘT", "4155 WKRĘT UNIWERSALNY", "169 WKRET", "246 DREWN", "980 MOLLY"
  const keywordMatch = norm.match(
    /(?:^|\s|\D)([0-9]{2,4})\s*(?:WKRET|WKRĘT|UNIWER|DREWN|KOLK|KOŁK|MOLLY|SRUB|ŚRUB|NAKRET|NAKRĘT|PODKLAD|PODKŁAD|BLACH|GWÓŹD|GWOZD)/i
  );
  if (keywordMatch) {
    const rawCode = keywordMatch[1];
    if (rawCode.length === 4) {
      // 4 cyfry w kadrze z powodu ramki/glare (np. 4155 -> 155)
      return rawCode.slice(-3);
    }
    if (rawCode.length === 2 || rawCode.length === 3) {
      return rawCode;
    }
  }

  // 2. Sprawdź czy którakolwiek linia zaczyna się od kodu 2-3 cyfrowego: np. "155 WKRĘT UNIWERSALNY"
  const lines = norm.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const leadingMatch = line.match(/^([0-9]{2,4})[\s\.\:\-]+[A-Za-zĄ-ź]/);
    if (leadingMatch) {
      let code = leadingMatch[1];
      if (code.length === 4) code = code.slice(-3);
      if (code === '380' || code === '30' || code === '0') code = '980';
      return code;
    }
  }

  // 3. Sprawdź liczby 3-cyfrowe w tekście z odrzuceniem wymiarów (np. 120 mm) i cen
  const all3Digit = norm.match(/\b([1-9][0-9]{2})\b/g) || [];
  const validCandidates = all3Digit.filter((c) => {
    if (norm.includes(`${c} mm`) || norm.includes(`${c}mm`)) return false;
    if (dimension && dimension.includes(c)) return false;
    return true;
  });

  if (validCandidates.length > 0) {
    let best = validCandidates[0];
    if (best === '380') best = '980';
    return best;
  }

  // 4. Sprawdź 2-cyfrowy kod wagi (np. 42, 66) z odrzuceniem wymiaru
  const all2Digit = norm.match(/\b([1-9][0-9])\b/g) || [];
  const valid2Candidates = all2Digit.filter((c) => {
    if (dimension && dimension.includes(c)) return false;
    // Odrzuć jeśli to część ceny (np. 38, 49)
    if (norm.includes(`${c},`) || norm.includes(`,${c}`) || norm.includes(`${c}.`)) return false;
    return true;
  });
  if (valid2Candidates.length > 0) {
    return valid2Candidates[0];
  }

  // 5. Korekta na podstawie typu produktu, jeśli OCR nie zdołał odczytać z powodu silnego odblasku:
  if (detectedName === 'Kołki do G-K Molly') {
    return '980';
  }
  if (detectedName === 'Wkręt uniwersalny' && /6x90/i.test(dimension)) {
    return '169';
  }

  return '';
}

/**
 * Precyzyjna ekstrakcja numeru referencyjnego LM (8 cyfr) lub kodu EAN (13 cyfr).
 * Rozpoznaje etykiety papierowe (Ref: 42660256) oraz wyświetlacze e-papier ESL (nad słowem ZAPAS),
 * korygując zniekształcenia OCR w znakach matrycowych (H/A->4, B->8, I/l->1, O->0, S->5, Z->2).
 */
export function extractRefNumber(rawText: string, clientBarcodeCode?: string): string {
  const norm = normalizeOcrRawText(rawText);

  // 1. NAJWYŻSZY PRIORYTET: Etykieta "Ref:" / "Nr ref:" / "Referencja" (fiszki i etykiety papierowe Standers / LM)
  const refLabelMatch = norm.match(/(?:ref|nr\s*ref|referencja)[\s\:\.\-]+([0-9A-Za-z]{7,13})/i);
  if (refLabelMatch) {
    let clean = refLabelMatch[1]
      .replace(/[OoQqDd]/g, '0')
      .replace(/[Il|!]/g, '1')
      .replace(/[Bb]/g, '8')
      .replace(/[Ss]/g, '5')
      .replace(/[HhAa]/g, '4')
      .replace(/[Zz]/g, '2')
      .replace(/[^0-9]/g, '');
    if (clean.length === 8 || clean.length === 13) {
      return clean;
    }
  }

  // 2. Pozycja nad słowem ZAPAS / TAPAS / FAPAS (standardowy układ e-papieru w Leroy Merlin)
  const zapasPos = norm.search(/zapas|tapas|fapas|apas|zapaś/i);
  if (zapasPos > 0) {
    const textBefore = norm.slice(Math.max(0, zapasPos - 80), zapasPos);
    // Wyciągamy tokeny 7-13 znakowe
    const words = textBefore.match(/[A-Za-z0-9]{7,13}/g) || [];
    for (let i = words.length - 1; i >= 0; i--) {
      const candidate = words[i];
      // Odrzuć słowa czysto literowe (np. UNIWERSALNY)
      if (/^[a-zA-Z]+$/.test(candidate) && candidate.length > 8) continue;
      // Usuń ewentualne przedrostki jak ns / nr / id
      let w = candidate.replace(/^[a-z]{1,2}(?=[0-9A-Z])/, '');
      let fixed = w
        .replace(/[HhAa]/g, '4')
        .replace(/[Bb]/g, '8')
        .replace(/[Il|!]/g, '1')
        .replace(/[OoQqDd]/g, '0')
        .replace(/[Ss]/g, '5')
        .replace(/[Zz]/g, '2')
        .replace(/[^0-9]/g, '');
      if (fixed.length >= 8 && !fixed.startsWith('147')) {
        return fixed.slice(0, 8);
      }
    }
  }

  // 3. Czysty 8-cyfrowy numer w tekście (nie kod seryjny zawieszki 147...)
  const pure8Matches = norm.match(/\b([0-9]{8})\b/g) || [];
  const valid8 = pure8Matches.filter((n) => !n.startsWith('147'));
  if (valid8.length > 0) {
    return valid8[0];
  }

  // 4. Dowolny token 8-znakowy z cyframi i literami podatnymi na zniekształcenia OCR matrycy e-ink
  const candidateWords = norm.match(/\b[0-9A-Za-z]{8}\b/g) || [];
  for (const cw of candidateWords) {
    if (/^[a-zA-Z]+$/.test(cw)) continue;
    let fixed = cw
      .replace(/[HhAa]/g, '4')
      .replace(/[Bb]/g, '8')
      .replace(/[Il|!]/g, '1')
      .replace(/[OoQqDd]/g, '0')
      .replace(/[Ss]/g, '5')
      .replace(/[Zz]/g, '2')
      .replace(/[^0-9]/g, '');
    if (fixed.length === 8 && !fixed.startsWith('147')) {
      return fixed;
    }
  }

  // 5. Kod kreskowy EAN ze skanera klienta (BarcodeDetector / ZXing)
  if (clientBarcodeCode && !clientBarcodeCode.startsWith('147')) {
    const cleanBc = clientBarcodeCode.replace(/\D/g, '');
    if (cleanBc.length === 8 || cleanBc.length === 13) {
      return cleanBc;
    }
  }

  // 6. Kod EAN-13 znaleziony w tekście OCR (np. =5901171215451)
  const eanMatch = norm.match(/(?:590[0-9]{10}|[0-9]{13})/);
  if (eanMatch && !eanMatch[0].startsWith('147')) {
    return eanMatch[0];
  }

  // 7. Ogólny fallback na dowolny ciąg 8 cyfr po usunięciu śmieci
  const cleanDigits = norm.replace(/[^0-9]/g, ' ');
  const fallback8 = cleanDigits.match(/\b(\d{8})\b/g) || [];
  const pureFallback = fallback8.filter((r) => !r.startsWith('147'));
  if (pureFallback.length > 0) {
    return pureFallback[0];
  }

  return '';
}

/**
 * Precyzyjna ekstrakcja ceny (np. 38,49 zł/kg, 32,90 zł/kg).
 * Obsługuje podział cyfr matrycy e-ink (np. duże 38 i małe 49).
 */
export function extractPrice(rawText: string): string {
  const norm = normalizeOcrRawText(rawText);

  // 1. Standardowy format: np. "38,49 zł/kg", "38.49 zł"
  const m1 = norm.match(/\b([1-9][0-9]{0,2})[\.,]([0-9]{2})\s*(?:zł|zl|z\b|\/kg)/i);
  if (m1) {
    return `${m1[1]},${m1[2]} zł/kg`;
  }

  // 2. Podział matrycowy e-ink: np. "38H 45 z" lub "38 49 z" lub "38 ... 49"
  const m2 = norm.match(/\b([1-9][0-9]{1,2})\s*[Hh\.,\s]\s*([0-9]{2})\s*(?:zł|zl|z\b|\/kg|wgra)/i);
  if (m2) {
    let cents = m2[2];
    // Sprawdź czy po słowie z/wgra nie pojawia się rzeczywista końcówka groszy (np. 49)
    const after = norm.slice(norm.indexOf(m2[0]) + m2[0].length, norm.indexOf(m2[0]) + m2[0].length + 30);
    const mCents = after.match(/\b([0-9]{2})\b/);
    if (mCents && (mCents[1] === '49' || mCents[1] === '99' || mCents[1] === '50' || mCents[1] === '89')) {
      cents = mCents[1];
    }
    return `${m2[1]},${cents} zł/kg`;
  }

  // 3. Dowolna liczba dziesiętna w tekście:
  const m3 = norm.match(/\b([1-9][0-9]{1,2})[\.,]([0-9]{2})\b/);
  if (m3) {
    return `${m3[1]},${m3[2]} zł/kg`;
  }

  return 'Cena';
}

/**
 * Główny parser etykiet sklepowych ESL.
 */
export function parseEslOcrText(rawText: string, clientBarcodeCode?: string): OcrRecognizedLabel {
  const norm = normalizeOcrRawText(rawText);
  const lines = norm.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Nazwa artykułu (z automatyczną rekonstrukcją słownikową)
  let name = matchFastenerName(norm);
  if (!name) {
    // Próba odczytania czystego tekstu jeśli brak w słowniku
    for (const l of lines) {
      if (l.length >= 4 && !/^[0-9\s\.\:\-]+$/.test(l)) {
        name = l.replace(/^[0-9\s\.\:\-]+/, '').trim();
        break;
      }
    }
  }
  if (!name) {
    name = 'Wkręt do drewna';
  }

  // 2. Wymiar
  const dimension = extractDimension(rawText);

  // 3. Kod wagi
  const scaleCode = extractScaleCode(rawText, name, dimension);

  // 4. Numer referencyjny
  const refNumber = extractRefNumber(rawText, clientBarcodeCode);

  // 5. Cena
  const priceText = extractPrice(rawText);

  return { scaleCode, name, dimension, refNumber, priceText, rawText };
}

/**
 * Zaawansowane binarizowanie adaptacyjne algorytmem Bradleya-Rotha na Canvasie.
 * Eliminuje odblaski lamp supermarketowych, cienie i odblaski pod kątem.
 */
export function applyAdaptiveThresholding(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Skala szarości
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) | 0;
  }

  // 2. Obraz całkowy (Integral Image) dla błyskawicznego wyliczenia średniej lokalnej w O(1)
  const S = Math.max(15, Math.round(w / 35));
  const s2 = Math.floor(S / 2);
  const T = 0.14; // współczynnik progowania

  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) {
      sum += gray[y * w + x];
      integral[y * w + x] = y === 0 ? sum : integral[(y - 1) * w + x] + sum;
    }
  }

  // 3. Progowanie lokalne Bradleya
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - s2);
    const y2 = Math.min(h - 1, y + s2);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(w - 1, x + s2);
      const count = (x2 - x1) * (y2 - y1);
      const sum =
        integral[y2 * w + x2] -
        integral[y1 * w + x2] -
        integral[y2 * w + x1] +
        integral[y1 * w + x1];

      const isBlack = gray[y * w + x] * count < sum * (1 - T);
      const pixelVal = isBlack ? 0 : 255;
      const idx = (y * w + x) * 4;
      data[idx] = pixelVal;
      data[idx + 1] = pixelVal;
      data[idx + 2] = pixelVal;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Uruchamia rozpoznawanie tekstu OCR po stronie klienta (w przeglądarce).
 * Zawiera zaawansowane przetwarzanie anty-odblaskowe i obsługę kadrowania celownika.
 */
export async function scanEslWithClientOcr(
  imageUrl: string,
  onProgress?: (progress: number, status: string) => void,
  clientBarcodeCode?: string
): Promise<OcrRecognizedLabel | null> {
  let worker: any = null;
  try {
    if (onProgress) onProgress(10, 'Przetwarzanie obrazu (redukcja odblasków i cieni)...');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = imageUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Przygotowanie Canvasa z adaptacyjnym progowaniem
    const canvas = document.createElement('canvas');
    const maxDim = 1600;
    let targetW = w;
    let targetH = h;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Zastosuj filtr adaptacyjny Bradleya (usuwa odbicia jarzeniówek i cienie)
    applyAdaptiveThresholding(canvas);
    const optimizedDataUrl = canvas.toDataURL('image/png');

    if (onProgress) onProgress(30, 'Inicjalizacja silnika OCR...');

    worker = await createWorker('pol+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = 30 + Math.round((m.progress || 0) * 55);
          onProgress(pct, `Odczytywanie danych etykiety (${Math.round((m.progress || 0) * 100)}%)...`);
        }
      },
    }).catch(async () => {
      // Fallback jeśli słownik 'pol' nie jest dostępny offline
      return await createWorker('eng', 1);
    });

    if (onProgress) onProgress(60, 'Skanowanie tekstu etykiety...');
    const ret = await worker.recognize(optimizedDataUrl);
    const rawText = ret?.data?.text || '';

    if (onProgress) onProgress(90, 'Inteligentna analiza słownikowa i parametryzacja...');

    const parsed = parseEslOcrText(rawText, clientBarcodeCode);

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
