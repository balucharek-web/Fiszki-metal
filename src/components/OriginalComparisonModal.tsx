import React from 'react';
import { X, CheckCircle, ArrowRight } from 'lucide-react';

interface OriginalComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OriginalComparisonModal: React.FC<OriginalComparisonModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Porównanie z Twoim zdjęciem fiszki
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Wymiary fizyczne: 19.5 cm szerokości × 4.0 cm wysokości
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Original Photo */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                1. Oryginalne zdjęcie z pytania (referencja):
              </span>
              <span className="text-xs text-slate-400 font-mono">19.5 × 4 cm</span>
            </div>
            <div className="p-2 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              <img
                src="/public/assets/aistudio/fiszka_meblowa_5010b6c7.png"
                alt="Oryginalna fiszka Standers"
                className="w-full object-contain rounded"
              />
            </div>
          </div>

          {/* Feature mapping */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              2. Co zostało odtworzone i jest w 100% edytowalne:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Nazwa towaru:</strong>
                  <span className="text-slate-600">
                    Oryginalnie: <em>„Wkręt do drewna”</em>. W szablonie możesz wpisać dowolny tekst
                    dla każdej fiszki z osobna lub skopiować do wszystkich.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Wymiar / Rozmiar:</strong>
                  <span className="text-slate-600">
                    Oryginalnie: <em>„6x80 mm”</em>. Wytłuszczony krój o identycznych proporcjach,
                    w pełni modyfikowalny (np. 4x40, 5x60, 6x100).
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Numer na wadze:</strong>
                  <span className="text-slate-600">
                    Oryginalnie: <em>„247”</em> na charakterystycznym jasnozielonym tle
                    z napisem <em>„Wpisz na wadze:”</em>. Cyfry o wysokim kontraście i czytelności.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">Układ na arkuszu A4:</strong>
                  <span className="text-slate-600">
                    Na arkuszu A4 (210×297 mm) mieści się dokładnie 6 fiszek (z wygodnymi odstępami
                    i liniami cięcia) lub 7 fiszek (maksymalne upakowanie).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick guide */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Wskazówka:</span>
            </div>
            <p>
              Możesz klikać i edytować teksty <strong>bezpośrednio na podglądzie fiszki</strong> lub
              wygodnie w panelu po lewej stronie. Każda zmiana jest natychmiast widoczna w czasie
              rzeczywistym na arkuszu gotowym do druku.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            Zamknij i przejdź do edycji <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
