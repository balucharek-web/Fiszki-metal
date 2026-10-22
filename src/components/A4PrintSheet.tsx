import React from 'react';
import { FiszkaItem, SheetSettings } from '../types/label';
import { FiszkaCard } from './FiszkaCard';
import { Scissors } from 'lucide-react';

interface A4PrintSheetProps {
  items: FiszkaItem[];
  pageIndex: number;
  totalPages: number;
  settings: SheetSettings;
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, updated: Partial<FiszkaItem>) => void;
  isPrintMode?: boolean;
}

export const A4PrintSheet: React.FC<A4PrintSheetProps> = ({
  items,
  pageIndex,
  totalPages,
  settings,
  selectedId,
  onSelectItem,
  onUpdateItem,
  isPrintMode = false,
}) => {
  const count = settings.itemsPerPage;
  // Calculate vertical metrics
  const totalLabelsHeight = count * 40; // 40mm each
  const totalGapHeight = (count - 1) * settings.verticalSpacingMm;
  const contentHeight = totalLabelsHeight + totalGapHeight;
  const verticalMargin = Math.max(4, Math.floor((297 - contentHeight) / 2));

  return (
    <div
      className={`print-page relative box-border bg-white flex flex-col justify-start items-center ${
        !isPrintMode ? 'shadow-2xl border border-slate-300 mx-auto transition-transform' : ''
      }`}
      style={{
        width: '210mm',
        height: '297mm',
        minWidth: '210mm',
        maxWidth: '210mm',
        minHeight: '297mm',
        maxHeight: '297mm',
        paddingTop: `${verticalMargin}mm`,
        paddingBottom: `${verticalMargin}mm`,
        paddingLeft: '7.5mm',
        paddingRight: '7.5mm',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Non-print sheet header badge */}
      {!isPrintMode && (
        <div className="absolute top-2 left-3 text-[11px] font-mono text-slate-400 select-none">
          Strona A4 {pageIndex + 1} z {totalPages} · Format 210 × 297 mm
        </div>
      )}

      {/* 5cm Calibration Ruler on Left Margin */}
      {settings.includeCalibrationRuler && (
        <div
          className="absolute left-[1.5mm] top-[20mm] flex flex-col items-center select-none text-slate-400"
          style={{ height: '50mm', width: '5mm' }}
          title="Pasek kontrolny 50 mm (5 cm) do weryfikacji skali wydruku linijką"
        >
          <div className="h-[1px] w-[4mm] bg-slate-400"></div>
          <div className="flex-1 flex flex-col justify-between items-center w-full my-0.5 border-l border-slate-300">
            {[1, 2, 3, 4].map((cm) => (
              <div key={cm} className="w-[2.5mm] h-[0.5px] bg-slate-300 self-start ml-[1px]"></div>
            ))}
          </div>
          <div className="h-[1px] w-[4mm] bg-slate-400"></div>
          <span
            className="text-[7px] font-mono tracking-tighter text-slate-400 rotate-90 whitespace-nowrap mt-2"
            style={{ transformOrigin: 'top left' }}
          >
            50 mm
          </span>
        </div>
      )}

      {/* Sheet Metadata / Cutting helper at the very bottom margin */}
      <div className="absolute bottom-[2mm] left-0 right-0 px-[7.5mm] flex justify-between items-center text-[7.5pt] text-slate-400 font-mono select-none">
        <span>Fiszka regałowa: 195 × 40 mm · Skala 1:1</span>
        <span>Arkusz A4 — Strona {pageIndex + 1}/{totalPages}</span>
      </div>

      {/* Main Labels Container */}
      <div
        className="flex flex-col items-center w-[195mm]"
        style={{
          gap: `${settings.verticalSpacingMm}mm`,
        }}
      >
        {items.map((item, idx) => {
          const globalIdx = pageIndex * count + idx;
          return (
            <div key={item.id} className="relative group">
              {/* Optional Cutting Guide / Scissor indicator */}
              {settings.showCuttingGuides && settings.showScissorsIcon && (
                <div
                  className="absolute -top-[3mm] -left-[6mm] flex items-center gap-1 text-slate-300 select-none pointer-events-none"
                  style={{ display: idx === 0 && verticalMargin < 8 ? 'none' : 'flex' }}
                >
                  <Scissors className="w-2.5 h-2.5 rotate-90" />
                </div>
              )}

              {/* The 19.5 x 4 cm Card */}
              <FiszkaCard
                item={item}
                settings={settings}
                isSelected={selectedId === item.id}
                onSelect={() => onSelectItem(item.id)}
                onUpdate={(updated) => onUpdateItem(item.id, updated)}
                isPrintMode={isPrintMode}
                index={globalIdx}
              />

              {/* Cutting guides between items */}
              {settings.showCuttingGuides && idx < items.length - 1 && settings.verticalSpacingMm > 0 && (
                <div
                  className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
                  style={{
                    bottom: `-${settings.verticalSpacingMm / 2}mm`,
                    height: '1px',
                  }}
                >
                  <div
                    className="w-full border-t border-slate-300"
                    style={{
                      borderTopStyle: settings.cuttingGuideStyle === 'dashed' ? 'dashed' : 'solid',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
