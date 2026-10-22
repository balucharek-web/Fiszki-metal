import React from 'react';
import { X, Printer, Check, AlertTriangle } from 'lucide-react';

interface PrintInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToPrint: () => void;
}

export const PrintInstructionsModal: React.FC<PrintInstructionsModalProps> = ({
  isOpen,
  onClose,
  onProceedToPrint,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Jak wydrukować fiszki w idealnym wymiarze 19.5 × 4 cm
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-900 block font-semibold">
                Kluczowa zasada zachowania wymiarów:
              </strong>
              <span className="text-amber-800">
                W oknie dialogowym drukowania przeglądarki ustaw <strong>Skala: 100% (Rozmiar rzeczywisty)</strong>. 
                Nigdy nie wybieraj „Dopasuj do strony” (Fit to page), bo przeglądarka zmniejszy fiszkę o kilka milimetrów!
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                1
              </div>
              <div>
                <strong className="text-slate-900 block font-semibold">Format papieru: A4</strong>
                <span className="text-slate-500">
                  Upewnij się, że w drukarce wybrany jest format <strong>A4</strong> oraz orientacja <strong>Pionowa (Portrait)</strong>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                2
              </div>
              <div>
                <strong className="text-slate-900 block font-semibold">Skala: 100% / Domyślna</strong>
                <span className="text-slate-500">
                  Wybierz <em>„Więcej ustawień”</em> → <em>„Skala: 100%”</em> lub <em>„Rozmiar rzeczywisty”</em>.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                3
              </div>
              <div>
                <strong className="text-slate-900 block font-semibold">Marginesy: Brak (None)</strong>
                <span className="text-slate-500">
                  Ustaw marginesy na <em>„Brak”</em> (lub <em>„Minimalne”</em>), szablon ma już wbudowane dokładne marginesy 7.5 mm.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                4
              </div>
              <div>
                <strong className="text-slate-900 block font-semibold">Włącz „Grafika w tle”</strong>
                <span className="text-slate-500">
                  Zaznacz opcję <em>„Grafika w tle” (Background graphics)</em>, aby zielony pasek z numerem na wadze został wydrukowany w kolorze.
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
            <strong>Kontrola linijką:</strong> Na lewym marginesie arkusza A4 znajduje się mały pasek kontrolny <strong>50 mm (5 cm)</strong>. Po wydrukowaniu przyłóż do niego zwykłą linijkę — jeśli ma równo 5 cm, Twoje fiszki mają dokładnie 19.5 cm szerokości i 4.0 cm wysokości!
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            Zamknij
          </button>
          <button
            onClick={() => {
              onClose();
              onProceedToPrint();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" /> Otwórz okno drukowania
          </button>
        </div>
      </div>
    </div>
  );
};
