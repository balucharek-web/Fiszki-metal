import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// High limit for base64 photo uploads
app.use(express.json({ limit: '30mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

app.post('/api/scan-esl', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Brak danych zdjęcia' });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.includes(';base64,')
      ? imageBase64.split(';base64,')[1]
      : imageBase64.replace(/^data:[^;]+;base64,/, '');

    // Normalize mimeType for Gemini Vision
    let safeMime = (mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validMimes.includes(safeMime)) {
      safeMime = 'image/jpeg';
    }

    const promptText = `Jesteś wyspecjalizowanym systemem OCR do etykiet regałowych ESL (elektroniczne etykiety cenowe e-papier/LCD, np. Leroy Merlin / Standers) oraz etykiet papierowych z działu metalowego (śruby, wkręty, nakrętki, kołki).

BARDZO WAŻNE REGUŁY EKSTRAKCJI:
1. PIONOWY KOD KRESKOWY PO PRAWEJ STRONIE (NA RAMCE/OBUDOWIE ETYKIETY ESL):
   - BEZWZGLĘDNIE ZIGNORUJ pionowy kod kreskowy! To jest techniczny kod seryjny zawieszki ESL (np. 1474507509...). NIGDY nie używaj go jako numeru referencyjnego ani kodu wagi!

2. NUMER REFERENCYJNY (refNumber):
   - NAJWYŻSZY PRIORYTET: 8-cyfrowy numer referencyjny artykułu Leroy Merlin (np. "44813216", "99146892", "42660255", "42660256").
   - Na elektronicznych wyświetlaczach ESL e-papier znajduje się on ZAWSZE w lewej kolumnie, POD rozmiarem (np. pod "6X90 MM" lub "4X12") i DOKŁADNIE NAD słowem "ZAPAS: X".
   - Na fiszkach i etykietach papierowych znajduje się obok napisu "Ref:" (np. "Ref: 42660256").
   - DRUGI PRIORYTET (gdyby 8-cyfrowy ref był niewidoczny): 13-cyfrowy kod EAN towaru z poziomego kodu kreskowego na dole wyświetlacza (usuń przyrostek tekstu np. "APS").
   - Wartość refNumber musi zawierać wyłącznie czyste cyfry (8 lub 13 cyfr).

3. KOD WAGI / NUMER NA WADZE (scaleCode):
   - ZAWSZE go odczytaj! To liczba 2- lub 3-cyfrowa (np. "169", "246", "980", "170", "247").
   - ZWYKLE znajduje się NA SAMYM POCZĄTKU pierwszej linijki tekstu przed nazwą (np. z "169 WKRĘT UNIWERSALNY" kod wagi to "169").
   - Może być też w osobnym polu lub wyróżniony dużą czcionką.

4. NAZWA ARTYKUŁU (name):
   - Nazwa towaru bez kodu wagi z początku (np. z "169 WKRĘT UNIWERSALNY" wyodrębnij "Wkręt uniwersalny").

5. ROZMIAR / WYMIAR (dimension):
   - Wymiar produktu (np. "6x90 mm", "5x70 mm", "4x12 mm", "4.5x50 mm", "M6x50"). Zawsze dodaj "mm".

6. CENA (priceText):
   - Cena z jednostką (np. "38,49 zł/kg", "62,49 zł/kg" lub domyślnie "Cena").

7. WIELE POZYCJI:
   - Skup się na głównej etykiecie na pierwszym planie. Jeśli w kadrze jest listwa z kilkoma ostrymi etykietami, zwróć je po kolei.`;

    const modelConfig = {
      systemInstruction:
        'Zwracaj wyłącznie tablicę JSON z odczytanymi danymi etykiet. Ignoruj pionowe kody seryjne ESL (zaczynające się od 147). Bezwzględnie odczytaj 8-cyfrowy numer referencyjny artykułu LM (znajdujący się nad słowem ZAPAS), kod wagi (np. 169, 980), wymiar oraz nazwę.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Nazwa artykułu bez numeru wagi z początku',
            },
            dimension: {
              type: Type.STRING,
              description: 'Wymiar produktu z mm (np. 6x90 mm)',
            },
            scaleCode: {
              type: Type.STRING,
              description: '2- lub 3-cyfrowy kod wagi wpisywany na wadze (np. 169)',
            },
            refNumber: {
              type: Type.STRING,
              description: '8-cyfrowy numer referencyjny produktu LM lub kod EAN-13',
            },
            priceText: {
              type: Type.STRING,
              description: 'Cena z etykiety (np. 38,49 zł/kg)',
            },
          },
          required: ['name', 'scaleCode'],
        },
      },
    };

    let response;
    try {
      // Primary: gemini-3.1-flash-lite
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: safeMime,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: modelConfig,
      });
    } catch (err: any) {
      console.warn('Fallback do gemini-3.8-flash:', err?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: safeMime,
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: modelConfig,
      });
    }

    let jsonStr = (response.text || '[]').trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let items = [];
    try {
      items = JSON.parse(jsonStr);
    } catch {
      items = [];
    }

    return res.json({ success: true, items });
  } catch (error: any) {
    console.error('Błąd rozpoznawania etykiety ESL:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Błąd podczas analizy obrazu etykiety ESL',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
