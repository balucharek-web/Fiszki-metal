/**
 * Narzędzie stabilizacji obrazu i eliminacji rozmycia od drgań ręki (Motion Blur Reduction)
 * dla skanera etykiet i kodów kreskowych.
 */

// Pomocniczy canvas do szybkich obliczeń ostrości w czasie rzeczywistym
let analysisCanvas: HTMLCanvasElement | null = null;
let analysisCtx: CanvasRenderingContext2D | null = null;

function getAnalysisContext(w = 120, h = 90): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!analysisCanvas) {
    analysisCanvas = document.createElement('canvas');
  }
  if (analysisCanvas.width !== w || analysisCanvas.height !== h) {
    analysisCanvas.width = w;
    analysisCanvas.height = h;
  }
  if (!analysisCtx) {
    analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!analysisCtx) return null;
  return { canvas: analysisCanvas, ctx: analysisCtx };
}

/**
 * Pobiera próbkę klatki w skali szarości o zredukowanej rozdzielczości (do analizy ruchu i ostrości w czasie O(1)).
 */
export function getDownsampledGrayscale(
  video: HTMLVideoElement,
  w = 120,
  h = 90
): Uint8Array | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) return null;

  const holder = getAnalysisContext(w, h);
  if (!holder) return null;
  const { ctx } = holder;

  // Rysujemy klatkę zmniejszoną
  ctx.drawImage(video, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const gray = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    // Standardowa luminancja Rec. 601
    gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) | 0;
  }

  return gray;
}

/**
 * Oblicza wskaźnik ostrości klatki (wariancja operatora Laplace'a).
 * Klatka ostra (nieruchomy aparat) ma wyraźne krawędzie -> wysoki wskaźnik (> 50).
 * Klatka poruszona (drżenie ręki, rozmycie ruchu) ma rozmyte krawędzie -> niski wskaźnik (< 25).
 */
export function calculateLaplacianSharpness(gray: Uint8Array, w = 120, h = 90): number {
  if (gray.length !== w * h) return 0;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Filtr Laplace'a 3x3 na wnętrzu obrazu
  // [  0,  1,  0 ]
  // [  1, -4,  1 ]
  // [  0,  1,  0 ]
  for (let y = 1; y < h - 1; y++) {
    const rowOffset = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = rowOffset + x;
      const lap =
        gray[idx - w] +
        gray[idx + w] +
        gray[idx - 1] +
        gray[idx + 1] -
        4 * gray[idx];

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return variance;
}

/**
 * Oblicza różnicę ruchu pomiędzy dwoma kolejnymi klatkami.
 * Wartość bliska 0 oznacza, że telefon trzymany jest idealnie nieruchomo.
 * Wartość powyżej 12-15 oznacza gwałtowny ruch lub trzęsącą się rękę.
 */
export function calculateMotionDifference(prevGray: Uint8Array, currentGray: Uint8Array): number {
  if (prevGray.length !== currentGray.length || prevGray.length === 0) return 999;

  let totalDiff = 0;
  const len = prevGray.length;
  // Próbkujemy co drugi piksel dla maksymalnej wydajności
  let sampled = 0;
  for (let i = 0; i < len; i += 2) {
    totalDiff += Math.abs(prevGray[i] - currentGray[i]);
    sampled++;
  }

  return totalDiff / sampled;
}

/**
 * TECHNOLOGIA ANTI-SHAKE BURST (Najostrzejsza klatka z serii):
 * Gdy użytkownik klika przycisk migawki, dotknięcie ekranu niemal zawsze powoduje
 * mikroskopijne szarpnięcie aparatem w pierwszym ułamku sekundy.
 *
 * Funkcja ta błyskawicznie zbiera serię 4 klatek w odstępie 30-40 ms (~120 ms łącznie),
 * wylicza ostrość krawędzi dla każdej z nich i zwraca klatkę o NAJWYŻSZEJ ostrości!
 */
export async function captureSharpestFrameFromVideo(
  video: HTMLVideoElement,
  burstCount = 4,
  intervalMs = 35
): Promise<{ dataUrl: string; sharpnessScore: number }> {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;

  const frames: { dataUrl: string; score: number }[] = [];

  for (let i = 0; i < burstCount; i++) {
    // 1. Zrzut pełnej klatki
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = vw;
    fullCanvas.height = vh;
    const fullCtx = fullCanvas.getContext('2d');
    if (fullCtx) {
      fullCtx.drawImage(video, 0, 0, vw, vh);
      const dataUrl = fullCanvas.toDataURL('image/jpeg', 0.92);

      // 2. Szybkie wyliczenie ostrości
      const gray = getDownsampledGrayscale(video, 120, 90);
      const score = gray ? calculateLaplacianSharpness(gray, 120, 90) : 0;

      frames.push({ dataUrl, score });
    }

    if (i < burstCount - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  if (frames.length === 0) {
    throw new Error('Nie udało się przechwycić klatki z kamery');
  }

  // Wybieramy klatkę z najwyższym wynikiem ostrości
  frames.sort((a, b) => b.score - a.score);
  return {
    dataUrl: frames[0].dataUrl,
    sharpnessScore: Math.round(frames[0].score),
  };
}
