import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  Check,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  Plus,
  Trash2,
  FileSpreadsheet,
  ArrowRight,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { FiszkaItem } from '../types/label';

interface EslScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    items: FiszkaItem[],
    target: 'activePage' | 'newPage' | 'replaceAll'
  ) => void;
  activePageIndex: number;
}

interface RecognizedLabel {
  id: string;
  name: string;
  dimension: string;
  scaleCode: string;
  refNumber: string;
  priceText: string;
}

export const EslScannerModal: React.FC<EslScannerModalProps> = ({
  isOpen,
  onClose,
  onApply,
  activePageIndex,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedLabel[]>([]);
  const [targetOption, setTargetOption] = useState<'activePage' | 'newPage' | 'replaceAll'>('activePage');

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera when closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setImagePreview(null);
      setErrorMsg(null);
      setRecognizedItems([]);
    }
  }, [isOpen]);

  // Clean camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle Ctrl+V paste from clipboard anywhere in modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setErrorMsg(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);

      // List video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoDevs);
      if (videoDevs.length > 0 && !deviceId) {
        setSelectedDeviceId(videoDevs[0].deviceId);
      }
    } catch (err: any) {
      console.error('Błąd dostępu do kamery:', err);
      setErrorMsg(
        'Brak dostępu do kamery. Upewnij się, że zezwoliłeś przeglądarce na dostęp lub skorzystaj z opcji wgrania zdjęcia.'
      );
      setIsCameraActive(false);
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImagePreview(dataUrl);
    stopCamera();
    runRecognition(dataUrl, 'image/jpeg');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleImageFile = (file: File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImagePreview(result);
        runRecognition(result, file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  };

  // Skanowanie i ekstrakcja danych przez Gemini API
  const runRecognition = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/scan-esl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType,
        }),
      });

      if (!response.ok) {
        // Fallback or server error
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Błąd serwera (${response.status})`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.items) && data.items.length > 0) {
        const formatted: RecognizedLabel[] = data.items.map((it: any, idx: number) => ({
          id: `scanned_${Date.now()}_${idx}`,
          name: it.name || 'Wkręt do drewna',
          dimension: it.dimension || '',
          scaleCode: it.scaleCode ? String(it.scaleCode).replace(/\D/g, '') : '',
          refNumber: it.refNumber ? String(it.refNumber).replace(/\D/g, '') : '',
          priceText: it.priceText || 'Cena',
        }));
        setRecognizedItems(formatted);
      } else {
        setErrorMsg('Nie wykryto czytelnych etykiet na tym zdjęciu. Spróbuj zrobić wyraźniejsze zdjęcie z bliska.');
      }
    } catch (err: any) {
      console.warn('Błąd wywołania API rozpoznawania:', err);
      // Jeśli jesteśmy na statycznym hostingu (np. GitHub Pages gdzie /api/scan-esl nie istnieje)
      setErrorMsg(
        err.message || 'Wystąpił błąd podczas analizy obrazu. Upewnij się, że zdjęcie jest ostre i dobrze oświetlone.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Wstawienie przykładowych etykiet ESL (do natychmiastowego testu)
  const handleLoadDemoEsl = (preset: 'single' | 'shelfStrip') => {
    setErrorMsg(null);
    setImagePreview(null);
    if (preset === 'single') {
      setRecognizedItems([
        {
          id: `demo_${Date.now()}_1`,
          name: 'Wkręt do drewna stożkowy',
          dimension: '4x40 mm',
          scaleCode: '247',
          refNumber: '42660256',
          priceText: '32,90 zł/kg',
        },
      ]);
    } else {
      // Cała listwa regałowa 4 etykiet
      setRecognizedItems([
        {
          id: `demo_${Date.now()}_1`,
          name: 'Wkręt do drewna stożkowy TX',
          dimension: '3.5x30 mm',
          scaleCode: '241',
          refNumber: '42660250',
          priceText: '34,90 zł/kg',
        },
        {
          id: `demo_${Date.now()}_2`,
          name: 'Wkręt do drewna stożkowy TX',
          dimension: '4x40 mm',
          scaleCode: '242',
          refNumber: '42660251',
          priceText: '34,90 zł/kg',
        },
        {
          id: `demo_${Date.now()}_3`,
          name: 'Wkręt do drewna stożkowy TX',
          dimension: '4.5x50 mm',
          scaleCode: '243',
          refNumber: '42660252',
          priceText: '34,90 zł/kg',
        },
        {
          id: `demo_${Date.now()}_4`,
          name: 'Wkręt do drewna stożkowy TX',
          dimension: '5x60 mm',
          scaleCode: '244',
          refNumber: '42660253',
          priceText: '34,90 zł/kg',
        },
      ]);
    }
  };

  const handleUpdateItem = (id: string, field: keyof RecognizedLabel, value: string) => {
    setRecognizedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleRemoveItem = (id: string) => {
    setRecognizedItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddItem = () => {
    setRecognizedItems((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: prev[prev.length - 1]?.name || 'Wkręt do drewna',
        dimension: '',
        scaleCode: '',
        refNumber: '',
        priceText: 'Cena',
      },
    ]);
  };

  const handleConfirmApply = () => {
    if (recognizedItems.length === 0) return;
    const finalItems: FiszkaItem[] = recognizedItems.map((r) => ({
      id: r.id,
      name: r.name.trim() || 'Wkręt do drewna',
      dimension: r.dimension.trim(),
      scaleCode: r.scaleCode.trim(),
      refNumber: r.refNumber.trim(),
      priceText: r.priceText.trim() || 'Cena',
    }));

    onApply(finalItems, targetOption);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* NAGŁÓWEK MODALA */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Camera className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base leading-tight">
                  Skaner etykiet regałowych ESL & Foto (AI)
                </h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Gemini Vision
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Zrób zdjęcie etykiety elektronicznej (ESL) lub papierowej — AI odczyta nazwę, wymiar, kod wagi i nr ref
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ZAWARTOŚĆ GŁÓWNA */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* PRZEŁĄCZNIK ZAKŁADEK ŹRÓDŁA */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => {
                  stopCamera();
                  setActiveTab('upload');
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'upload'
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Wgraj / Wklej zdjęcie</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('camera');
                  startCamera();
                }}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'camera'
                    ? 'bg-white text-emerald-800 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Użyj kamery / aparatu</span>
              </button>
            </div>

            {/* Szybkie przykłady demo */}
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[11px] text-slate-500 font-medium">Testuj na przykładzie:</span>
              <button
                onClick={() => handleLoadDemoEsl('single')}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Wstaw przykładową 1 etykietę ESL"
              >
                1 etykieta
              </button>
              <button
                onClick={() => handleLoadDemoEsl('shelfStrip')}
                className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                title="Wstaw przykładową listwę 4 etykiet z regału"
              >
                Listwa 4 etykiet
              </button>
            </div>
          </div>

          {/* OBSZAR KAMERY LUB UPLOADU */}
          {activeTab === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/70 hover:bg-emerald-50/20 transition-all cursor-pointer relative"
              onClick={() => document.getElementById('esl-file-input')?.click()}
            >
              <input
                id="esl-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-xs">
                <ImageIcon className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800 mb-1">
                Przeciągnij zdjęcie etykiety lub kliknij, aby wybrać z dysku
              </h4>
              <p className="text-xs text-slate-500 max-w-md">
                Możesz także wcisnąć <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px]">Ctrl + V</kbd> aby wkleić zrzut ekranu lub skopiowane zdjęcie ze schowka
              </p>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="flex flex-col items-center gap-3 bg-slate-900 rounded-2xl p-3 border border-slate-800">
              <div className="relative w-full max-w-lg aspect-4/3 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Siatka pomocnicza celownika etykiety ESL */}
                <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between items-center text-[11px] text-emerald-300 bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded">
                    <span>Etykieta ESL / Kod wagi</span>
                    <span>19.5 x 4 cm</span>
                  </div>
                  <div className="text-center text-[10px] text-emerald-200 bg-black/50 backdrop-blur-xs py-0.5 px-2 rounded self-center">
                    Umieść etykietę w kadrze i zrób zdjęcie
                  </div>
                </div>
              </div>

              {/* Przyciski kontroli kamery */}
              <div className="flex items-center gap-3">
                {availableDevices.length > 1 && (
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => {
                      setSelectedDeviceId(e.target.value);
                      startCamera(e.target.value);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-800 text-slate-200 border border-slate-700 rounded-lg cursor-pointer"
                  >
                    {availableDevices.map((dev, idx) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Kamera ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={captureCameraPhoto}
                  disabled={!isCameraActive || isScanning}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Zrób zdjęcie i odczytaj</span>
                </button>
              </div>
            </div>
          )}

          {/* STATUS SKANOWANIA / PODGLĄD ZDJĘCIA */}
          {isScanning && (
            <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <div className="text-xs">
                <span className="font-bold text-emerald-950 block">AI analizuje etykietę sklepową...</span>
                <span className="text-emerald-700">Wykrywanie nazwy, wymiaru, kodu wagi oraz numeru ref.</span>
              </div>
            </div>
          )}

          {/* KOMUNIKAT BŁĘDU */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Informacja:</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* TABELA ROZPOZNANYCH DANYCH */}
          {recognizedItems.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Rozpoznane etykiety ({recognizedItems.length})
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    Możesz poprawić dane przed wstawieniem
                  </span>
                </div>

                <button
                  onClick={handleAddItem}
                  className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Dodaj wiersz</span>
                </button>
              </div>

              {/* Tabela pól z możliwością bezpośredniej edycji */}
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3">Nazwa artykułu</th>
                      <th className="py-2 px-3 w-28">Wymiar</th>
                      <th className="py-2 px-3 w-24">Kod wagi</th>
                      <th className="py-2 px-3 w-28">Nr ref (LM)</th>
                      <th className="py-2 px-3 w-24">Cena</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recognizedItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 focus:border-emerald-500 focus:bg-emerald-50/20 text-xs font-medium text-slate-800"
                            placeholder="np. Wkręt do drewna"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.dimension}
                            onChange={(e) => handleUpdateItem(item.id, 'dimension', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 focus:border-emerald-500 focus:bg-emerald-50/20 text-xs font-bold text-slate-900"
                            placeholder="np. 4x40 mm"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.scaleCode}
                            onChange={(e) => handleUpdateItem(item.id, 'scaleCode', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-emerald-300 bg-emerald-50/50 text-emerald-950 font-black text-xs text-center"
                            placeholder="247"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.refNumber}
                            onChange={(e) => handleUpdateItem(item.id, 'refNumber', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 text-slate-700 text-xs font-mono"
                            placeholder="42660256"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.priceText}
                            onChange={(e) => handleUpdateItem(item.id, 'priceText', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-200 text-slate-700 text-xs"
                            placeholder="Cena"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                            title="Usuń tę pozycję"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* OPCJE MIEJSCA WSTAWIENIA */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-slate-500" />
                  Gdzie wstawić rozpoznane fiszki?
                </span>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'activePage'}
                      onChange={() => setTargetOption('activePage')}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>Do strony {activePageIndex + 1}</span>
                  </label>

                  <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'newPage'}
                      onChange={() => setTargetOption('newPage')}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>Jako nową stronę A4</span>
                  </label>

                  <label className="flex items-center gap-1 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'replaceAll'}
                      onChange={() => setTargetOption('replaceAll')}
                      className="accent-emerald-600 cursor-pointer"
                    />
                    <span>Zastąp wszystkie</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STOPKA MODALA Z PRZYCISKAMI */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          <button
            onClick={handleConfirmApply}
            disabled={recognizedItems.length === 0}
            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              recognizedItems.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              Wstaw fiszki ({recognizedItems.length})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
