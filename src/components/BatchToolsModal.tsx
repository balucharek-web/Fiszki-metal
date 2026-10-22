import React, { useState } from 'react';
import { FiszkaItem } from '../types/label';
import { X, Sparkles, FileSpreadsheet, Plus, Check } from 'lucide-react';

interface BatchToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyItems: (items: FiszkaItem[], replace: boolean) => void;
  currentCount: number;
}

const PRESET_COLLECTIONS = [
  {
    name: 'Wkręty do drewna (pełny zestaw)',
    items: [
      { name: 'Wkręt do drewna', dimension: '3.5x35 mm', scaleCode: '241', refNumber: '42660250', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '4.0x40 mm', scaleCode: '242', refNumber: '42660251', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '4.5x50 mm', scaleCode: '243', refNumber: '42660252', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '5.0x60 mm', scaleCode: '244', refNumber: '42660253', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '5.0x70 mm', scaleCode: '245', refNumber: '42660254', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '6.0x80 mm', scaleCode: '247', refNumber: '42660256', priceText: 'Cena' },
      { name: 'Wkręt do drewna', dimension: '6.0x100 mm', scaleCode: '248', refNumber: '42660257', priceText: 'Cena' },
    ],
  },
  {
    name: 'Wkręty do płyt g-k (karton-gips)',
    items: [
      { name: 'Wkręt do płyt g-k (drewno)', dimension: '3.5x25 mm', scaleCode: '310', refNumber: '41880112', priceText: 'Cena' },
      { name: 'Wkręt do płyt g-k (drewno)', dimension: '3.5x35 mm', scaleCode: '311', refNumber: '41880113', priceText: 'Cena' },
      { name: 'Wkręt do płyt g-k (drewno)', dimension: '3.5x45 mm', scaleCode: '312', refNumber: '41880114', priceText: 'Cena' },
      { name: 'Wkręt do płyt g-k (metal)', dimension: '3.5x25 mm', scaleCode: '315', refNumber: '41880120', priceText: 'Cena' },
      { name: 'Wkręt do płyt g-k (metal)', dimension: '3.5x35 mm', scaleCode: '316', refNumber: '41880121', priceText: 'Cena' },
      { name: 'Wkręt do płyt g-k (metal)', dimension: '3.5x55 mm', scaleCode: '317', refNumber: '41880122', priceText: 'Cena' },
    ],
  },
  {
    name: 'Śruby metryczne ocynkowane M6/M8',
    items: [
      { name: 'Śruba z łbem sześciokątnym', dimension: 'M6x30 mm', scaleCode: '105', refNumber: '39002105', priceText: 'Cena' },
      { name: 'Śruba z łbem sześciokątnym', dimension: 'M6x50 mm', scaleCode: '106', refNumber: '39002106', priceText: 'Cena' },
      { name: 'Śruba z łbem sześciokątnym', dimension: 'M8x40 mm', scaleCode: '112', refNumber: '39002112', priceText: 'Cena' },
      { name: 'Śruba z łbem sześciokątnym', dimension: 'M8x60 mm', scaleCode: '113', refNumber: '39002113', priceText: 'Cena' },
      { name: 'Śruba zamkowa grzybkowa', dimension: 'M8x80 mm', scaleCode: '120', refNumber: '39002120', priceText: 'Cena' },
      { name: 'Nakrętka sześciokątna', dimension: 'M8 DIN 934', scaleCode: '140', refNumber: '39002140', priceText: 'Cena' },
    ],
  },
];

