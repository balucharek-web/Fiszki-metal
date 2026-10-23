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

    const promptText = `Jesteś ekspertem w odczytywaniu:
1. Sklepowych etykiet cenowych ESL (Electronic Shelf Labels, e-papier, wyświetlacze LCD/E-ink) oraz tradycyjnych papierowych etykiet regałowych z działu metalowego (np. Standers, śruby, wkręty, nakrętki, podkładki, kołki).
2. Kodów kreskowych, etykiet magazynowych, paczkowych, biletów i potwierdzeń z kodami/PIN.

Przeanalizuj przesłane zdjęcie i wyodrębnij WSZYSTKIE pozycje widoczne na ujęciu (od 1 do kilku):

Dla każdej wykrytej etykiety lub kodu podaj:
- "name": Nazwa artykułu lub opis etykiety/kodu (np. "Wkręt do drewna stożkowy", "Kod odbioru", "Etykieta towarowa"). Jeśli brak nazwy, wpisz typ etykiety.
- "dimension": Wymiar lub rozmiar produktu (np. "4x40 mm", "M6x50", "8x80", "5x60 mm") lub pusty ciąg "" jeśli brak.
- "scaleCode": Kod wagi do wpisania na wadze sklepowej (zwykle wyróżniona liczba 2- lub 3-cyfrowa np. "247", "185", "42") LUB kod PIN (np. "4757").
- "refNumber": Numer referencyjny LM / kod kreskowy / numer kodu (np. "42660256", "7000055492487490").
- "priceText": Cena za sztukę lub kilogram (np. "29,90 zł/kg", "0,45 zł/szt") lub domyślnie "Cena".

Zwróć poprawną tablicę JSON.`;

    const modelConfig = {
      systemInstruction:
        'Zwracaj wyłącznie poprawny obiekt JSON zawierający tablicę etykiet. Jeśli to kod kreskowy lub bilet, wypełnij pola refNumber oraz scaleCode.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Nazwa artykułu lub opis kodu',
            },
            dimension: {
              type: Type.STRING,
              description: 'Wymiar produktu (np. 4x40 mm) lub puste',
            },
            scaleCode: {
              type: Type.STRING,
              description: 'Kod wagi (np. 247) lub kod PIN',
            },
            refNumber: {
              type: Type.STRING,
              description: 'Numer referencyjny LM lub kod kreskowy',
            },
            priceText: {
              type: Type.STRING,
              description: 'Cena lub etykieta ceny',
            },
          },
          required: ['name'],
        },
      },
    };

    let response;
    try {
      // Primary: gemini-3.1-flash-lite (fast, high throughput, low latency)
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
      console.warn('Fallback to gemini-3.5-flash-lite due to error:', err?.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
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
