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
  const handleTextChange = (field: keyof FiszkaItem, value: string) => {
    if (onUpdate) {
      onUpdate({ [field]: value });
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`relative box-border bg-white flex items-center overflow-hidden text-black border ${
        isSelected && !isPrintMode
          ? 'border-emerald-500 ring-4 ring-emerald-500/40 shadow-xl bg-emerald-50/15'
          : 'border-slate-300'
      } ${!isPrintMode ? 'transition-all hover:border-slate-400 group cursor-pointer' : ''}`}
      style={{
        width: '195mm',
        height: '40mm',
        minWidth: '195mm',
        maxWidth: '195mm',
        minHeight: '40mm',
        maxHeight: '40mm',
      }}
    >
      {/* Visual highlight tag for newly updated or selected fiszka */}
      {!isPrintMode && isSelected && (
        <div className="no-print absolute top-1 right-2 z-10 px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded shadow-md flex items-center gap-1 select-none animate-pulse">
          <span>✓ Zeskanowana fiszka</span>
        </div>
      )}

      {/* Subtle index mark for screen */}
      {!isPrintMode && typeof index === 'number' && (
        <span className="no-print absolute top-1 left-1.5 text-[8px] font-mono text-slate-300 select-none pointer-events-none">
          #{index + 1}
        </span>
      )}

      {/* 1. LEFT SECTION: Logo STANDERS (powiększone, bez pionowej linii dzielącej) */}
      <div
        className="flex items-center justify-center px-[3mm] py-[2mm] bg-white shrink-0 select-none h-full"
        style={{ width: '49mm', minWidth: '49mm', maxWidth: '49mm' }}
      >
        <img
          src="./assets/standers_logo_transparent.png"
          alt="STANDERS"
          className="max-h-[28mm] max-w-[43mm] object-contain select-none"
        />
      </div>

      {/* 2. MIDDLE SECTION: Nazwa (nieco niżej), Wymiar (od razu nad paskiem wagi), Pasek wagi (ekstra pogrubiony numer) */}
      <div className="flex-1 flex flex-col justify-between px-[3.5mm] pt-[5.8mm] pb-[1.8mm] overflow-hidden h-full">
        {/* Row 1: Product Name ("Wkręt do drewna") - nieco niżej */}
        <div className="w-full">
          {!isPrintMode ? (
            <input
              type="text"
              value={item.name || ''}
              onChange={(e) => handleTextChange('name', e.target.value)}
              placeholder="Nazwa artykułu"
              className="w-full font-bold text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.5 rounded-xs"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.15,
                fontFamily: "'Leroy Merlin Sans', sans-serif",
                fontWeight: 700,
              }}
              title="Kliknij, aby zmienić nazwę towaru"
            />
          ) : (
            <div
              className="font-bold text-black truncate px-1"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.15,
                fontFamily: "'Leroy Merlin Sans', sans-serif",
                fontWeight: 700,
              }}
            >
              {item.name || ''}
            </div>
          )}
        </div>

        {/* Dolna grupa: Wymiar od razu nad paskiem wagi */}
        <div className="w-full flex flex-col gap-[0.8mm]">
          {/* Row 2: Dimension / Size ("6x80 mm") - bezpośrednio nad polem wagi */}
          <div className="w-full">
            {!isPrintMode ? (
              <input
                type="text"
                value={item.dimension || ''}
                onChange={(e) => handleTextChange('dimension', e.target.value)}
                placeholder="Wymiar (np. 5x40 mm)"
                className="w-full text-black bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.2 rounded-xs tracking-tight"
                style={{
                  fontSize: '5.9mm',
                  lineHeight: 1.1,
                  fontFamily: "'Leroy Merlin Sans', sans-serif",
                  fontWeight: 800,
                }}
                title="Kliknij, aby zmienić wymiar"
              />
            ) : (
              <div
                className="text-black truncate px-1 tracking-tight"
                style={{
                  fontSize: '5.9mm',
                  lineHeight: 1.1,
                  fontFamily: "'Leroy Merlin Sans', sans-serif",
                  fontWeight: 800,
                }}
              >
                {item.dimension || ''}
              </div>
            )}
          </div>

          {/* Row 3: Zielony pasek (czcionka Leroy Merlin Sans Bold dla napisu i ekstra pogrubiony numer) */}
          <div
            className="flex items-center justify-between rounded-lg px-[3mm] py-[1mm]"
            style={{
              width: '74mm',
              minWidth: '74mm',
              maxWidth: '74mm',
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
                  fontFamily: "'Leroy Merlin Sans', sans-serif",
                  fontWeight: 700,
                }}
              >
                {settings.scaleLabelText || 'Wpisz na wadze:'}
              </span>
            </div>

            <div className="flex items-center justify-end flex-1 pl-1">
              {!isPrintMode ? (
                <input
                  type="text"
                  value={item.scaleCode || ''}
                  onChange={(e) => handleTextChange('scaleCode', e.target.value)}
                  placeholder=""
                  className="w-full text-right text-black bg-transparent border-b border-transparent hover:border-slate-500 focus:border-black focus:bg-white/40 focus:outline-none px-1 rounded-xs tracking-tight tabular-nums"
                  style={{
                    fontSize: '9.2mm',
                    lineHeight: 1,
                    fontFamily: "'Leroy Merlin Sans', sans-serif",
                    fontWeight: 900,
                    WebkitTextStroke: '0.45px currentColor',
                    textShadow: '0.25px 0 0 currentColor, -0.25px 0 0 currentColor',
                  }}
                  title="Numer na wadze"
                />
              ) : (
                <span
                  className="text-black text-right tracking-tight tabular-nums px-1"
                  style={{
                    fontSize: '9.2mm',
                    lineHeight: 1,
                    fontFamily: "'Leroy Merlin Sans', sans-serif",
                    fontWeight: 900,
                    WebkitTextStroke: '0.45px currentColor',
                    textShadow: '0.25px 0 0 currentColor, -0.25px 0 0 currentColor',
                  }}
                >
                  {item.scaleCode || ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. RIGHT SECTION: Odsunięta o 5 mm od prawej krawędzi fiszki */}
      {settings.showRightSection && (
        <div
          className="flex items-center justify-end shrink-0 pr-[5mm]"
          style={{ width: '60mm', minWidth: '60mm', maxWidth: '60mm', height: '40mm' }}
        >
          <div
            className="box-border border border-black bg-white flex flex-col justify-between items-end p-[2.5mm] overflow-hidden"
            style={{
              width: '53.5mm',
              height: '37mm',
              minWidth: '53.5mm',
              maxWidth: '53.5mm',
              minHeight: '37mm',
              maxHeight: '37mm',
            }}
          >
            {/* Top: Cena */}
            <div className="w-full flex justify-end text-right">
              {!isPrintMode ? (
                <input
                  type="text"
                  value={item.priceText || ''}
                  onChange={(e) => handleTextChange('priceText', e.target.value)}
                  placeholder="Cena"
                  className="w-full text-right text-black font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/30 focus:outline-none px-1 py-0.5 rounded-xs"
                  style={{ fontSize: '3.8mm', lineHeight: 1.1, fontFamily: "'Leroy Merlin Sans', sans-serif", fontWeight: 700 }}
                  title="Cena towaru"
                />
              ) : (
                <span
                  className="font-bold text-black px-1"
                  style={{ fontSize: '3.8mm', lineHeight: 1.1, fontFamily: "'Leroy Merlin Sans', sans-serif", fontWeight: 700 }}
                >
                  {item.priceText || ''}
                </span>
              )}
            </div>

            {/* Bottom: Ref: [numer] */}
            <div className="w-full flex items-center justify-end gap-1 text-right">
              <span
                className="text-black font-bold select-none"
                style={{ fontSize: '3.6mm', fontFamily: "'Leroy Merlin Sans', sans-serif", fontWeight: 700 }}
              >
                Ref:
              </span>
              {!isPrintMode ? (
                <input
                  type="text"
                  value={item.refNumber || ''}
                  onChange={(e) => handleTextChange('refNumber', e.target.value)}
                  placeholder=""
                  className="w-[34mm] text-right text-black font-black tracking-tight bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none px-1 py-0.5 rounded-xs"
                  style={{ fontSize: '3.6mm', fontFamily: "'Leroy Merlin Sans', sans-serif", fontWeight: 900 }}
                  title="Numer referencyjny LM"
                />
              ) : (
                <span
                  className="font-black text-black tracking-tight px-1"
                  style={{ fontSize: '3.6mm', fontFamily: "'Leroy Merlin Sans', sans-serif", fontWeight: 900 }}
                >
                  {item.refNumber || ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
