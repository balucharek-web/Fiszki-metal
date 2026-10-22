import React from 'react';
import { FiszkaItem, SheetSettings } from '../types/label';
import { StandersLogo } from './StandersLogo';

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
      className={`relative box-border bg-white flex items-center overflow-hidden text-slate-900 border border-slate-300 ${
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
        <span className="no-print absolute top-1 left-1.5 text-[8.5px] font-mono text-slate-300 select-none pointer-events-none">
          #{index + 1}
        </span>
      )}

      {/* 1. LEFT SECTION: Logo & Brand (38mm) */}
      <div
        className="flex flex-col items-center justify-center border-r border-slate-200/90 px-[3mm] py-[2mm] bg-white shrink-0 select-none h-full"
        style={{ width: '38mm' }}
      >
        {settings.useStandersLogo ? (
          <StandersLogo brandText={settings.brandName || 'STANDERS'} />
        ) : (
          <div className="text-center font-extrabold uppercase tracking-tight text-slate-800 text-[14px]">
            {settings.brandName || 'STANDERS'}
          </div>
        )}
      </div>

      {/* 2. MIDDLE SECTION: Nazwa, Wymiar, Kod na wadze (~100mm) */}
      <div className="flex-1 flex flex-col justify-between px-[5mm] py-[2.2mm] overflow-hidden h-full">
        {/* Row 1: Product Name ("Wkręt do drewna") */}
        <div className="w-full">
          {!isPrintMode ? (
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleTextChange('name', e.target.value)}
              placeholder="Wkręt do drewna"
              className="w-full font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.5 rounded-xs"
              style={{
                fontSize: '4.6mm',
                lineHeight: 1.2,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
              title="Kliknij, aby zmienić nazwę towaru"
            />
          ) : (
            <div
              className="font-semibold text-slate-900 truncate px-1"
              style={{
                fontSize: '4.6mm',
                lineHeight: 1.2,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
            >
              {item.name || 'Wkręt do drewna'}
            </div>
          )}
        </div>

        {/* Row 2: Dimension / Size ("6x80 mm") */}
        <div className="w-full">
          {!isPrintMode ? (
            <input
              type="text"
              value={item.dimension}
              onChange={(e) => handleTextChange('dimension', e.target.value)}
              placeholder="6x80 mm"
              className="w-full font-bold text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none transition-colors px-1 py-0.5 rounded-xs"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.2,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
              title="Kliknij, aby zmienić wymiar"
            />
          ) : (
            <div
              className="font-bold text-slate-950 truncate px-1"
              style={{
                fontSize: '4.8mm',
                lineHeight: 1.2,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              }}
            >
              {item.dimension || '6x80 mm'}
            </div>
          )}
        </div>

        {/* Row 3: Light Green Scale Code Pill Badge ("Wpisz na wadze: 247") */}
        <div
          className="flex items-center justify-between rounded-lg px-[3mm] py-[1mm] border border-black/5"
          style={{
            backgroundColor: settings.badgeColor || '#d7f5c5',
            minHeight: '10.5mm',
            maxHeight: '11.5mm',
          }}
        >
          <div className="flex items-center select-none">
            <span
              className="font-semibold text-slate-900"
              style={{ fontSize: '3.6mm' }}
            >
              {settings.scaleLabelText || 'Wpisz na wadze:'}
            </span>
          </div>

          <div className="flex items-center justify-end">
            {!isPrintMode ? (
              <input
                type="text"
                value={item.scaleCode}
                onChange={(e) => handleTextChange('scaleCode', e.target.value)}
                placeholder="247"
                className="w-[28mm] text-right font-black font-mono text-slate-950 bg-transparent border-b border-transparent hover:border-slate-400 focus:border-slate-900 focus:bg-white/40 focus:outline-none px-1 rounded-xs tracking-tight tabular-nums"
                style={{ fontSize: '6.4mm', lineHeight: 1 }}
                title="Kliknij, aby zmienić numer na wadze"
              />
            ) : (
              <span
                className="font-black font-mono text-slate-950 text-right tracking-tight tabular-nums px-1"
                style={{ fontSize: '6.4mm', lineHeight: 1 }}
              >
                {item.scaleCode || '247'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. RIGHT SECTION: Czarna ramka 5.5 cm szerokości × 3.7 cm wysokości (55mm x 37mm) */}
      <div
        className="flex items-center justify-center shrink-0 pr-[1.5mm] pl-[1.5mm]"
        style={{ width: '57mm', height: '40mm' }}
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
          {/* Top of frame: Cena (edytowalne pole tekstowe) */}
          <div className="w-full flex justify-end text-right">
            {!isPrintMode ? (
              <input
                type="text"
                value={item.priceText ?? 'Cena'}
                onChange={(e) => handleTextChange('priceText', e.target.value)}
                placeholder="Cena"
                className="w-full text-right text-slate-900 font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-600 focus:bg-emerald-50/30 focus:outline-none px-1 py-0.5 rounded-xs"
                style={{ fontSize: '3.6mm', lineHeight: 1.1 }}
                title="Kliknij, aby zmienić tekst Cena"
              />
            ) : (
              <span
                className="font-medium text-slate-900 px-1"
                style={{ fontSize: '3.6mm', lineHeight: 1.1 }}
              >
                {item.priceText || 'Cena'}
              </span>
            )}
          </div>

          {/* Bottom of frame: Ref: [numer referencyjny] (edytowalne pole) */}
          <div className="w-full flex items-center justify-end gap-1 text-right">
            <span
              className="text-slate-800 font-medium select-none"
              style={{ fontSize: '3.3mm' }}
            >
              Ref:
            </span>
            {!isPrintMode ? (
              <input
                type="text"
                value={item.refNumber ?? '42660256'}
                onChange={(e) => handleTextChange('refNumber', e.target.value)}
                placeholder="42660256"
                className="w-[32mm] text-right text-slate-950 font-bold font-mono tracking-tight bg-transparent border-b border-transparent hover:border-slate-400 focus:border-emerald-600 focus:bg-emerald-50/40 focus:outline-none px-1 py-0.5 rounded-xs"
                style={{ fontSize: '3.5mm' }}
                title="Kliknij, aby zmienić numer referencji (Ref)"
              />
            ) : (
              <span
                className="font-bold font-mono text-slate-950 tracking-tight px-1"
                style={{ fontSize: '3.5mm' }}
              >
                {item.refNumber || '42660256'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
