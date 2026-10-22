/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { FiszkaItem, SheetSettings } from './types/label';
import { A4PrintSheet } from './components/A4PrintSheet';
import {
  Printer,
  Copy,
  Hash,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileDown,
} from 'lucide-react';
import { generateFillablePdf, downloadBlob } from './utils/pdfGenerator';

const INITIAL_LABELS_6: FiszkaItem[] = [
  {
    id: 'fiszka_1',
    name: 'Wkręt do drewna',
    dimension: '6x80 mm',
    scaleCode: '247',
    refNumber: '42660256',
    priceText: 'Cena',
  },
  {
    id: 'fiszka_2',
    name: 'Wkręt do drewna',
    dimension: '5x70 mm',
    scaleCode: '246',
    refNumber: '42660255',
    priceText: 'Cena',
  },
  {
    id: 'fiszka_3',
    name: 'Wkręt do drewna',
    dimension: '5x60 mm',
    scaleCode: '245',
    refNumber: '42660254',
    priceText: 'Cena',
  },
  {
    id: 'fiszka_4',
    name: 'Wkręt do drewna',
    dimension: '4.5x50 mm',
    scaleCode: '244',
    refNumber: '42660253',
    priceText: 'Cena',
  },
  {
    id: 'fiszka_5',
    name: 'Wkręt do drewna',
    dimension: '4x40 mm',
    scaleCode: '243',
    refNumber: '42660252',
    priceText: 'Cena',
  },
  {
    id: 'fiszka_6',
    name: 'Wkręt do drewna',
    dimension: '3.5x30 mm',
    scaleCode: '242',
    refNumber: '42660251',
    priceText: 'Cena',
  },
];

const INITIAL_LABELS_7: FiszkaItem[] = [
  ...INITIAL_LABELS_6,
  {
    id: 'fiszka_7',
    name: 'Wkręt do drewna',
    dimension: '3.5x25 mm',
    scaleCode: '241',
    refNumber: '42660250',
    priceText: 'Cena',
  },
];

