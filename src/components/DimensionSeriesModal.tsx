import React, { useState } from 'react';
import { FiszkaItem } from '../types/label';
import {
  Sparkles,
  X,
  Check,
  Layers,
  Wand2,
  Sliders,
  ChevronRight,
  Info,
} from 'lucide-react';

interface DimensionSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (items: FiszkaItem[], target: 'activePage' | 'newPage' | 'replaceAll') => void;
  activePageIndex: number;
  totalPages: number;
}

interface Preset {
  title: string;
  name: string;
  dimensions: string[];
  startCode: number;
  startRef: string;
}

const PRESETS: Preset[] = [
  {
    title: 'Wkręty do drewna PZ (pełna gama)',
    name: 'Wkręt do drewna',
    dimensions: [
      '3.5x25 mm',
      '3.5x30 mm',
      '4x40 mm',
      '4.5x50 mm',
      '5x60 mm',
      '5x70 mm',
      '6x80 mm',
    ],
    startCode: 241,
    startRef: '42660250',
  },
  {
    title: 'Wkręty hartowane 4 mm (30 - 70 mm)',
    name: 'Wkręt do drewna hartowany',
    dimensions: [
      '4x30 mm',
      '4x35 mm',
      '4x40 mm',
      '4x45 mm',
      '4x50 mm',
      '4x60 mm',
      '4x70 mm',
    ],
    startCode: 250,
    startRef: '42660260',
  },
  {
    title: 'Wkręty do płyt G-K (stal fosfatowana)',
    name: 'Wkręt do płyt g-k',
    dimensions: [
      '3.5x25 mm',
      '3.5x35 mm',
      '3.5x45 mm',
      '3.5x55 mm',
      '4.2x70 mm',
      '4.2x80 mm',
      '4.8x100 mm',
    ],
    startCode: 270,
    startRef: '42660270',
  },
  {
    title: 'Śruby zamkowe M6 ocynk',
    name: 'Śruba zamkowa M6',
    dimensions: [
      'M6x30 mm',
      'M6x40 mm',
      'M6x50 mm',
      'M6x60 mm',
      'M6x70 mm',
      'M6x80 mm',
      'M6x100 mm',
    ],
    startCode: 310,
    startRef: '42660310',
  },
  {
    title: 'Gwoździe budowlane ocynkowane',
    name: 'Gwóźdź budowlany',
    dimensions: [
      '2.5x50 mm',
      '2.8x60 mm',
      '3.0x70 mm',
      '3.5x80 mm',
      '4.0x100 mm',
      '4.5x125 mm',
      '5.0x150 mm',
    ],
    startCode: 330,
    startRef: '42660330',
  },
];

