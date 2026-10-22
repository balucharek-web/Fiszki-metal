import React from 'react';
import { FiszkaItem, SheetSettings, CuttingGuideStyle } from '../types/label';
import {
  Plus,
  Trash2,
  Copy,
  Layers,
  Settings2,
  Sparkles,
  Scissors,
  ArrowUp,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';

interface SidebarEditorProps {
  items: FiszkaItem[];
  selectedId: string | null;
  settings: SheetSettings;
  onSelectItem: (id: string) => void;
  onAddItem: () => void;
  onDuplicateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onMoveItem: (id: string, direction: 'up' | 'down') => void;
  onUpdateItem: (id: string, updated: Partial<FiszkaItem>) => void;
  onUpdateSettings: (updated: Partial<SheetSettings>) => void;
  onOpenBatchModal: () => void;
  onOpenComparisonModal: () => void;
  onResetToDefault: () => void;
  onApplyNameToAll: (name: string) => void;
  onRenumberCodes: (startCode: number) => void;
}

export const SidebarEditor: React.FC<SidebarEditorProps> = ({
  items,
  selectedId,
  settings,
  onSelectItem,
  onAddItem,
  onDuplicateItem,
  onDeleteItem,
  onMoveItem,
  onUpdateItem,
  onUpdateSettings,
  onOpenBatchModal,
  onOpenComparisonModal,
  onResetToDefault,
  onApplyNameToAll,
  onRenumberCodes,
}) => {
  const [activeTab, setActiveTab] = React.useState<'items' | 'settings'>('items');
  const selectedItem = items.find((it) => it.id === selectedId) || items[0];

  return (
    <aside className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 select-none">
      {/* Top Header / Mode Switcher */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-full">
          <button
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'items'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Fiszki ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Opcje druku
          </button>
        </div>
      </div>

      {/* Main Tab 1: Fiszki List & Active Editor */}
      {activeTab === 'items' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quick Toolbar */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between gap-2">
            <button
              onClick={onAddItem}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" /> Dodaj fiszkę
            </button>
            <button
              onClick={onOpenBatchModal}
              className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 border border-emerald-200 transition-colors"
              title="Automatyczne generowanie serii i import z Excela"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Wsadowo
            </button>
          </div>

          {/* Active Item Editor Box */}
          {selectedItem && (
            <div className="p-4 bg-emerald-50/30 border-b border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Edycja wybranej fiszki
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDuplicateItem(selectedItem.id)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                    title="Duplikuj tę fiszkę"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {items.length > 1 && (
                    <button
                      onClick={() => onDeleteItem(selectedItem.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white transition-colors"
                      title="Usuń tę fiszkę"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Field 1: Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Nazwa towaru:
                  </label>
                  <button
                    onClick={() => onApplyNameToAll(selectedItem.name)}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 font-medium underline cursor-pointer"
                    title="Ustaw tę nazwę dla wszystkich fiszek na liście"
                  >
                    Ustaw dla wszystkich
                  </button>
                </div>
                <input
                  type="text"
                  value={selectedItem.name}
                  onChange={(e) => onUpdateItem(selectedItem.id, { name: e.target.value })}
                  placeholder="np. Wkręt do drewna"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Field 2 & 3: Dimension & Scale Code in 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Wymiar:
                  </label>
                  <input
                    type="text"
                    value={selectedItem.dimension}
                    onChange={(e) => onUpdateItem(selectedItem.id, { dimension: e.target.value })}
                    placeholder="np. 6x80 mm"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Numer wagi:
                    </label>
                    <button
                      onClick={() => onRenumberCodes(parseInt(selectedItem.scaleCode) || 240)}
                      className="text-[10px] text-emerald-700 hover:text-emerald-900 font-medium underline cursor-pointer"
                      title="Renumeruj kolejne fiszki (+1)"
                    >
                      Numeruj +1
                    </button>
                  </div>
                  <input
                    type="text"
                    value={selectedItem.scaleCode}
                    onChange={(e) => onUpdateItem(selectedItem.id, { scaleCode: e.target.value })}
                    placeholder="np. 247"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-black font-mono"
                  />
                </div>
              </div>

              {/* Field 4 & 5: Ref & Price */}
              {settings.showRightSection && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nr ref (kod):
                    </label>
                    <input
                      type="text"
                      value={selectedItem.refNumber || ''}
                      onChange={(e) => onUpdateItem(selectedItem.id, { refNumber: e.target.value })}
                      placeholder="42660256"
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Tekst ceny:
                    </label>
                    <input
                      type="text"
                      value={selectedItem.priceText || ''}
                      onChange={(e) => onUpdateItem(selectedItem.id, { priceText: e.target.value })}
                      placeholder="Cena"
                      className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List of all cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
              Lista wszystkich pozycji ({items.length}):
            </div>
            {items.map((item, idx) => {
              const isSelected = item.id === selectedId;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between text-xs ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden pr-2">
                    <span
                      className={`font-mono text-[10px] w-4 shrink-0 ${
                        isSelected ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-semibold truncate leading-tight">
                        {item.name || 'Bez nazwy'}
                      </div>
                      <div
                        className={`text-[11px] font-mono leading-tight mt-0.5 ${
                          isSelected ? 'text-emerald-300' : 'text-emerald-700'
                        }`}
                      >
                        {item.dimension || '---'} · Waga: {item.scaleCode || '---'}
                      </div>
                    </div>
                  </div>

                  {/* Reorder actions */}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={idx === 0}
                      onClick={() => onMoveItem(item.id, 'up')}
                      className={`p-1 rounded ${
                        idx === 0
                          ? 'opacity-20 cursor-not-allowed'
                          : isSelected
                          ? 'hover:bg-slate-800 text-slate-300'
                          : 'hover:bg-slate-200 text-slate-500'
                      }`}
                      title="Przesuń wyżej"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={idx === items.length - 1}
                      onClick={() => onMoveItem(item.id, 'down')}
                      className={`p-1 rounded ${
                        idx === items.length - 1
                          ? 'opacity-20 cursor-not-allowed'
                          : isSelected
                          ? 'hover:bg-slate-800 text-slate-300'
                          : 'hover:bg-slate-200 text-slate-500'
                      }`}
                      title="Przesuń niżej"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Tab 2: Settings & Print Options */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-700">
          {/* Liczba fiszek na stronę */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-900">
              Liczba fiszek na arkusz A4:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateSettings({ itemsPerPage: 6, verticalSpacingMm: 4 })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  settings.itemsPerPage === 6
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold">6 fiszek</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Wygodne odstępy (4 mm) i linie cięcia
                </div>
              </button>
              <button
                onClick={() => onUpdateSettings({ itemsPerPage: 7, verticalSpacingMm: 0 })}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  settings.itemsPerPage === 7
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-semibold'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold">7 fiszek</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Maksymalne wypełnienie strony A4
                </div>
              </button>
            </div>
          </div>

          {/* Linie cięcia */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Linie cięcia:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showCuttingGuides}
                  onChange={(e) => onUpdateSettings({ showCuttingGuides: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span className="text-[11px]">Włączone</span>
              </label>
            </div>

            {settings.showCuttingGuides && (
              <div className="flex items-center gap-2">
                {(['dashed', 'solid'] as CuttingGuideStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => onUpdateSettings({ cuttingGuideStyle: style })}
                    className={`flex-1 py-1 px-2 rounded border text-center transition-colors ${
                      settings.cuttingGuideStyle === style
                        ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {style === 'dashed' ? 'Przerywane' : 'Ciągłe'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Odstęp między fiszkami */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Odstęp między fiszkami:</span>
              <span className="font-mono text-slate-600">{settings.verticalSpacingMm} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={settings.verticalSpacingMm}
              onChange={(e) => onUpdateSettings({ verticalSpacingMm: parseInt(e.target.value) || 0 })}
              className="w-full accent-emerald-600"
            />
          </div>

          {/* Kolor paska z wagą */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="block font-semibold text-slate-900">
              Kolor paska z numerem wagi:
            </label>
            <div className="flex items-center gap-2">
              {[
                { label: 'Oryginalna zieleń', color: '#d7f5c5' },
                { label: 'Żółty', color: '#fef08a' },
                { label: 'Błękitny', color: '#bae6fd' },
                { label: 'Biały / Szary', color: '#f1f5f9' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => onUpdateSettings({ badgeColor: c.color })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    settings.badgeColor === c.color
                      ? 'border-slate-900 scale-110 shadow-xs'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Logo i Brand */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Marka / Logo:</span>
            </div>
            <div>
              <input
                type="text"
                value={settings.brandName}
                onChange={(e) => onUpdateSettings({ brandName: e.target.value })}
                placeholder="STANDERS"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={settings.useStandersLogo}
                onChange={(e) => onUpdateSettings({ useStandersLogo: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="text-[11px] text-slate-700">
                Pokaż ikonę podwójnej pętli Standers
              </span>
            </label>
          </div>

          {/* Sekcja prawa: Cena i Ref */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showRightSection}
                onChange={(e) => onUpdateSettings({ showRightSection: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="font-semibold text-slate-900">
                Pokaż prawą sekcję (Cena i Ref)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.includeCalibrationRuler}
                onChange={(e) => onUpdateSettings({ includeCalibrationRuler: e.target.checked })}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
              />
              <span className="text-[11px] text-slate-700">
                Pasek kontrolny 50 mm (do sprawdzenia skali linijką)
              </span>
            </label>
          </div>

          {/* Reset button */}
          <div className="pt-3 border-t border-slate-200">
            <button
              onClick={onResetToDefault}
              className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Przywróć ustawienia domyślne
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Footer Link to Original comparison */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
        <button
          onClick={onOpenComparisonModal}
          className="text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1 text-[11px]"
        >
          📷 Zobacz oryginalną fiszkę ze zdjęcia
        </button>
      </div>
    </aside>
  );
};
