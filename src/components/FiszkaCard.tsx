import React, { useState } from 'react';
import { FiszkaItem, SheetSettings } from '../types/label';

interface FiszkaCardProps {
  item: FiszkaItem;
  settings: SheetSettings;
  isSelected?: boolean;
  onSelect?: () => void;
  onUpdate?: (updated: Partial<FiszkaItem>) => void;
  isPrintMode?: boolean;
  index?: number;
}

export const FiszkaCard: React.FC<FiszkaCardProps> = ({
  item,
  settings,
  isSelected = false,
  onSelect,
  onUpdate,
  isPrintMode = false,
  index,
}) => {
  // Store previous value before field was emptied on focus
  const [prevValues, setPrevValues] = useState<{ [key in keyof FiszkaItem]?: string }>({});

  const handleTextChange = (field: keyof FiszkaItem, value: string) => {
    if (onUpdate) {
      onUpdate({ [field]: value });
    }
  };

  const handleFocus = (field: keyof FiszkaItem, currentValue: string) => {
    // Save current value before clearing
    setPrevValues((prev) => ({ ...prev, [field]: currentValue }));
    // Automatically empty the field on click for fast editing
    handleTextChange(field, '');
  };

  const handleBlur = (field: keyof FiszkaItem, currentValue: string) => {
    // If the field is left empty without typing anything, restore the previous value
    if (!currentValue.trim()) {
      const original = prevValues[field];
      if (original !== undefined && original !== '') {
        handleTextChange(field, original);
      }
    }
  };

  // Determine border style for cutting guides
  let borderClass = 'border border-slate-300';
  if (!settings.showCuttingGuides || settings.cuttingGuideStyle === 'none') {
    borderClass = isPrintMode ? 'border border-transparent' : 'border border-dashed border-slate-200';
  } else if (settings.cuttingGuideStyle === 'dashed') {
    borderClass = 'border border-dashed border-slate-400';
  } else {
    borderClass = 'border border-slate-300';
  }

  return (
    <div
      onClick={onSelect}
      className={`relative box-border bg-white flex items-center overflow-hidden text-black ${borderClass} ${
        !isPrintMode ? 'transition-all hover:border-slate-400 group' : ''
      }`}
      style={{
        width: '195mm',
        height: '40mm',
        minWidth: '195mm',
        maxWidth: '195mm',
        minHeight: '40mm',
        maxHeight: '40mm',
      }}
    >
      {/* Subtle index mark for screen */}
      {!isPrintMode && typeof index === 'number' && (
        <span className="no-print absolute top-1 left-1.5 text-[8px] font-mono text-slate-300 select-none pointer-events-none">
          #{index + 1}
        </span>
      )}

      {/* 1. LEFT SECTION: 1:1 Logo STANDERS (BEZ pionowej linii dzielącej!) */}
      <div
        className="flex items-center justify-center px-[3mm] py-[2mm] bg-white shrink-0 select-none h-full"
        style={{ width: '42mm' }}
      >
        <img
          src="./assets/standers_logo_transparent.png"
          alt="STANDERS"
          className="max-h-[30mm] max-w-[37mm] object-contain select-none"
        />
      </div>

      {/* 2. MIDDLE SECTION: Nazwa, Wymiar (wyraźnie pogrubiony), Pasek wagi (napis i numer ekstra pogrubiony) */}
      <div className="flex-1 flex flex-col justify-between px-[3.5mm] py-[2mm] overflow-hidden h-full">
        {/* Row 1: Product Name ("Wkręt do drewna") */}
        <div className="w-full">
          {!isPrintMode ? (
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleTextChange('name', e.target.value)}
              onFocus={() => handleFocus('name', item.name)}
              onBlur={() => handleBlur('name', item.name)}
              placeholder="Wkręt do drewna"
              className="w-full font-bold text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.5 rounded-xs"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.15,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontWeight: 700,
              }}
              title="Kliknij, aby zmienić nazwę towaru (czyści się automatycznie)"
            />
          ) : (
            <div
              className="font-bold text-black truncate px-1"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.15,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                fontWeight: 700,
              }}
            >
              {item.name || 'Wkręt do drewna'}
            </div>
          )}
        </div>

        {/* Row 2: Dimension / Size ("6x80 mm") - WYRAŹNIE MOCNO POGRUBIONY */}
        <div className="w-full">
          {!isPrintMode ? (
            <input
              type="text"
              value={item.dimension}
              onChange={(e) => handleTextChange('dimension', e.target.value)}
              onFocus={() => handleFocus('dimension', item.dimension)}
              onBlur={() => handleBlur('dimension', item.dimension)}
              placeholder="6x80 mm"
              className="w-full text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.5 rounded-xs tracking-tight"
              style={{
                fontSize: '5.9mm',
                lineHeight: 1.1,
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                fontWeight: 900,
              }}
              title="Kliknij, aby zmienić wymiar (czyści się automatycznie)"
            />
          ) : (
            <div
              className="text-black truncate px-1 tracking-tight"
              style={{
                fontSize: '5.9mm',
                lineHeight: 1.1,
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                fontWeight: 900,
              }}
            >
              {item.dimension || '6x80 mm'}
            </div>
          )}
        </div>

        {/* Row 3: Zielony pasek DOKŁADNIE 7,5 cm (75mm) */}
        <div
          className="flex items-center justify-between rounded-lg px-[3mm] py-[1mm]"
          style={{
            width: '75mm',
            minWidth: '75mm',
            maxWidth: '75mm',
            backgroundColor: settings.badgeColor || '#d7f5c5',
            minHeight: '12.2mm',
            maxHeight: '12.8mm',
          }}
        >
          <div className="flex items-center select-none shrink-0">
            <span
              className="text-black tracking-tight"
              style={{
                fontSize: '4.4mm',
                fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
                fontWeight: 800,
              }}
            >
              {settings.scaleLabelText || 'Wpisz na wadze:'}
            </span>
          </div>

          <div className="flex items-center justify-end flex-1 pl-1">
            {!isPrintMode ? (
              <input
                type="text"
                value={item.scaleCode}
                onChange={(e) => handleTextChange('scaleCode', e.target.value)}
                onFocus={() => handleFocus('scaleCode', item.scaleCode)}
                onBlur={() => handleBlur('scaleCode', item.scaleCode)}
                placeholder="247"
                className="w-full text-right font-mono text-black bg-transparent border-b border-transparent hover:border-slate-500 focus:border-black focus:bg-white/40 focus:outline-none px-1 rounded-xs tracking-tight tabular-nums"
                style={{
                  fontSize: '9.2mm',
                  lineHeight: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900,
                }}
                title="Kliknij, aby zmienić numer na wadze (czyści się automatycznie)"
              />
            ) : (
              <span
                className="font-mono text-black text-right tracking-tight tabular-nums px-1"
                style={{
                  fontSize: '9.2mm',
                  lineHeight: 1,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900,
                }}
              >
                {item.scaleCode || '247'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. RIGHT SECTION: Czarna ramka 5.5 cm szerokości × 3.7 cm wysokości z marginesem 5mm od końca */}
      {settings.showRightSection && (
        <div
          className="flex items-center justify-end shrink-0 pr-[5mm]"
          style={{ width: '60mm', height: '40mm' }}
        >
          <div
            className="box-border border border-black bg-white flex flex-col justify-between items-end p-[2.5mm] overflow-hidden"
            style={{
              width: '55mm',
              height: '37mm',
              minWidth: '55mm',
              maxWidth: '55mm',
              minHeight: '37mm',
              maxHeight: '37mm',
            }}
          >
            {/* Top: Cena */}
            <div className="w-full flex justify-end text-right">
              {!isPrintMode ? (
                <input
                  type="text"
                  value={item.priceText ?? 'Cena'}
                  onChange={(e) => handleTextChange('priceText', e.target.value)}
                  onFocus={() => handleFocus('priceText', item.priceText ?? 'Cena')}
                  onBlur={() => handleBlur('priceText', item.priceText ?? 'Cena')}
                  placeholder="Cena"
                  className="w-full text-right text-black font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/30 focus:outline-none px-1 py-0.5 rounded-xs"
                  style={{ fontSize: '3.8mm', lineHeight: 1.1, fontWeight: 700 }}
                  title="Kliknij, aby zmienić tekst Cena (czyści się automatycznie)"
                />
              ) : (
                <span
                  className="font-bold text-black px-1"
                  style={{ fontSize: '3.8mm', lineHeight: 1.1, fontWeight: 700 }}
                >
                  {item.priceText || 'Cena'}
                </span>
              )}
            </div>

            {/* Bottom: Ref: [numer] */}
            <div className="w-full flex items-center justify-end gap-1 text-right">
              <span
                className="text-black font-bold select-none"
                style={{ fontSize: '3.6mm', fontWeight: 700 }}
              >
                Ref:
              </span>
              {!isPrintMode ? (
                <input
                  type="text"
                  value={item.refNumber ?? '42660256'}
                  onChange={(e) => handleTextChange('refNumber', e.target.value)}
                  onFocus={() => handleFocus('refNumber', item.refNumber ?? '42660256')}
                  onBlur={() => handleBlur('refNumber', item.refNumber ?? '42660256')}
                  placeholder="42660256"
                  className="w-[34mm] text-right text-black font-black font-mono tracking-tight bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none px-1 py-0.5 rounded-xs"
                  style={{ fontSize: '3.6mm', fontWeight: 900 }}
                  title="Kliknij, aby zmienić numer referencji (czyści się automatycznie)"
                />
              ) : (
                <span
                  className="font-black font-mono text-black tracking-tight px-1"
                  style={{ fontSize: '3.6mm', fontWeight: 900 }}
                >
                  {item.refNumber || '42660256'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
