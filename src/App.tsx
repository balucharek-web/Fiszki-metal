/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { FiszkaItem, SheetSettings } from './types/label';
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
  ChevronDown,
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
    const saved = localStorage.getItem('standers_sheet_settings_v3');
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
      includeCalibrationRuler: false, // Domyślnie wyłączona linijka, żeby arkusz był w 100% czysty
      verticalSpacingMm: 0,
    };
  });

  const [autoFit, setAutoFit] = useState(true);
  const [zoomScale, setZoomScale] = useState(0.72);
  const [activePage, setActivePage] = useState(0);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Zwijane menu narzędzi seryjnych
  const [isBatchMenuOpen, setIsBatchMenuOpen] = useState(false);

  // Modale dla narzędzi masowych
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);

  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Sync labels to local storage
  useEffect(() => {
    localStorage.setItem('standers_labels_multi_v1', JSON.stringify(items));
  }, [items]);

  // Sync settings to local storage
  useEffect(() => {
    localStorage.setItem('standers_sheet_settings_v3', JSON.stringify(settings));
  }, [settings]);

  // Obliczenie skali, aby arkusz A4 idealnie mieścił się w oknie bez przewijania
  const calculateFitScale = () => {
    if (typeof window === 'undefined') return 0.72;
    // Format A4 przy 96 DPI: 794px szerokości x 1123px wysokości
    const a4Height = 1123;
    const a4Width = 794;
    // Odliczamy nagłówek strony (~38px), paddingi py-4 (32px), bufor bezpieczeństwa (35px) = ~105px
    const availableHeight = Math.max(300, window.innerHeight - 105);
    const isDesktop = window.innerWidth >= 768;
    const sidebarWidth = isDesktop ? 335 : 0;
    const availableWidth = Math.max(300, window.innerWidth - sidebarWidth - 48);

    const scaleByH = availableHeight / a4Height;
    const scaleByW = availableWidth / a4Width;
    const fit = Math.min(scaleByH, scaleByW, 1.0);
    return Math.max(0.35, Math.round(fit * 100) / 100);
  };

  // Dopasowanie do okna przy zmianie rozmiaru ekranu
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

  // Obsługa powiększania/pomniejszania kółkiem myszy z wciśniętym klawiszem Ctrl
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setAutoFit(false);
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoomScale((z) => Math.max(0.35, Math.min(1.5, Math.round((z + delta) * 100) / 100)));
    }
  };

  const handleUpdateItem = (id: string, updated: Partial<FiszkaItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updated } : it))
    );
  };

  // Powielenie pierwszej fiszki na pozostałe na danej stronie z inkrementacją kodu wagi (+1)
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

  // Kopiowanie nazwy pierwszej fiszki do wszystkich
  const handleCopyFirstNameToAll = () => {
    const firstName = items[0]?.name || 'Wkręt do drewna';
    setItems((prev) => prev.map((it) => ({ ...it, name: firstName })));
  };

  // Numerowanie wag kolejno (+1)
  const handleRenumberCodes = () => {
    const startCode = parseInt(items[0]?.scaleCode) || 240;
    setItems((prev) =>
      prev.map((it, idx) => ({ ...it, scaleCode: String(startCode + idx) }))
    );
  };

  // Dodanie nowej strony A4 (7 nowych fiszek)
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

  // Usunięcie strony
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

  // Wyczyszczenie pól na stronie
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

  // Reset do 1 domyślnej strony
  const handleReset = () => {
    if (window.confirm('Czy chcesz zresetować wszystkie fiszki do wzorca początkowego (1 strona)?')) {
      setItems(INITIAL_LABELS_7);
    }
  };

  // Import z Excela
  const handleImportFromExcel = (newFiszki: FiszkaItem[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setItems(newFiszki);
      setActivePage(0);
    } else {
      setItems((prev) => [...prev, ...newFiszki]);
    }
  };

  // Zastosowanie serii wymiarów
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

  // Generowanie i pobranie PDF z aktualnymi danymi lub czystego
  const handleDownloadFilledPdf = async (empty = false) => {
    try {
      setIsGeneratingPdf(true);
      const itemsToExport = empty
        ? Array.from({ length: 7 }, (_, i) => ({
            id: `empty_${i + 1}`,
            name: '',
            dimension: '',
            scaleCode: '',
            refNumber: '',
            priceText: 'Cena',
          }))
        : items;

      const pdfBytes = await generateFillablePdf(itemsToExport, 7);
      const filename = empty
        ? 'szablon_fiszek_7_pusty_a4.pdf'
        : `fiszki_standers_${totalPages}_stron_${Date.now()}.pdf`;
      downloadBlob(pdfBytes, filename);
    } catch (err) {
      console.error('Błąd generowania PDF:', err);
      // fallback
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Druk bezpośredni z przeglądarki (z marginesem 8.5mm w CSS)
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
    <div
      className="min-h-screen bg-slate-200/90 flex flex-col md:flex-row select-text font-sans"
      onWheel={handleWheel}
    >
      {/* LEWY PANEL KONTROLNY (Ukryty podczas druku) */}
      <aside className="no-print w-full md:w-84 shrink-0 bg-white border-r border-slate-300 md:h-screen md:sticky md:top-0 flex flex-col justify-between shadow-xl z-30 overflow-y-auto">
        <div className="p-4 flex flex-col gap-3.5">
          {/* Header & Logo */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
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

          {/* GŁÓWNE PRZYCISKI DRUKU / PDF */}
          <div className="flex flex-col gap-2">
            {/* Opcja 1: Pobierz idealny PDF z wpisanymi danymi (brak problemu z obcinaniem fiszek przez drukarki!) */}
            <button
              onClick={() => handleDownloadFilledPdf(false)}
              disabled={isGeneratingPdf}
              className="w-full py-2.5 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              title="Generuje idealny wektorowy plik PDF z zachowaniem 8.5mm marginesów - drukarka nigdy nie obetnie fiszek!"
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isGeneratingPdf
                  ? 'Generowanie PDF...'
                  : `Pobierz gotowy PDF (${totalPages} ${totalPages === 1 ? 'strona' : 'strony'})`}
              </span>
            </button>

            {/* Opcja 2: Drukuj bezpośrednio ze strony (z bezpiecznym marginesem 8.5mm) */}
            <button
              onClick={handlePrint}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              title="Drukuj bezpośrednio z przeglądarki (margines 8.5mm zapobiega obcinaniu)"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Drukuj stronę (Ctrl+P)</span>
            </button>

            {/* Opcja 3: Czysty szablon PDF */}
            <button
              onClick={() => handleDownloadFilledPdf(true)}
              disabled={isGeneratingPdf}
              className="w-full py-1.5 px-3 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Pobierz pusty szablon PDF do odręcznego pisania lub w programie PDF"
            >
              <span>Pobierz czysty szablon PDF</span>
            </button>
          </div>

          {/* Pasek statusu */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600">
            <span>
              Łącznie fiszek: <strong className="text-slate-900">{items.length}</strong>
            </span>
            <span>
              Stron A4: <strong className="text-slate-900">{totalPages}</strong>
            </span>
          </div>

          {/* ========================================================================= */}
          {/* NARZĘDZIA SERYJNE - ZWINIĘTE W JEDNĄ OPCJĘ MENU (Zgodnie z życzeniem) */}
          {/* ========================================================================= */}
          <div className="border border-purple-200/80 rounded-xl overflow-hidden bg-purple-50/20 shadow-2xs">
            <button
              type="button"
              onClick={() => setIsBatchMenuOpen(!isBatchMenuOpen)}
              className="w-full px-3 py-2 text-xs font-bold text-purple-900 bg-purple-50/70 hover:bg-purple-100/60 flex items-center justify-between transition-colors cursor-pointer"
              title="Kliknij, aby rozwinąć lub zwinąć narzędzia seryjne (Excel, Serie, Powielanie)"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Narzędzia seryjne (masowe)</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-purple-700 bg-white px-1.5 py-0.2 rounded border border-purple-200">
                  {isBatchMenuOpen ? 'Zwiń' : 'Rozwiń'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-purple-600 transition-transform duration-200 ${
                    isBatchMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>

            {isBatchMenuOpen && (
              <div className="p-2.5 flex flex-col gap-1.5 border-t border-purple-100 bg-white">
                {/* 1. Paste from Excel */}
                <button
                  onClick={() => setIsExcelModalOpen(true)}
                  className="w-full px-2.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 flex items-center justify-between transition-all cursor-pointer"
                  title="Wklej tabelę skopiowaną z programu Excel lub Arkuszy Google (Ctrl+V)"
                >
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Wklej z Excela / Schowka</span>
                  </div>
                  <span className="text-[10px] bg-white text-emerald-700 px-1 py-0.5 rounded border border-emerald-200 font-mono">
                    Ctrl+V
                  </span>
                </button>

                {/* 2. Series Generator */}
                <button
                  onClick={() => setIsSeriesModalOpen(true)}
                  className="w-full px-2.5 py-2 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 flex items-center justify-between transition-all cursor-pointer"
                  title="Generator ciągów wymiarów (np. 10x2; 15x3; 20x4...)"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Generator serii wymiarów</span>
                  </div>
                  <span className="text-[10px] bg-white text-purple-700 px-1 py-0.5 rounded border border-purple-200 font-mono">
                    Seria
                  </span>
                </button>

                {/* 3. Duplicate #1 to active page */}
                <button
                  onClick={() => handleDuplicateFirstToPage(activePage)}
                  className="w-full px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                  title={`Kopiuje fiszkę #${activePage * 7 + 1} na pozostałe fiszki tej strony (+1 kod wagi)`}
                >
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Powiel #1 na stronę {activePage + 1} (+1)</span>
                </button>

                {/* 4. Copy name to all */}
                <button
                  onClick={handleCopyFirstNameToAll}
                  className="w-full px-2.5 py-1.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                  title="Kopiuje nazwę z pierwszej fiszki do wszystkich fiszek"
                >
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kopiuj nazwę do wszystkich fiszek</span>
                </button>

                {/* 5. Renumber codes */}
                <button
                  onClick={handleRenumberCodes}
                  className="w-full px-2.5 py-1.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
                  title="Numeruje kody wagi po kolei (+1 od pierwszej fiszki)"
                >
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>Numeruj wagę po kolei (+1)</span>
                </button>
              </div>
            )}
          </div>

          {/* Opcje dodatkowe (dyskretne) */}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2.5">
            {/* Przełącznik linijki kontrolnej 50 mm */}
            <label className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer">
              <span className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-slate-500" />
                <span>Miarka kontrolna 50 mm</span>
              </span>
              <input
                type="checkbox"
                checked={settings.includeCalibrationRuler}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, includeCalibrationRuler: e.target.checked }))
                }
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
            </label>

            {/* Przełącznik sekcji Ref i Cena */}
            <label className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 cursor-pointer">
              <span>Pokaż pole Cena i Nr ref.</span>
              <input
                type="checkbox"
                checked={settings.showRightSection}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, showRightSection: e.target.checked }))
                }
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Menadżer stron A4 */}
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-2.5">
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

            {/* Pigułki stron */}
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
                  title={`Przewiń do strony ${pIdx + 1}`}
                >
                  <FileText className="w-3 h-3" />
                  <span>Strona {pIdx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Przycisk resetu */}
          <button
            onClick={handleReset}
            className="w-full px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Przywróć wzorzec domyślny (1 strona)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetuj do 1 strony</span>
          </button>
        </div>

        {/* DOLNY PASEK ZOOMU Z NATYCHMIASTOWĄ PŁYNNĄ ZMIANĄ I SUWAKIEM */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Skala podglądu:</span>
            <span className="font-mono text-emerald-800 font-bold text-sm">
              {Math.round(zoomScale * 100)}%
            </span>
          </div>

          {/* Interaktywny suwak do płynnego przybliżania i oddalania */}
          <input
            type="range"
            min="0.35"
            max="1.40"
            step="0.02"
            value={zoomScale}
            onChange={(e) => {
              setAutoFit(false);
              setZoomScale(parseFloat(e.target.value));
            }}
            className="w-full accent-emerald-600 cursor-pointer"
            title="Przesuń, aby powiększyć lub pomniejszyć podgląd"
          />

          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale((z) => Math.max(0.35, Math.round((z - 0.10) * 100) / 100));
              }}
              className="py-1 px-1.5 text-xs text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center gap-0.5 cursor-pointer"
              title="Oddal o 10%"
            >
              <ZoomOut className="w-3.5 h-3.5" />
              <span>-10%</span>
            </button>

            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale((z) => Math.min(1.50, Math.round((z + 0.10) * 100) / 100));
              }}
              className="py-1 px-1.5 text-xs text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center gap-0.5 cursor-pointer"
              title="Przybliż o 10%"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>+10%</span>
            </button>

            <button
              onClick={() => {
                setAutoFit(false);
                setZoomScale(1.0);
              }}
              className="py-1 px-1 text-[11px] font-mono text-slate-700 bg-white hover:bg-slate-100 rounded border border-slate-200 flex items-center justify-center cursor-pointer"
              title="Rozmiar 100% (skala rzeczywista)"
            >
              100%
            </button>

            <button
              onClick={() => {
                setAutoFit(true);
                setZoomScale(calculateFitScale());
              }}
              className={`py-1 px-1 text-[11px] font-bold rounded border flex items-center justify-center gap-0.5 cursor-pointer transition-colors ${
                autoFit
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Dopasuj cały arkusz A4 do wysokości ekranu bez przewijania"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Dopasuj</span>
            </button>
          </div>

          <div className="text-[10px] text-slate-500 text-center select-none">
            {autoFit ? '✓ Cała strona A4 mieści się na ekranie' : 'Ctrl + kółko myszy = szybki zoom'}
          </div>
        </div>
      </aside>

      {/* GŁÓWNY OBSZAR PODGLĄDU A4 (Przewijany tylko przy wielu stronach lub powiększeniu) */}
      <main
        ref={mainScrollRef}
        className="flex-1 min-h-screen flex flex-col items-center py-4 px-2 md:px-6 overflow-y-auto no-print"
      >
        <div className="flex flex-col items-center gap-6 w-full max-w-5xl pb-12">
          {Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageItems = items.slice(pageIdx * 7, (pageIdx + 1) * 7);
            const scaledWidthPx = Math.round(794 * zoomScale);
            const scaledHeightPx = Math.round(1123 * zoomScale);

            return (
              <div
                key={`page_container_${pageIdx}`}
                id={`a4-sheet-page-${pageIdx}`}
                className="flex flex-col items-center gap-1.5"
              >
                {/* Belka informacyjna nad stroną A4 */}
                <div
                  className="flex items-center justify-between px-3 py-1 bg-white/95 backdrop-blur-xs rounded-lg border border-slate-300 text-xs text-slate-700 shadow-xs"
                  style={{
                    width: `${scaledWidthPx}px`,
                    maxWidth: '100%',
                  }}
                >
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span className="w-4.5 h-4.5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center shadow-2xs">
                      {pageIdx + 1}
                    </span>
                    <span>Strona {pageIdx + 1} z {totalPages}</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono hidden sm:inline">
                      (fiszki #{pageIdx * 7 + 1} - #{Math.min((pageIdx + 1) * 7, items.length)})
                    </span>
                  </div>

                  {/* Szybkie akcje strony */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicateFirstToPage(pageIdx)}
                      className="px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors cursor-pointer flex items-center gap-1"
                      title={`Kopiuje fiszkę #${pageIdx * 7 + 1} na całą tę stronę (+1 kod wagi)`}
                    >
                      <Copy className="w-3 h-3 text-emerald-600" />
                      <span>Powiel #1</span>
                    </button>

                    <button
                      onClick={() => handleClearPage(pageIdx)}
                      className="px-2 py-0.5 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
                      title={`Wyczyść pola na stronie ${pageIdx + 1}`}
                    >
                      Wyczyść
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

                {/* SKALOWANY KONTENER ARKUSZA A4: Wymiary nadrzędne DOKŁADNIE odpowiadają skali, więc auto-fit nie wymaga scrollowania! */}
                <div
                  className="relative transition-all duration-75 flex items-center justify-center"
                  style={{
                    width: `${scaledWidthPx}px`,
                    height: `${scaledHeightPx}px`,
                    minWidth: `${scaledWidthPx}px`,
                    minHeight: `${scaledHeightPx}px`,
                  }}
                >
                  <div
                    style={{
                      width: '794px',
                      height: '1123px',
                      transform: `scale(${zoomScale})`,
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0,
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
              </div>
            );
          })}

          {/* Dodaj kolejną stronę A4 */}
          <div className="w-full flex justify-center pt-2">
            <button
              onClick={handleAddPage}
              className="py-2.5 px-5 bg-white hover:bg-slate-50 border-2 border-dashed border-emerald-500 hover:border-emerald-600 text-emerald-800 rounded-xl flex items-center gap-2 font-bold text-xs shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>+ Dodaj kolejną stronę A4 (+7 fiszek)</span>
            </button>
          </div>
        </div>
      </main>

      {/* KONTENER DLA DRUKU PRZEGLĄDARKI (Ukryty na ekranie, aktywny podczas window.print()) */}
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

      {/* MODAL 1: Wklej ze schowka / Excela */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleImportFromExcel}
        existingCount={items.length}
      />

      {/* MODAL 2: Generator serii wymiarów */}
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
