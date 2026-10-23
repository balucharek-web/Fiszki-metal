import React, { useState } from 'react';
import { FiszkaItem } from '../types/label';
import {
  FileSpreadsheet,
  X,
  Check,
  AlertCircle,
  Copy,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: FiszkaItem[], mode: 'replace' | 'append') => void;
  existingCount: number;
}

interface ParsedRow {
  name: string;
  dimension: string;
  scaleCode: string;
  refNumber: string;
  priceText: string;
  isValid: boolean;
}

const SAMPLE_DATA = `Wkręt do drewna\t3.5x25 mm\t241\t42660250\tCena
Wkręt do drewna\t3.5x30 mm\t242\t42660251\tCena
Wkręt do drewna\t4.0x35 mm\t243\t42660252\tCena
Wkręt do drewna\t4.0x40 mm\t244\t42660253\tCena
Wkręt do drewna\t4.5x50 mm\t245\t42660254\tCena
Wkręt do drewna\t5.0x60 mm\t246\t42660255\tCena
Wkręt do drewna\t6.0x80 mm\t247\t42660256\tCena`;

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingCount,
}) => {
  const [rawText, setRawText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  if (!isOpen) return null;

  // Intelligent parser for Excel / TSV / CSV / semicolon separated data
  const parseRows = (text: string): ParsedRow[] => {
    if (!text.trim()) return [];

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    return lines.map((line) => {
      // Detect delimiter: tab (\t), semicolon (;), comma (,), pipe (|)
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else if (line.includes('|')) {
        parts = line.split('|');
      } else if (line.includes(',')) {
        // Simple comma split
        parts = line.split(',');
      } else {
        // Space-separated with quotes or simple 2-4 tokens
        parts = line.split(/\s{2,}/); // 2 or more spaces
        if (parts.length < 2) {
          parts = [line];
        }
      }

      const cleanParts = parts.map((p) => p.trim().replace(/^["']|["']$/g, ''));

      // Map columns: [Nazwa, Wymiar, Kod wagi, Ref, Cena]
      // Intelligent guessing:
      // If part looks like a pure 1-4 digit number, it could be scale code
      // If part looks like an 8-digit number, it's refNumber
      let name = cleanParts[0] || 'Wkręt do drewna';
      let dimension = cleanParts[1] || '';
      let scaleCode = cleanParts[2] || '';
      let refNumber = cleanParts[3] || '';
      let priceText = cleanParts[4] || 'Cena';

      // Fallback heuristics if columns are ordered differently
      if (cleanParts.length === 2) {
        // e.g. "6x80 mm" and "247"
        if (/^\d{1,4}$/.test(cleanParts[1])) {
          dimension = cleanParts[0];
          scaleCode = cleanParts[1];
          name = 'Wkręt do drewna';
        }
      }

      return {
        name,
        dimension,
        scaleCode,
        refNumber,
        priceText,
        isValid: Boolean(dimension || scaleCode || name),
      };
    });
  };

  const parsedRows = parseRows(rawText);
  const totalItemsToGenerate =
    importMode === 'replace'
      ? parsedRows.length
      : existingCount + parsedRows.length;
  const resultingPages = Math.max(1, Math.ceil(totalItemsToGenerate / 7));

  const handleApply = () => {
    if (parsedRows.length === 0) return;

    // Pad to multiple of 7 if replace mode, so full A4 sheets are maintained
    const newFiszki: FiszkaItem[] = parsedRows.map((r, i) => ({
      id: `imported_${Date.now()}_${i + 1}`,
      name: r.name || 'Wkręt do drewna',
      dimension: r.dimension || '',
      scaleCode: r.scaleCode || '',
      refNumber: r.refNumber || '',
      priceText: r.priceText || 'Cena',
    }));

    // If replacing and less than 7, pad to 7 items
    if (importMode === 'replace' && newFiszki.length < 7) {
      const needed = 7 - newFiszki.length;
      for (let i = 0; i < needed; i++) {
        newFiszki.push({
          id: `padded_${Date.now()}_${i}`,
          name: newFiszki[0]?.name || 'Wkręt do drewna',
          dimension: '',
          scaleCode: '',
          refNumber: '',
          priceText: 'Cena',
        });
      }
    }

    onImport(newFiszki, importMode);
    onClose();
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_DATA);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Wklej ze schowka / Excela (Masowe wypełnianie)
              </h2>
              <p className="text-xs text-slate-500">
                Wklej dane skopiowane z arkusza kalkulacyjnego lub tabeli. Automatycznie utworzy potrzebne strony A4.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
          {/* Instructions and Quick actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Format kolumn w Excelu:</strong> Nazwa towaru | Wymiar | Kod wagi | Nr ref | Cena (rozdzielane tabulatorem).
              </span>
            </div>
            <button
              onClick={handleLoadSample}
              className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-lg text-xs shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Wstaw przykładowe dane (7 szt.)</span>
            </button>
          </div>

          {/* Paste Input Area */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <label htmlFor="excel-paste-area">Wklej tutaj (Ctrl + V):</label>
              {rawText && (
                <button
                  onClick={() => setRawText('')}
                  className="text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Wyczyść pole
                </button>
              )}
            </div>
            <textarea
              id="excel-paste-area"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Skopiuj wiersze z Excela i naciśnij tutaj Ctrl+V...\nPrzykład:\nWkręt do drewna\t6x80 mm\t247\t42660256\tCena\nWkręt do drewna\t5x70 mm\t246\t42660255\tCena`}
              rows={6}
              className="w-full font-mono text-xs p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 focus:outline-none transition-all"
            />
          </div>

          {/* Live Preview Table */}
          {parsedRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  Podgląd rozpoznanych pozycji: ({parsedRows.length})
                </span>
                <span className="text-emerald-700 font-semibold">
                  Wymaga {resultingPages} {resultingPages === 1 ? 'strony' : 'stron'} A4 (po 7 fiszek)
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Nazwa towaru</th>
                      <th className="py-2 px-3 font-bold text-slate-800">Wymiar</th>
                      <th className="py-2 px-3 text-emerald-800">Kod wagi</th>
                      <th className="py-2 px-3">Nr ref</th>
                      <th className="py-2 px-3">Cena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-3 font-medium text-slate-800 truncate max-w-[180px]">
                          {r.name || '—'}
                        </td>
                        <td className="py-1.5 px-3 font-black text-slate-900 font-mono">
                          {r.dimension || '—'}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-bold text-emerald-700">
                          {r.scaleCode || '—'}
                        </td>
                        <td className="py-1.5 px-3 font-mono text-slate-600">
                          {r.refNumber || '—'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-500">
                          {r.priceText || 'Cena'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Mode Radio */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="font-bold text-slate-700">Tryb importu:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-emerald-600"
                />
                <span>Zastąp wszystkie bieżące fiszki</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="accent-emerald-600"
                />
                <span>Dopisz na końcu (kolejne strony)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          <button
            onClick={handleApply}
            disabled={parsedRows.length === 0}
            className={`px-5 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer ${
              parsedRows.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              Wstaw fiszki na arkusz ({parsedRows.length} {parsedRows.length === 1 ? 'szt.' : 'sztuk'})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