export const BatchToolsModal: React.FC<BatchToolsModalProps> = ({
  isOpen,
  onClose,
  onApplyItems,
}) => {
  const [activeTab, setActiveTab] = useState<'series' | 'csv' | 'presets'>('series');

  // Generator serii
  const [seriesName, setSeriesName] = useState('Wkręt do drewna');
  const [seriesDimensions, setSeriesDimensions] = useState('3.5x30, 4x40, 4.5x50, 5x60, 6x80, 6x100');
  const [seriesStartCode, setSeriesStartCode] = useState(240);
  const [seriesCodeStep, setSeriesCodeStep] = useState(1);
  const [seriesStartRef, setSeriesStartRef] = useState(42660250);

  // CSV / Excel import
  const [csvText, setCsvText] = useState(
    `Wkręt do drewna\t3.5x30 mm\t241\t42660251\nWkręt do drewna\t4.0x40 mm\t242\t42660252\nWkręt do drewna\t4.5x50 mm\t243\t42660253\nWkręt do drewna\t5.0x60 mm\t244\t42660254\nWkręt do drewna\t6.0x80 mm\t247\t42660256\nWkręt do drewna\t6.0x100 mm\t248\t42660257`
  );

  const [replaceExisting, setReplaceExisting] = useState(true);

  if (!isOpen) return null;

  const handleGenerateSeries = () => {
    const rawDims = seriesDimensions
      .split(/[,;\n]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    if (rawDims.length === 0) return;

    const newItems: FiszkaItem[] = rawDims.map((dim, i) => {
      const formattedDim = dim.endsWith('mm') ? dim : `${dim} mm`;
      return {
        id: `fiszka_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        name: seriesName,
        dimension: formattedDim,
        scaleCode: String(seriesStartCode + i * seriesCodeStep),
        refNumber: String(seriesStartRef + i),
        priceText: 'Cena',
      };
    });

    onApplyItems(newItems, replaceExisting);
    onClose();
  };

  const handleImportCsv = () => {
    const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const newItems: FiszkaItem[] = [];

    lines.forEach((line, i) => {
      // Rozdziel tabulatorem, średnikiem lub przecinkiem
      const parts = line.split(/[\t;]/).map((p) => p.trim());
      if (parts.length >= 2) {
        newItems.push({
          id: `fiszka_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          name: parts[0] || 'Wkręt do drewna',
          dimension: parts[1] || '6x80 mm',
          scaleCode: parts[2] || '247',
          refNumber: parts[3] || '42660256',
          priceText: parts[4] || 'Cena',
        });
      }
    });

    if (newItems.length > 0) {
      onApplyItems(newItems, replaceExisting);
      onClose();
    }
  };

  const handleLoadPreset = (presetItems: Omit<FiszkaItem, 'id'>[]) => {
    const newItems: FiszkaItem[] = presetItems.map((p, i) => ({
      ...p,
      id: `fiszka_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
    }));
    onApplyItems(newItems, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Narzędzia hurtowe i serie wymiarów
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('series')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'series'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Generator serii wymiarów
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'csv'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Wklej z Excela / CSV
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'presets'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Gotowe zestawy
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm text-slate-700">
          {activeTab === 'series' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Szybko stwórz serię fiszek dla jednego typu produktu o różnych rozmiarach i kolejnych numerach na wadze.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Wspólna nazwa towaru:
                </label>
                <input
                  type="text"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lista wymiarów (oddzielone przecinkami lub nową linią):
                </label>
                <textarea
                  rows={3}
                  value={seriesDimensions}
                  onChange={(e) => setSeriesDimensions(e.target.value)}
                  placeholder="3.5x30, 4x40, 4.5x50, 5x60, 6x80"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Początkowy kod wagi:
                  </label>
                  <input
                    type="number"
                    value={seriesStartCode}
                    onChange={(e) => setSeriesStartCode(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Krok numeracji (+):
                  </label>
                  <input
                    type="number"
                    value={seriesCodeStep}
                    onChange={(e) => setSeriesCodeStep(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Początkowy Ref:
                  </label>
                  <input
                    type="number"
                    value={seriesStartRef}
                    onChange={(e) => setSeriesStartRef(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Skopiuj kolumny z arkusza kalkulacyjnego Excel lub wpisz w formacie rozdzielanym tabulatorami lub średnikiem:
                  <br />
                  <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">
                    Nazwa [TAB] Wymiar [TAB] Numer wagi [TAB] Ref
                  </code>
                </p>
              </div>

              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Wybierz gotowy zestaw popularnych artykułów złącznych i wkrętów:
              </p>
              <div className="space-y-2">
                {PRESET_COLLECTIONS.map((preset, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{preset.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {preset.items.length} pozycji · np.{' '}
                        {preset.items.map((it) => it.dimension).slice(0, 3).join(', ')}...
                      </div>
                    </div>
                    <button
                      onClick={() => handleLoadPreset(preset.items)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Wstaw zestaw
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Replace vs Append switch */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
              />
              <span className="font-medium text-slate-700">
                Zastąp obecne fiszki (odznacz, aby dopisać na końcu listy)
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
          >
            Anuluj
          </button>
          {activeTab === 'series' && (
            <button
              onClick={handleGenerateSeries}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" /> Wygeneruj fiszki
            </button>
          )}
          {activeTab === 'csv' && (
            <button
              onClick={handleImportCsv}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" /> Zaimportuj dane
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
