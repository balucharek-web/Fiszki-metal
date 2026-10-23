/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { FiszkaItem, SheetSettings, CuttingGuideStyle } from './types/label';
import { A4PrintSheet } from './components/A4PrintSheet';
import { ExcelImportModal } from './components/ExcelImportModal';
import { DimensionSeriesModal } from './components/DimensionSeriesModal';
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
  FileSpreadsheet,
  Ruler,
  Scissors,
  Sliders,
  Check,
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

  const [settings, setSettings] = useState<SheetSettings>(() => {
    const saved = localStorage.getItem('standers_sheet_settings_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
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
    };
  });

  const [autoFit, setAutoFit] = useState(true);
  const [zoomScale, setZoomScale] = useState(0.78);
  const [activePage, setActivePage] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Modals for Option C (Smart Batch / Mass Tools)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);

  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Sync labels to local storage
  useEffect(() => {
    localStorage.setItem('standers_labels_multi_v1', JSON.stringify(items));
  }, [items]);

  // Sync settings to local storage
  useEffect(() => {
    localStorage.setItem('standers_sheet_settings_v2', JSON.stringify(settings));
  }, [settings]);

  // Calculate zoom scale to fit entire A4 height cleanly on screen without vertical clipping
  const calculateFitScale = () => {
    if (typeof window === 'undefined') return 0.78;
    // Standard A4 at 96 DPI: 794px width x 1123px height
    const a4Height = 1123;
    const a4Width = 794;
    // Available height: viewport height minus top & bottom padding (approx 48px)
    const availableHeight = Math.max(300, window.innerHeight - 48);
    // Available width: viewport width minus sidebar width (approx 320px on desktop)
    const isDesktop = window.innerWidth >= 768;
    const sidebarWidth = isDesktop ? 330 : 0;
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

  // Quick action: Duplicate first card of a specific page to all 7 cards of that page
  const handleDuplicateFirstToPage = (pageIdx: number) => {
    const startIdx = pageIdx * 7;
    const templateItem = items[startIdx];
    if (!templateItem) return;

    const baseCode = parseInt(templateItem.scaleCode) || 240;
    const baseRef = parseInt(templateItem.refNumber || '0') || 0;

    setItems((prev) => {
      const next = [...prev];
      for (let i = 0; i < 7; i++) {
        const targetIdx = startIdx + i;
        if (targetIdx < next.length) {
          next[targetIdx] = {
            ...next[targetIdx],
            name: templateItem.name,
            dimension: templateItem.dimension,
            scaleCode: String(baseCode + i),
            refNumber: baseRef > 0 ? String(baseRef + i) : templateItem.refNumber,
            priceText: templateItem.priceText || 'Cena',
          };
        }
      }
      return next;
    });
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

  // Handler for Excel / Clipboard batch import (Option C)
  const handleImportFromExcel = (newFiszki: FiszkaItem[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setItems(newFiszki);
      setActivePage(0);
    } else {
      setItems((prev) => [...prev, ...newFiszki]);
    }
  };

  // Handler for Dimension Series Generator (Option C)
  const handleApplySeries = (
    seriesItems: FiszkaItem[],
    target: 'activePage' | 'newPage' | 'replaceAll'
  ) => {
    if (target === 'replaceAll') {
      setItems(seriesItems);
      setActivePage(0);
    } else if (target === 'newPage') {
      setItems((prev) => [...prev, ...seriesItems]);
      setTimeout(() => {
        const newPageIdx = Math.floor((items.length + seriesItems.length - 1) / 7);
        scrollToPage(newPageIdx);
      }, 100);
    } else {
      // activePage
      const startIdx = activePage * 7;
      setItems((prev) => {
        const next = [...prev];
        seriesItems.forEach((si, i) => {
          const targetIdx = startIdx + i;
          if (targetIdx < next.length) {
            next[targetIdx] = {
              ...next[targetIdx],
              name: si.name,
              dimension: si.dimension,
              scaleCode: si.scaleCode,
              refNumber: si.refNumber,
              priceText: si.priceText,
            };
          }
        });
        return next;
      });
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
      <aside className="no-print w-full md:w-82 shrink-0 bg-white border-r border-slate-300 md:h-screen md:sticky md:top-0 flex flex-col justify-between shadow-xl z-30 overflow-y-auto">
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

          {/* Primary Action Buttons: Print & Blank PDF */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePrint}
              className="w-full py-2.5 px-4 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              title="Drukuj lub zapisz jako PDF wszystkie strony arkusza"
            >
              <Printer className="w-4 h-4" />
              <span>
                Drukuj A4 ({totalPages}{' '}
                {totalPages === 1 ? 'strona' : totalPages < 5 ? 'strony' : 'stron'})
              </span>
            </button>

            <button
              onClick={() => handleDownloadPdf(true)}
              disabled={isGeneratingPdf}
              className="w-full py-1.5 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Pobierz czysty szablon PDF gotowy do wpisywania"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{isGeneratingPdf ? 'Generowanie...' : 'Pobierz czysty szablon PDF'}</span>
            </button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
            <span>
              Łącznie fiszek: <strong className="text-slate-900">{items.length}</strong>
            </span>
            <span>
              Stron A4: <strong className="text-slate-900">{totalPages}</strong>
            </span>
          </div>

          {/* ========================================================================= */}
          {/* OPTION C: NARZĘDZIA MASOWE / SERYJNE (Super wygoda na PC) */}
          {/* ========================================================================= */}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                Narzędzia seryjne (masowe)
              </span>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                PC
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {/* Button 1: Paste from Excel / Clipboard */}
              <button
                onClick={() => setIsExcelModalOpen(true)}
                className="w-full px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 rounded-xl border border-emerald-200 flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                title="Wklej tabelę skopiowaną ze schowka lub Excela (Nazwa, Wymiar, Kod wagi, Ref)"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>Wklej z Excela / Schowka</span>
                </div>
                <span className="text-[10px] bg-white text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                  Ctrl+V
                </span>
              </button>

              {/* Button 2: Dimension Series Generator */}
              <button
                onClick={() => setIsSeriesModalOpen(true)}
                className="w-full px-3 py-2 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 hover:border-purple-300 rounded-xl border border-purple-200 flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                title="Szybki generator serii wymiarów (np. wkręty 3.5 - 6 mm od 25 do 80 mm)"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
                  <span>Generator serii wymiarów</span>
                </div>
                <span className="text-[10px] bg-white text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                  Auto
                </span>
              </button>

              {/* Button 3: Quick duplicate to active page */}
              <button
                onClick={() => handleDuplicateFirstToPage(activePage)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                title={`Kopiuje fiszkę #${activePage * 7 + 1} na całą stronę ${activePage + 1} z inkrementacją kodu wagi (+1)`}
              >
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Powiel #1 na stronę {activePage + 1} (+1)</span>
              </button>

              {/* Button 4: Copy first name to all */}
              <button
                onClick={handleCopyFirstNameToAll}
                className="w-full px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                title="Kopiuje nazwę z pierwszej fiszki do wszystkich fiszek"
              >
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>Kopiuj nazwę do wszystkich fiszek</span>
              </button>

              {/* Button 5: Renumber codes sequentially */}
              <button
                onClick={handleRenumberCodes}
                className="w-full px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                title="Automatycznie numeruje kody wagi po kolei (+1 od pierwszej fiszki)"
              >
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span>Numeruj wagę po kolei (+1)</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* OPTION B: OPCJE ARKUSZA I WYDRUKU (Miarka 50mm, Linie cięcia, Odstępy) */}
          {/* ========================================================================= */}
          <div className="flex flex-col gap-2.5 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                Opcje arkusza i cięcia
              </span>
            </div>

            {/* 1. Toggle: 50mm Calibration Ruler (Co to za linijka po lewej?) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Miarka kontrolna 50 mm
                  </span>
                </div>
                {/* Switch toggle */}
                <button
                  type="button"
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      includeCalibrationRuler: !s.includeCalibrationRuler,
                    }))
                  }
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                    settings.includeCalibrationRuler ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                  title="Włącz/wyłącz pasek 50 mm z lewej strony arkusza"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      settings.includeCalibrationRuler ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Pasek 5 cm po lewej stronie arkusza do sprawdzenia skali wydruku 1:1 linijką.
              </p>
            </div>

            {/* 2. Cutting Guides / Borders */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-slate-600" />
                  Linie cięcia fiszek
                </span>
                <label className="flex items-center gap-1 text-[11px] font-normal text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showScissorsIcon}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, showScissorsIcon: e.target.checked }))
                    }
                    className="rounded accent-emerald-600 w-3 h-3"
                  />
                  <span>Nożyczki</span>
                </label>
              </div>

              {/* Style selector: Solid / Dashed / None */}
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: 'solid', label: 'Ciągła' },
                    { id: 'dashed', label: 'Przerywana' },
                    { id: 'none', label: 'Brak' },
                  ] as { id: CuttingGuideStyle; label: string }[]
                ).map((st) => (
                  <button
                    key={st.id}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        showCuttingGuides: st.id !== 'none',
                        cuttingGuideStyle: st.id,
                      }))
                    }
                    className={`py-1 text-[11px] font-semibold rounded-md border text-center transition-all cursor-pointer ${
                      (settings.cuttingGuideStyle === st.id && settings.showCuttingGuides) ||
                      (st.id === 'none' && !settings.showCuttingGuides)
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Vertical Spacing between cards (0mm / 2mm / 4mm) */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Odstęp między fiszkami:</span>
                <span className="font-mono text-emerald-800">
                  {settings.verticalSpacingMm} mm
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { mm: 0, label: '0 mm (stykanie)' },
                  { mm: 2, label: '2 mm (gilotyna)' },
                  { mm: 4, label: '4 mm (odstęp)' },
                ].map((sp) => (
                  <button
                    key={sp.mm}
                    onClick={() =>
                      setSettings((s) => ({ ...s, verticalSpacingMm: sp.mm }))
                    }
                    className={`py-1 text-[10px] font-semibold rounded-md border text-center transition-all cursor-pointer ${
                      settings.verticalSpacingMm === sp.mm
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Toggle right section (Cena / Ref) */}
            <label className="flex items-center justify-between px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 cursor-pointer">
              <span>Pokaż sekcję Ref i Cena</span>
              <input
                type="checkbox"
                checked={settings.showRightSection}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showRightSection: e.target.checked }))
                }
                className="accent-emerald-600 w-4 h-4 rounded"
              />
            </label>
          </div>

          {/* Pages Manager Section */}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                Strony A4 ({totalPages})
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
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-100 rounded-lg border border-slate-200">
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

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="w-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Przywróć wzorzec domyślny (1 strona)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetuj do 1 strony</span>
          </button>
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
                  className="w-[210mm] max-w-full flex items-center justify-between px-3 py-1.5 bg-white/90 backdrop-blur-xs rounded-xl border border-slate-300 text-xs text-slate-700 shadow-sm"
                  style={{
                    width: `${210 * 3.7795 * zoomScale}px`,
                  }}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] flex items-center justify-center shadow-xs">
                      {pageIdx + 1}
                    </span>
                    <span>Strona {pageIdx + 1} z {totalPages}</span>
                    <span className="text-[11px] font-normal text-slate-500 font-mono hidden sm:inline">
                      (fiszki #{pageIdx * 7 + 1} - #{Math.min((pageIdx + 1) * 7, items.length)})
                    </span>
                  </div>

                  {/* Header actions: Quick batch duplicate for this page, Clear, Delete */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDuplicateFirstToPage(pageIdx)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title={`Kopiuje fiszkę #${pageIdx * 7 + 1} na pozostałe 6 fiszek tej strony (+1 kod wagi)`}
                    >
                      <Copy className="w-3 h-3 text-emerald-600" />
                      <span>Powiel #1 na tę stronę</span>
                    </button>

                    <button
                      onClick={() => handleClearPage(pageIdx)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                      title={`Wyczyść pola na stronie ${pageIdx + 1}`}
                    >
                      Wyczyść
                    </button>

                    {totalPages > 1 && (
                      <button
                        onClick={() => handleRemovePage(pageIdx)}
                        className="px-2 py-1 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer flex items-center gap-1"
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

      {/* MODAL 1: Wklej ze schowka / Excela (Option C) */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleImportFromExcel}
        existingCount={items.length}
      />

      {/* MODAL 2: Generator serii wymiarów (Option C) */}
      <DimensionSeriesModal
        isOpen={isSeriesModalOpen}
        onClose={() => setIsSeriesModalOpen(false)}
        onApply={handleApplySeries}
        activePageIndex={activePage}
        totalPages={totalPages}
      />
    </div>
  );
}