export default function App() {
  const [itemsCount, setItemsCount] = useState<6 | 7>(6);

  const [items, setItems] = useState<FiszkaItem[]>(() => {
    const saved = localStorage.getItem('standers_labels_simple_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_LABELS_6;
  });

  const [settings, setSettings] = useState<SheetSettings>({
    itemsPerPage: 6,
    showCuttingGuides: true,
    cuttingGuideStyle: 'dashed',
    showScissorsIcon: true,
    showRightSection: true,
    brandName: 'STANDERS',
    useStandersLogo: true,
    scaleLabelText: 'Wpisz na wadze:',
    badgeColor: '#d7f5c5',
    includeCalibrationRuler: true,
    verticalSpacingMm: 4,
  });

  const [zoomScale, setZoomScale] = useState(0.85);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('standers_labels_simple_v2', JSON.stringify(items));
  }, [items]);

  // Handle switching between 6 and 7 labels
  const handleSetLayout = (count: 6 | 7) => {
    setItemsCount(count);
    setSettings((prev) => ({
      ...prev,
      itemsPerPage: count,
      verticalSpacingMm: count === 6 ? 4 : 0,
    }));

    if (count === 7 && items.length < 7) {
      const extraItem: FiszkaItem = {
        id: `fiszka_7_${Date.now()}`,
        name: items[0]?.name || 'Wkręt do drewna',
        dimension: '3.5x25 mm',
        scaleCode: '241',
        refNumber: '42660250',
        priceText: 'Cena',
      };
      setItems([...items, extraItem]);
    } else if (count === 6 && items.length > 6) {
      setItems(items.slice(0, 6));
    }
  };

  const handleUpdateItem = (id: string, updated: Partial<FiszkaItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updated } : it))
    );
  };

  // Quick action: Copy name of first label to all
  const handleCopyFirstNameToAll = () => {
    const firstName = items[0]?.name || 'Wkręt do drewna';
    setItems((prev) => prev.map((it) => ({ ...it, name: firstName })));
  };

  // Quick action: Renumber scale codes sequentially (+1)
  const handleRenumberCodes = () => {
    const startCode = parseInt(items[0]?.scaleCode) || 240;
    setItems((prev) =>
      prev.map((it, idx) => ({ ...it, scaleCode: String(startCode + idx) }))
    );
  };

  // Reset to initial clean template
  const handleReset = () => {
    if (window.confirm('Czy chcesz zresetować fiszki do wzorca początkowego?')) {
      const defaults = itemsCount === 6 ? INITIAL_LABELS_6 : INITIAL_LABELS_7;
      setItems(defaults);
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdfBytes = await generateFillablePdf(items, itemsCount);
      downloadBlob(pdfBytes, `szablon_fiszek_${itemsCount}_a4.pdf`);
    } catch (err) {
      console.error('PDF generation error, downloading fallback:', err);
      const link = document.createElement('a');
      link.href = `./szablon_fiszek_${itemsCount}_a4.pdf`;
      link.download = `szablon_fiszek_${itemsCount}_a4.pdf`;
      link.click();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const displayedItems = items.slice(0, itemsCount);

  return (
    <div className="min-h-screen bg-slate-200/90 flex flex-col items-center select-text font-sans">
      {/* Sleek Floating Control Bar (Hidden during printing) */}
      <div className="no-print sticky top-3 z-30 my-2 px-4 py-2.5 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-300 flex flex-wrap items-center justify-between gap-4 max-w-4xl w-[94%]">
        {/* Left: Dimension info & Layout switch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span>Fiszka:</span>
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-emerald-800 border border-slate-200">
              19.5 × 4 cm
            </span>
          </div>

          <div className="h-4 w-[1px] bg-slate-300 mx-1"></div>

          {/* 6 vs 7 switch */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => handleSetLayout(6)}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                itemsCount === 6
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              6 na stronę A4
            </button>
            <button
              onClick={() => handleSetLayout(7)}
              className={`px-3 py-1 font-semibold rounded-md transition-colors cursor-pointer ${
                itemsCount === 7
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 na stronę A4
            </button>
          </div>
        </div>

        {/* Center: Quick helpers */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={handleCopyFirstNameToAll}
            className="px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Kopiuje nazwę z pierwszej fiszki do wszystkich pozostałych"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Kopiuj nazwę do wszystkich</span>
            <span className="sm:hidden">Kopiuj nazwę</span>
          </button>

          <button
            onClick={handleRenumberCodes}
            className="px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Automatycznie numeruje kody wagi po kolei (+1 od pierwszej)"
          >
            <Hash className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Numeruj wagę (+1)</span>
            <span className="sm:hidden">Waga +1</span>
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Przywróć wzorzec domyślny"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Zoom & Print CTA */}
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setZoomScale((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Oddal"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] px-1 text-slate-600">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale((z) => Math.min(1.2, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Przybliż"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="px-1 text-[10px] font-mono font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
              title="Rozmiar rzeczywisty 1:1"
            >
              100%
            </button>
            <button
              onClick={() => setZoomScale(0.85)}
              className="p-1 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
              title="Dopasuj"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>

          {/* Download Fillable PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Pobierz plik PDF z aktywnymi polami do wypełniania w Adobe Reader lub przeglądarce"
          >
            <FileDown className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">
              {isGeneratingPdf ? 'Generowanie...' : 'Pobierz edytowalny PDF'}
            </span>
            <span className="sm:hidden">PDF</span>
          </button>

          {/* Primary Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Drukuj A4</span>
          </button>
        </div>
      </div>

      {/* Helper notice */}
      <div className="no-print text-center text-xs text-slate-500 mb-2 select-none">
        Kliknij w dowolny tekst, wymiar, kod na wadze lub numer referencyjny (Ref) w ramce 5,5 × 3,7 cm, aby go zmienić.
      </div>

      {/* Main A4 Sheet Canvas (Direct On-Page Editing) */}
      <div
        className="no-print transition-transform origin-top flex flex-col items-center pb-16"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top center',
        }}
      >
        <A4PrintSheet
          items={displayedItems}
          pageIndex={0}
          totalPages={1}
          settings={settings}
          selectedId={null}
          onSelectItem={() => {}}
          onUpdateItem={handleUpdateItem}
          isPrintMode={false}
        />
      </div>

      {/* Dedicated Print container (Triggered by Ctrl+P / window.print()) */}
      <div className="hidden print:block">
        <A4PrintSheet
          items={displayedItems}
          pageIndex={0}
          totalPages={1}
          settings={settings}
          selectedId={null}
          onSelectItem={() => {}}
          onUpdateItem={() => {}}
          isPrintMode={true}
        />
      </div>
    </div>
  );
}
