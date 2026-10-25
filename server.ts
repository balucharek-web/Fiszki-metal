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

// CORS middleware to support external origins (e.g. GitHub Pages or local preview)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

    const promptText = `Jesteś wyspecjalizowanym, ultra-precyzyjnym systemem OCR dla elektronicznych etykiet cenowych e-papier ESL (Leroy Merlin, Standers, Castorama, OBI) oraz fiszek papierowych z działu metalowego (wkręty, śruby, nakrętki, podkładki, kołki, kotwy).
TWOIM ZADANIEM JEST BEZBŁĘDNE ODCZYTANIE I STANDARYZACJA WSZYSTKICH 4 KLUCZOWYCH PÓL:

DOKŁADNY UKŁAD GRAFICZNY ETYKIETY ESL E-PAPIER (lewa kolumna od góry do dołu):
1. PIERWSZA LINIA (Kod wagi + Nazwa artykułu):
   - Rozpoczyna się od 2- lub 3-cyfrowego kodu wagi, po którym występuje spacja, kropka lub myślnik i nazwa towaru!
   - PRZYKŁAD: "155 WKRĘT UNIWERSALNY" -> scaleCode: "155", name: "Wkręt uniwersalny"
   - PRZYKŁAD: "247. WKRĘT DO DREWNA" -> scaleCode: "247", name: "Wkręt do drewna"
   - PRZYKŁAD: "980 - KOŁKI ROZPOROWE" -> scaleCode: "980", name: "Kołki rozporowe"
   - PRZYKŁAD: "42 ŚRUBA ZAMKOWA" -> scaleCode: "42", name: "Śruba zamkowa"
   - scaleCode: ZAWSZE musi zawierać wyłącznie cyfry (np. "155", "247", "42"). Nigdy nie dołączaj kropek, liter ani myślników.
   - name: ZAWSZE sama nazwa artykułu bez numeru wagi. Sformatuj poprawną polską pisownią wielką literą na początku (np. "Wkręt do drewna", "Podkładka poszerzana").

2. DRUGA LINIA (Wymiar / Rozmiar produktu):
   - Znajduje się bezpośrednio pod pierwszą linią (nazwą)!
   - Obsługuj wymiary ułamkowe/dziesiętne z przecinkiem lub kropką oraz gwinty metryczne i średnice:
     - "3,5X25 MM" lub "3.5x25" -> dimension: "3,5x25 mm"
     - "4,2X35 MM" lub "4.2X35" -> dimension: "4,2x35 mm"
     - "5X40 MM" -> dimension: "5x40 mm"
     - "6X90 MM" -> dimension: "6x90 mm"
     - "M6X50" -> dimension: "M6x50 mm"
     - "M8X80" -> dimension: "M8x80 mm"
     - "FI 8X60" lub "Ø8X60" -> dimension: "8x60 mm"
   - dimension: ZAWSZE z małym "x" i końcówką " mm" (np. "4,2x35 mm", "5x40 mm", "M6x50 mm").

3. TRZECIA LINIA (8-cyfrowy numer referencyjny LM):
   - Znajduje się bezpośrednio POD wymiarem i DOKŁADNIE NAD słowem "ZAPAS: X"!
   - PRZYKŁAD: Na etykiecie jest "82165193", a linijkę niżej "ZAPAS: 9" -> refNumber to "82165193"!
   - PRZYKŁAD: "44813216" nad "ZAPAS: 12" -> refNumber to "44813216".
   - Na etykietach papierowych znajduje się obok "Ref: 42660256".
   - JEŚLI 8-cyfrowy ref byłby nieczytelny, weź 13-cyfrowy kod EAN spod poziomego kodu na dole (np. "5901171215451").
   - refNumber: Czysty ciąg cyfr (8 lub 13 cyfr).

4. CZWARTA LINIA: "ZAPAS: X" (stan magazynowy - zignoruj liczbę zapasu, służy tylko jako znacznik położenia refNumber).

5. DOLNA LINIA: Poziomy kod kreskowy towaru z 13-cyfrowym kodem EAN.

6. PRAWA STRONA: Duża cena (np. "38,49 zł/Kg", "34,90 zł/kg", "0,25 zł/szt."). Zawsze preferuj cenę wagową za kilogram (zł/kg), jeśli jest obecna.

7. BEZWZGLĘDNY ZAKAZ:
   - ZIGNORUJ pionowy kod kreskowy na plastikowej ramce etykiety (zaczynający się od 147...)! To jest numer seryjny obudowy. NIGDY nie wpisuj go jako refNumber ani scaleCode.

Zwróć bezbłędne, precyzyjne dane dla każdej widocznej etykiety na pierwszym planie.`;

    const modelConfig = {
      systemInstruction:
        'Jesteś bezbłędnym skanerem etykiet ESL Leroy Merlin. Dla każdej etykiety musisz precyzyjnie zwrócić: scaleCode (2-3 cyfry z początku pierwszej linii, np. 155), name (nazwa bez kodu wagi, poprawny język polski), dimension (wymiar z drugiej linii standaryzowany do małego x i mm, np. 4,2x35 mm lub M6x50 mm), refNumber (8 cyfr znajdujących się bezpośrednio nad słowem ZAPAS, np. 82165193) oraz priceText (np. 38,49 zł/kg).',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Nazwa artykułu bez numeru wagi z początku (np. Wkręt uniwersalny)',
            },
            dimension: {
              type: Type.STRING,
              description: 'Wymiar produktu z mm (np. 5x40 mm)',
            },
            scaleCode: {
              type: Type.STRING,
              description: '2- lub 3-cyfrowy kod wagi wpisywany na wadze z początku 1. linii (np. 155)',
            },
            refNumber: {
              type: Type.STRING,
              description: '8-cyfrowy numer referencyjny LM nad ZAPAS (np. 82165193) lub 13-cyfrowy EAN',
            },
            priceText: {
              type: Type.STRING,
              description: 'Cena z etykiety (np. 38,49 zł/kg)',
            },
          },
          required: ['name', 'dimension', 'scaleCode', 'refNumber', 'priceText'],
        },
      },
    };

    let response;
    try {
      // Primary flagship multimodal vision: gemini-3.8-flash for maximum accuracy
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
    } catch (err: any) {
      console.warn('Fallback do gemini-3.1-flash-lite:', err?.message);
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
    }

    let jsonStr = (response.text || '[]').trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let rawItems: any[] = [];
    try {
      rawItems = JSON.parse(jsonStr);
      if (!Array.isArray(rawItems) && typeof rawItems === 'object' && rawItems !== null) {
        rawItems = [rawItems];
      }
    } catch {
      rawItems = [];
    }

    // Sanitize and normalize items
    const items = rawItems.map((it) => {
      let scale = it.scaleCode ? String(it.scaleCode).replace(/\D/g, '') : '';
      let rawName = (it.name || '').trim();
      const leadingMatch = rawName.match(/^([0-9]{2,3})[\s\.\:\-]+(.*)/);
      if (leadingMatch) {
        if (!scale) scale = leadingMatch[1];
        rawName = leadingMatch[2].trim();
      }

      let dim = (it.dimension || '').trim().replace('*', 'x').toLowerCase();
      if (dim && !dim.endsWith('mm') && !dim.startsWith('m')) {
        dim = `${dim} mm`;
      }

      let ref = it.refNumber ? String(it.refNumber).replace(/\D/g, '') : '';
      if (ref.startsWith('147') && ref.length >= 12) {
        ref = ''; // filter out ESL bezel serial
      }

      return {
        name: rawName,
        dimension: dim,
        scaleCode: scale,
        refNumber: ref,
        priceText: it.priceText || 'Cena',
      };
    });

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