export const DimensionSeriesModal: React.FC<DimensionSeriesModalProps> = ({
  isOpen,
  onClose,
  onApply,
  activePageIndex,
  totalPages,
}) => {
  const [productName, setProductName] = useState('Wkręt do drewna');
  const [diameterPrefix, setDiameterPrefix] = useState('5x');
  const [lengthStart, setLengthStart] = useState<number>(30);
  const [lengthStep, setLengthStep] = useState<number>(10);
  const [unitSuffix, setUnitSuffix] = useState('mm');
  const [startCode, setStartCode] = useState<number>(241);
  const [startRef, setStartRef] = useState<number>(42660250);
  const [targetDestination, setTargetDestination] = useState<
    'activePage' | 'newPage' | 'replaceAll'
  >('activePage');

  if (!isOpen) return null;

  // Build the 7 dimensions based on settings
  const generatedItems: FiszkaItem[] = Array.from({ length: 7 }, (_, i) => {
    const lengthVal = lengthStart + i * lengthStep;
    const dim = `${diameterPrefix}${lengthVal} ${unitSuffix}`.trim();
    const code = String(startCode + i);
    const ref = String(startRef + i);

    return {
      id: `gen_series_${Date.now()}_${i + 1}`,
      name: productName,
      dimension: dim,
      scaleCode: code,
      refNumber: ref,
      priceText: 'Cena',
    };
  });

  const handleApplyPreset = (p: Preset) => {
    setProductName(p.name);
    setStartCode(p.startCode);
    setStartRef(parseInt(p.startRef) || 42660250);
  };

  const handleFinish = () => {
    onApply(generatedItems, targetDestination);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Generator serii wymiarów (7 fiszek)
              </h2>
              <p className="text-xs text-slate-500">
                Szybkie wygenerowanie całego arkusza dla rodziny produktów z rosnącymi długościami i kodami wagi.
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
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
          {/* Quick Presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Popularne szablony regałowe:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 text-left rounded-xl border border-slate-200 bg-slate-50 hover:bg-purple-50 hover:border-purple-300 transition-all text-xs flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate">
                    <div className="font-bold text-slate-800 group-hover:text-purple-900">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {p.dimensions.slice(0, 3).join(', ')} ...
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {/* Form Parameters */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-600" />
              Parametry serii:
            </span>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nazwa towaru:
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="np. Wkręt do drewna"
                className="w-full text-xs font-bold p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-200"
              />
            </div>

            {/* Dimensions Math Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Średnica / Prefiks:
                </label>
                <input
                  type="text"
                  value={diameterPrefix}
                  onChange={(e) => setDiameterPrefix(e.target.value)}
                  placeholder="np. 4x lub M8x"
                  className="w-full text-xs font-mono font-bold p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Długość pocz.:
                </label>
                <input
                  type="number"
                  value={lengthStart}
                  onChange={(e) => setLengthStart(parseInt(e.target.value) || 0)}
                  className="w-full text-xs font-mono font-bold p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Krok (skok długości):
                </label>
                <input
                  type="number"
                  value={lengthStep}
                  onChange={(e) => setLengthStep(parseInt(e.target.value) || 5)}
                  className="w-full text-xs font-mono font-bold p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Jednostka:
                </label>
                <input
                  type="text"
                  value={unitSuffix}
                  onChange={(e) => setUnitSuffix(e.target.value)}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            {/* Codes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Początkowy kod wagi (inkrementuje +1):
                </label>
                <input
                  type="number"
                  value={startCode}
                  onChange={(e) => setStartCode(parseInt(e.target.value) || 240)}
                  className="w-full text-xs font-mono font-bold text-emerald-800 p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Początkowy nr ref (inkrementuje +1):
                </label>
                <input
                  type="number"
                  value={startRef}
                  onChange={(e) => setStartRef(parseInt(e.target.value) || 42660250)}
                  className="w-full text-xs font-mono p-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Generated Preview */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">
              Podgląd 7 wygenerowanych fiszek:
            </span>
            <div className="grid grid-cols-1 divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
              {generatedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 text-center text-slate-400 font-mono text-[10px]">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800">{item.name}</span>
                    <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.dimension}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Waga: {item.scaleCode}
                    </span>
                    <span className="text-[10px] text-slate-500">Ref: {item.refNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Destination options */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700">Gdzie wstawić serię?</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="dest"
                  checked={targetDestination === 'activePage'}
                  onChange={() => setTargetDestination('activePage')}
                  className="accent-purple-600"
                />
                <span>Wstaw na stronę {activePageIndex + 1}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="dest"
                  checked={targetDestination === 'newPage'}
                  onChange={() => setTargetDestination('newPage')}
                  className="accent-purple-600"
                />
                <span>Stwórz nową stronę A4</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                <input
                  type="radio"
                  name="dest"
                  checked={targetDestination === 'replaceAll'}
                  onChange={() => setTargetDestination('replaceAll')}
                  className="accent-purple-600"
                />
                <span>Zastąp wszystkie</span>
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
            onClick={handleFinish}
            className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-98 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            <span>Wygeneruj 7 fiszek na arkuszu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
