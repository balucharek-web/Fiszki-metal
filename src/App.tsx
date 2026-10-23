/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  Trash2,
  Layers,
  FileText,
  Sparkles,
} from 'lucide-react';
import { generateFillablePdf, downloadBlob } from './utils/pdfGenerator';

const INITIAL_LABELS_7: FiszkaItem[] = [
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
  const [items, setItems] = useState<FiszkaItem[]>(() => {
    const saved = localStorage.getItem('standers_labels_multi_v1');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 7) return parsed;
      } catch {
        // fallback
      }
    }
    return INITIAL_LABELS_7;
  });

  const [settings] = useState<SheetSettings>({
    itemsPerPage: 7,
    showCuttingGuides: true,
    cuttingGuideStyle: 'solid',
    showScissorsIcon: false,
    showRightSection: true,
    brandName: 'STANDERS',
    useStandersLogo: true,
    scaleLabelText: 'Wpisz na wadze:',
    badgeColor: '#d7f5c5',
    includeCalibrationRuler: true,
    verticalSpacingMm: 0,
  });

  const [autoFit, setAutoFit] = useState(true);
  const [zoomScale, setZoomScale] = useState(0.78);
  const [activePage, setActivePage] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('standers_labels_multi_v1', JSON.stringify(items));
  }, [items]);

  // Calculate zoom scale to fit entire A4 height cleanly on screen without vertical clipping
  const calculateFitScale = () => {
    if (typeof window === 'undefined') return 0.78;
    // Standard A4 at 96 DPI: 794px width x 1123px height
    const a4Height = 1123;
    const a4Width = 794;
    // Available height: viewport height minus top & bottom padding (approx 48px)
    const availableHeight = Math.max(300, window.innerHeight - 48);
    // Available width: viewport width minus sidebar width (approx 310px on md) minus margins
    const isDesktop = window.innerWidth >= 768;
    const sidebarWidth = isDesktop ? 310 : 0;
    const availableWidth = Math.max(300, window.innerWidth - sidebarWidth - 48);

    const scaleByH = availableHeight / a4Height;
    const scaleByW = availableWidth / a4Width;
    const fit = Math.min(scaleByH, scaleByW, 1.05);
    return Math.max(0.35, Math.round(fit * 100) / 100);
  };

  // Re-calculate auto-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      if (autoFit) {
        setZoomScale(calculateFitScale());
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [autoFit]);

  const handleUpdateItem = (id: string, updated: Partial<FiszkaItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updated } : it))
    );
  };

  // Quick action: Copy name of first label to ALL labels across all pages
  const handleCopyFirstNameToAll = () => {
    const firstName = items[0]?.name || 'Wkręt do drewna';
    setItems((prev) => prev.map((it) => ({ ...it, name: firstName })));
  };

  // Quick action: Renumber scale codes sequentially (+1) across ALL labels
  const handleRenumberCodes = () => {
    const startCode = parseInt(items[0]?.scaleCode) || 240;
    setItems((prev) =>
      prev.map((it, idx) => ({ ...it, scaleCode: String(startCode + idx) }))
    );
  };

  // Add a new A4 page (7 new labels)
  const handleAddPage = () => {
    const lastItem = items[items.length - 1];
    const lastCode = parseInt(lastItem?.scaleCode) || (240 + items.length - 1);
    const newItems: FiszkaItem[] = Array.from({ length: 7 }, (_, idx) => ({
      id: `fiszka_${items.length + idx + 1}_${Date.now()}`,
      name: lastItem?.name || 'Wkręt do drewna',
      dimension: '',
      scaleCode: String(lastCode + idx + 1),
      refNumber: '',
      priceText: 'Cena',
    }));
    setItems((prev) => [...prev, ...newItems]);
    // Scroll to the newly added page
    setTimeout(() => {
      const newPageIdx = Math.floor(items.length / 7);
      scrollToPage(newPageIdx);
    }, 100);
  };

  // Remove a specific page
  const handleRemovePage = (pageIdx: number) => {
    if (totalPages <= 1) return;
    if (window.confirm(`Czy na pewno chcesz usunąć stronę ${pageIdx + 1}?`)) {
      setItems((prev) => {
        const start = pageIdx * 7;
        const end = start + 7;
        return prev.filter((_, idx) => idx < start || idx >= end);
      });
    }
  };

  // Clear fields on a specific page
  const handleClearPage = (pageIdx: number) => {
    if (window.confirm(`Wyczyścić wymiary i kody na stronie ${pageIdx + 1}?`)) {
      setItems((prev) =>
        prev.map((it, idx) => {
          if (idx >= pageIdx * 7 && idx < (pageIdx + 1) * 7) {
            return {
              ...it,
              dimension: '',
              scaleCode: '',
              refNumber: '',
            };
          }
          return it;
        })
      );
    }
  };

  // Reset to initial clean 7 labels
  const handleReset = () => {
    if (window.confirm('Czy chcesz zresetować wszystkie fiszki do wzorca początkowego (1 strona)?')) {
      setItems(INITIAL_LABELS_7);
    }
  };

  // Download clean PDF template without pre-filled text
  const handleDownloadPdf = async (empty = true) => {
    try {
      setIsGeneratingPdf(true);
      const itemsToExport = Array.from({ length: 7 }, (_, i) => ({
        id: `empty_${i + 1}`,
        name: '',
        dimension: '',
        scaleCode: '',
        refNumber: '',
        priceText: 'Cena',
      }));
      const pdfBytes = await generateFillablePdf(itemsToExport, 7);
      downloadBlob(pdfBytes, 'szablon_fiszek_7_pusty_a4.pdf');
    } catch (err) {
      console.error('PDF generation error, downloading fallback:', err);
      const link = document.createElement('a');
      link.href = './szablon_fiszek_7_pusty_a4.pdf';
      link.download = 'szablon_fiszek_7_pusty_a4.pdf';
      link.click();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalPages = Math.max(1, Math.ceil(items.length / 7));

  const scrollToPage = (pageIdx: number) => {
    setActivePage(pageIdx);
    const el = document.getElementById(`a4-sheet-page-${pageIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-200/90 flex flex-col md:flex-row select-text font-sans">
      {/* LEFT SIDEBAR CONTROLS (Hidden during printing) */}
      <aside className="no-print w-full md:w-76 shrink-0 bg-white border-r border-slate-300 md:h-screen md:sticky md:top-0 flex flex-col justify-between shadow-xl z-30 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* Header & Logo */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <img
                src="./assets/standers_logo_clean.png"
                alt="Standers"
                className="h-6 object-contain"
              />
              <span className="font-bold text-slate-800 text-sm">Fiszki A4</span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
              19.5 × 4 cm
            </span>
          </div>

          {/* Primary Print Button */}
          <button
            onClick={handlePrint}
            className="w-full py-2.5 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
            title="Drukuj lub zapisz jako PDF wszystkie strony arkusza"
          >
            <Printer className="w-4 h-4" />
            <span>Drukuj A4 ({totalPages} {totalPages === 1 ? 'strona' : totalPages < 5 ? 'strony' : 'stron'})</span>
          </button>

          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
            <span>Łącznie fiszek: <strong className="text-slate-900">{items.length}</strong></span>
            <span>Stron A4: <strong className="text-slate-900">{totalPages}</strong></span>
          </div>

          {/* Pages Manager Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Strony A4
              </span>
              <button
                onClick={handleAddPage}
                className="px-2 py-0.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                title="Dodaj kolejną stronę A4 (7 nowych fiszek)"
              >
                <Plus className="w-3 h-3" />
                <span>Dodaj stronę</span>
              </button>
            </div>

            {/* Quick jump page pills */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-100 rounded-lg border border-slate-200">
              {Array.from({ length: totalPages }).map((_, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => scrollToPage(pIdx)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    activePage === pIdx
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                  title={`Przewiń do strony ${pIdx + 1} (fiszki ${pIdx * 7 + 1} - ${Math.min((pIdx + 1) * 7, items.length)})`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Strona {pIdx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions (Across all labels) */}
          <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Szybkie akcje (dla wszystkich)
            </span>

            <button
              onClick={handleCopyFirstNameToAll}
              className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
              title="Kopiuje nazwę z pierwszej fiszki do wszystkich pozostałych fiszek"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Kopiuj nazwę do wszystkich</span>
            </button>

            <button
              onClick={handleRenumberCodes}
              className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
              title="Automatycznie numeruje kody wagi po kolei (+1 od pierwszej fiszki)"
            >
              <Hash className="w-3.5 h-3.5 text-slate-500" />
              <span>Numeruj wagę po kolei (+1)</span>
            </button>

            <button
              onClick={handleReset}
              className="w-full px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
              title="Przywróć wzorzec domyślny (1 strona)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Resetuj do 1 strony</span>
            </button>
          </div>

          {/* Clean PDF Template Download */}
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => handleDownloadPdf(true)}
              disabled={isGeneratingPdf}
              className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Pobierz czysty plik PDF z pustymi polami (klikasz i od razu piszesz)"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{isGeneratingPdf ? 'Generowanie...' : 'Czysty szablon PDF'}</span>
            </button>
          </div>
        </div>

        {/* Footer: Zoom Controls with Auto-Fit */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Skala podglądu:</span>
            <span className="font-mono text-slate-800 font-bold">
              {Math.round(zoomScale * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale((z) => Math.max(0.4, Math.round((z - 0.05) * 100) / 100));
              }}
              className="py-1 px-2 text-xs text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Oddal"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale((z) => Math.min(1.2, Math.round((z + 0.05) * 100) / 100));
              }}
              className="py-1 px-2 text-xs text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Przybliż"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale(1.0);
              }}
              className="py-1 px-1 text-[11px] font-mono text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Rozmiar rzeczywisty 100%"
            >
              100%
            </button>

            <button
              onClick={() => {
                setAutoFit(true);
                setZoomScale(calculateFitScale());
              }}
              className={`py-1 px-1 text-[11px] font-bold rounded border flex items-center justify-center gap-0.5 cursor-pointer ${
                autoFit
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Dopasuj całą stronę A4 pionowo do wysokości ekranu"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Dopasuj</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 text-center select-none">
            {autoFit ? '✓ Cała strona A4 mieści się na ekranie' : 'Kliknij „Dopasuj”, aby dopasować A4'}
          </div>
        </div>
      </aside>

      {/* RIGHT / MAIN CANVAS AREA: All A4 Sheets stacked vertically */}
      <main
        ref={mainScrollRef}
        className="flex-1 min-h-screen flex flex-col items-center py-6 px-2 md:px-8 overflow-y-auto no-print"
      >
        <div className="flex flex-col items-center gap-8 w-full max-w-4xl pb-16">
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageItems = items.slice(pageIdx * 7, (pageIdx + 1) * 7);

            return (
              <div
                key={`page_container_${pageIdx}`}
                id={`a4-sheet-page-${pageIdx}`}
                className="flex flex-col items-center gap-2 w-full"
              >
                {/* Page Action Header Bar */}
                <div
                  className="w-[210mm] max-w-full flex items-center justify-between px-2 py-1 bg-white/80 backdrop-blur-xs rounded-lg border border-slate-300 text-xs text-slate-700 shadow-xs"
                  style={{
                    width: `${210 * 3.7795 * zoomScale}px`,
                  }}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center">
                      {pageIdx + 1}
                    </span>
                    <span>Strona {pageIdx + 1} z {totalPages}</span>
                    <span className="text-[11px] font-normal text-slate-500 font-mono">
                      (fiszki #{pageIdx * 7 + 1} - #{Math.min((pageIdx + 1) * 7, items.length)})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleClearPage(pageIdx)}
                      className="px-2 py-0.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
                      title={`Wyczyść pola na stronie ${pageIdx + 1}`}
                    >
                      Wyczyść stronę
                    </button>

                    {totalPages > 1 && (
                      <button
                        onClick={() => handleRemovePage(pageIdx)}
                        className="px-2 py-0.5 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors cursor-pointer flex items-center gap-1"
                        title={`Usuń stronę ${pageIdx + 1}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Usuń</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Scaled A4 Sheet Canvas */}
                <div
                  className="transition-transform origin-top flex flex-col items-center"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top center',
                    marginBottom: `-${1123 * (1 - zoomScale)}px`,
                  }}
                >
                  <A4PrintSheet
                    items={pageItems}
                    pageIndex={pageIdx}
                    totalPages={totalPages}
                    settings={settings}
                    selectedId={null}
                    onSelectItem={() => {}}
                    onUpdateItem={handleUpdateItem}
                    isPrintMode={false}
                  />
                </div>
              </div>
            );
          })}

          {/* Big Add Page Button at the bottom */}
          <div className="w-full flex justify-center pt-2">
            <button
              onClick={handleAddPage}
              className="py-3 px-6 bg-white hover:bg-slate-50 border-2 border-dashed border-emerald-500 hover:border-emerald-600 text-emerald-800 rounded-2xl flex items-center gap-2 font-bold text-sm shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5 text-emerald-600" />
              <span>+ Dodaj kolejną stronę A4 (+7 fiszek)</span>
            </button>
          </div>
        </div>
      </main>

      {/* DEDICATED PRINT CONTAINER (Triggered by window.print()) */}
      <div className="hidden print:block">
        {Array.from({ length: totalPages }).map((_, pageIdx) => {
          const pageItems = items.slice(pageIdx * 7, (pageIdx + 1) * 7);
          return (
            <A4PrintSheet
              key={`print_page_${pageIdx}`}
              items={pageItems}
              pageIndex={pageIdx}
              totalPages={totalPages}
              settings={settings}
              selectedId={null}
              onSelectItem={() => {}}
              onUpdateItem={() => {}}
              isPrintMode={true}
            />
          );
        })}
      </div>
    </div>
  );
}
