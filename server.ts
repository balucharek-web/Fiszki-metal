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

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `Jesteś ekspertem w odczytywaniu sklepowych etykiet cenowych ESL (Electronic Shelf Labels, e-papier, wyświetlacze LCD/E-ink) oraz tradycyjnych papierowych etykiet regałowych z działu metalowego (np. Standers, śruby, wkręty, nakrętki, podkładki, kołki).

Przeanalizuj przesłane zdjęcie i odczytaj WSZYSTKIE etykiety cenowe widoczne na ujęciu (od 1 do kilku etykiet na listwie regałowej).

Dla każdej wykrytej etykiety wyodrębnij:
- "name": Pełna nazwa artykułu bez wymiaru (np. "Wkręt do drewna stożkowy", "Śruba zamkowa ocynkowana", "Podkładka poszerzana").
- "dimension": Dokładny wymiar lub rozmiar (np. "4x40 mm", "M6x50", "8x80", "5x60 mm", "3.5x25", "10x120").
- "scaleCode": Kod wagi do wpisania na wadze sklepowej (często wyróżniona liczba 2- lub 3-cyfrowa, np. "247", "185", "42", "241"). Podaj wyłącznie same cyfry.
- "refNumber": Numer referencyjny / kod kreskowy / kod LM / barcode (zwykle 8 cyfr np. "42660256", "82451902").
- "priceText": Cena za sztukę lub kilogram (np. "29,90 zł/kg", "0,45 zł/szt") lub domyślnie "Cena".

Zwróć uporządkowaną listę (od lewej do prawej jeśli jest kilka etykiet).`,
          },
        ],
      },
      config: {
        systemInstruction:
          'Zwracaj wyłącznie poprawny obiekt JSON zawierający tablicę etykiet sklepowych ESL.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Nazwa artykułu bez wymiaru',
              },
              dimension: {
                type: Type.STRING,
                description: 'Wymiar produktu',
              },
              scaleCode: {
                type: Type.STRING,
                description: 'Numer kodu wagi',
              },
              refNumber: {
                type: Type.STRING,
                description: 'Numer referencyjny / kod produktu / kod kreskowy',
              },
              priceText: {
                type: Type.STRING,
                description: 'Cena lub etykieta ceny',
              },
            },
            required: ['name', 'dimension', 'scaleCode'],
          },
        },
      },
    });

    const jsonStr = response.text || '[]';
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
