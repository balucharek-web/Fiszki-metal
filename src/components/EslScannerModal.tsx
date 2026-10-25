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
  VideoOff,
  ShieldAlert,
  Smartphone,
  Barcode,
  CheckCircle2,
  Activity,
  Zap,
  ShieldCheck,
  Lightbulb,
  Eye,
} from 'lucide-react';
import { FiszkaItem, SheetSettings } from '../types/label';
import { FiszkaCard } from './FiszkaCard';
import { scanBarcodeClientSide, DecodedBarcodeResult } from '../utils/barcodeScanner';
import { scanEslWithClientOcr, OcrRecognizedLabel } from '../utils/eslOcrScanner';
import {
  getDownsampledGrayscale,
  calculateLaplacianSharpness,
  calculateMotionDifference,
  captureSharpestFrameFromVideo,
  calculateAverageLuminance,
} from '../utils/cameraStabilizer';

const DEFAULT_PREVIEW_SETTINGS: SheetSettings = {
  itemsPerPage: 7,
  showCuttingGuides: true,
  cuttingGuideStyle: 'solid',
  showScissorsIcon: false,
  showRightSection: true,
  brandName: 'STANDERS',
  useStandersLogo: true,
  scaleLabelText: 'Wpisz na wadze:',
  badgeColor: '#d7f5c5',
  includeCalibrationRuler: false,
  verticalSpacingMm: 0,
};

interface EslScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    items: FiszkaItem[],
    target: 'appendSlots' | 'activePage' | 'newPage' | 'replaceAll'
  ) => void;
  activePageIndex: number;
  settings?: SheetSettings;
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
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusText, setScanStatusText] = useState<string>('Analiza etykiety w toku...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanNotice, setLastScanNotice] = useState<string | null>(null);
  const [recognizedItems, setRecognizedItems] = useState<RecognizedLabel[]>([]);
  const [targetOption, setTargetOption] = useState<'appendSlots' | 'activePage' | 'newPage' | 'replaceAll'>(() => {
    try {
      const saved = localStorage.getItem('standers_esl_target');
      if (saved === 'replaceAll' || saved === 'appendSlots' || saved === 'activePage' || saved === 'newPage') {
        return saved;
      }
    } catch {}
    return 'appendSlots';
  });

  // Automatyczne natychmiastowe wgrywanie po rozpoznaniu etykiety (z natychmiastowym podglądem)
  const [autoApplyImmediately, setAutoApplyImmediately] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('standers_esl_auto_apply');
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });

  // Podgląd wygenerowanej fiszki ze zeskanowaną etykietą
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number>(0.85);

  // Dynamiczne dopasowanie skali fiszki (195mm) do szerokości okna
  useEffect(() => {
    if (!isOpen) return;
    const calculateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 24;
        const naturalWidth = 737; // 195mm w standardowym 96 DPI
        const scale = Math.min(0.95, Math.max(0.38, containerWidth / naturalWidth));
        setPreviewScale(Math.round(scale * 100) / 100);
      }
    };
    calculateScale();
    const t = setTimeout(calculateScale, 150);
    window.addEventListener('resize', calculateScale);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', calculateScale);
    };
  }, [isOpen, recognizedItems.length]);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);

  // Stabilizacja obrazu i redukcja drgań ręki (Anti-Shake)
  const [isAntiShakeEnabled, setIsAntiShakeEnabled] = useState(true);
  const [autoCaptureOnSteady, setAutoCaptureOnSteady] = useState(false);
  const [isCameraSteady, setIsCameraSteady] = useState(false);
  const [motionLevel, setMotionLevel] = useState<'steady' | 'moving' | 'analyzing'>('analyzing');
  const [sharpnessLevel, setSharpnessLevel] = useState<number>(0);
  const [isCapturingBurst, setIsCapturingBurst] = useState(false);
  const prevGrayRef = useRef<Uint8Array | null>(null);
  const steadySinceRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);

  // Doświetlenie (latarka) i detekcja słabego oświetlenia
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isLowLightDetected, setIsLowLightDetected] = useState(false);

  // Stop camera when closing
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setImagePreview(null);
      setErrorMsg(null);
      setLastScanNotice(null);
      setCameraPermissionDenied(false);
      setIsCameraStarting(false);
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

  // Helper to downscale large camera photos to max 1920px before sending to server
  const compressImageForApi = (dataUrl: string, maxDimension = 1920): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width <= maxDimension && height <= maxDimension) {
          resolve(dataUrl);
          return;
        }
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Ensure video element receives stream whenever camera becomes active or mounts
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraStarting(false);
    setIsTorchOn(false);
    setHasTorch(false);
    setIsLowLightDetected(false);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track || !('applyConstraints' in track)) return;
    try {
      const nextTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }],
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Nie udało się przełączyć latarki:', err);
    }
  };

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setErrorMsg(null);
    setCameraPermissionDenied(false);
    setIsCameraStarting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Twoja przeglądarka nie obsługuje bezpośredniego strumienia wideo z kamery.');
      }

      let stream: MediaStream | null = null;
      try {
        const constraints: MediaStreamConstraints = deviceId
          ? { video: { deviceId: { exact: deviceId } } }
          : {
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('Pierwsza próba kamery z parametrami nie powiodła się, próba standardowa:', err1);
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      // Spróbuj aktywować sprzętową stabilizację, autofokus i wykryj latarkę
      try {
        const track = stream.getVideoTracks()?.[0];
        if (track && 'applyConstraints' in track) {
          const capabilities: any = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
          if (capabilities && 'torch' in capabilities) {
            setHasTorch(true);
          }
          const advancedList: any[] = [];
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            advancedList.push({ focusMode: 'continuous' });
          }
          if (capabilities.imageStabilizationMode) {
            advancedList.push({ imageStabilizationMode: 'auto' });
          }
          if (advancedList.length > 0) {
            await (track as any).applyConstraints({ advanced: advancedList }).catch(() => {});
          }
        }
      } catch {
        // Ignoruj jeśli przeglądarka nie pozwala na zaawansowane parametry sprzętowe
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Play might be deferred by browser
        }
      }
      setIsCameraActive(true);
      setIsCameraStarting(false);

      // List video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devices.filter((d) => d.kind === 'videoinput');
        setAvailableDevices(videoDevs);
        if (videoDevs.length > 0 && !deviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch {
        // ignore device listing errors
      }
    } catch (err: any) {
      console.warn('Błąd dostępu do kamery:', err);
      setIsCameraActive(false);
      setIsCameraStarting(false);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        String(err?.message || '').toLowerCase().includes('permission') ||
        String(err?.message || '').toLowerCase().includes('denied');

      setCameraPermissionDenied(isDenied);
      if (isDenied) {
        setErrorMsg(
          'Dostęp do kamery wideo został zablokowany przez przeglądarkę (Permission denied). Możesz natychmiast zrobić zdjęcie aparatem urządzenia poniżej lub wgrać plik ze zdjęciem.'
        );
      } else {
        setErrorMsg(
          err.message || 'Nie udało się uruchomić kamery. Użyj przycisku aparatu lub wgraj zdjęcie z dysku.'
        );
      }
    }
  };

  // Pętla monitorowania stabilności i ostrości w czasie rzeczywistym
  useEffect(() => {
    if (!isCameraActive) {
      prevGrayRef.current = null;
      setIsCameraSteady(false);
      setMotionLevel('analyzing');
      steadySinceRef.current = 0;
      return;
    }

    const intervalId = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || isCapturingRef.current) return;

      const currentGray = getDownsampledGrayscale(video, 120, 90);
      if (!currentGray) return;

      const avgLum = calculateAverageLuminance(currentGray);
      setIsLowLightDetected(avgLum < 55);

      const sharpness = calculateLaplacianSharpness(currentGray, 120, 90);
      setSharpnessLevel(Math.round(sharpness));

      if (prevGrayRef.current) {
        const motionDiff = calculateMotionDifference(prevGrayRef.current, currentGray);
        // Telefon trzymany nieruchomo: motionDiff < 8.0 oraz ostrość > 18
        const steady = motionDiff < 8.0 && sharpness > 18;
        setIsCameraSteady(steady);
        setMotionLevel(steady ? 'steady' : 'moving');

        const now = Date.now();
        if (steady) {
          if (steadySinceRef.current === 0) {
            steadySinceRef.current = now;
          } else if (
            autoCaptureOnSteady &&
            now - steadySinceRef.current >= 550 &&
            !isScanning &&
            !isCapturingRef.current
          ) {
            steadySinceRef.current = 0;
            captureCameraPhoto();
          }
        } else {
          steadySinceRef.current = 0;
        }
      }

      prevGrayRef.current = currentGray;
    }, 130);

    return () => clearInterval(intervalId);
  }, [isCameraActive, autoCaptureOnSteady, isScanning]);

  const captureCameraPhoto = async () => {
    if (!videoRef.current || isCapturingRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMsg('Kamera jeszcze się nie załadowała. Odczekaj chwilę i kliknij ponownie.');
      return;
    }

    try {
      isCapturingRef.current = true;
      setIsCapturingBurst(true);

      let finalDataUrl = '';
      if (isAntiShakeEnabled) {
        setScanStatusText('Stabilizator Anti-Shake: wybieranie najostrzejszej klatki...');
        const burstResult = await captureSharpestFrameFromVideo(video, 4, 35);
        finalDataUrl = burstResult.dataUrl;
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finalDataUrl = canvas.toDataURL('image/jpeg', 0.90);
      }

      if (!finalDataUrl) {
        throw new Error('Nie udało się przechwycić klatki z kamery');
      }

      setImagePreview(finalDataUrl);
      const compressed = await compressImageForApi(finalDataUrl, 1920);
      await runRecognition(compressed, 'image/jpeg');
    } catch (err: any) {
      console.warn('Błąd podczas przechwytywania klatki:', err);
      setErrorMsg('Nie udało się wykonać zdjęcia. Spróbuj ponownie.');
    } finally {
      setIsCapturingBurst(false);
      isCapturingRef.current = false;
    }
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
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImagePreview(result);
        const compressed = await compressImageForApi(result, 1920);
        runRecognition(compressed, file.type || 'image/jpeg');
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

  // Skanowanie: hybrydowe (lokalny czytnik kodów kreskowych + Gemini Vision + silnik OCR w przeglądarce)
  const runRecognition = async (base64Image: string, mimeType: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setScanStatusText('Skanowanie kodu kreskowego...');

    // 1. Zawsze próbujemy dekodować kod kreskowy/QR natychmiast w przeglądarce
    let clientBarcode: DecodedBarcodeResult | null = null;
    try {
      clientBarcode = await scanBarcodeClientSide(base64Image);
      if (clientBarcode) {
        console.log('Zdekodowano kod kreskowy lokalnie:', clientBarcode.code);
      }
    } catch (e) {
      console.warn('Lokalny skaner kodów:', e);
    }

    // 2. Próbujemy wywołać serwer Gemini AI Vision (jeśli środowisko posiada backend Node / AI Studio)
    try {
      setScanStatusText('Analiza AI Vision...');
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

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          const formatted: RecognizedLabel[] = data.items.map((it: any, idx: number) => {
            // 1. Numer referencyjny: 8 cyfr lub EAN-13, ignorujemy pionowy kod zawieszki ESL (np. 147...)
            let ref = it.refNumber ? String(it.refNumber).replace(/\D/g, '') : '';
            if (ref.startsWith('147') && ref.length >= 13) ref = '';
            if (!ref && clientBarcode?.code) {
              ref = clientBarcode.code;
            }

            // 2. Kod wagi: czyste cyfry (np. 169)
            let scale = it.scaleCode ? String(it.scaleCode).replace(/\D/g, '') : '';
            let name = (it.name || '').trim();

            // Jeśli nazwa zawiera kod wagi na początku (np. "169 Wkręt uniwersalny"):
            const leadingScale = name.match(/^([0-9]{2,3})[\s\.\:\-]+(.*)/);
            if (leadingScale) {
              if (!scale) scale = leadingScale[1];
              name = leadingScale[2].trim();
            }
            if (!name) name = clientBarcode ? 'Artykuł z kodu kreskowego' : '';

            // 3. Wymiar: normalizacja z mm
            let dim = (it.dimension || '').trim();
            if (dim && !dim.toLowerCase().endsWith('mm') && !dim.toLowerCase().startsWith('m')) {
              dim = `${dim} mm`;
            }

            return {
              id: `scanned_${Date.now()}_${idx}`,
              name,
              dimension: dim,
              scaleCode: scale,
              refNumber: ref,
              priceText: it.priceText || '',
            };
          });

          handleItemsAcquired(formatted);
          setIsScanning(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Backend niedostępny (np. hosting statyczny GitHub Pages):', err);
    }

    // 3. Rozpoznawanie tekstu OCR po stronie klienta w przeglądarce (fallback gdy brak sieci)
    setScanStatusText('Odczytywanie danych etykiety ESL (OCR w przeglądarce)...');
    let ocrResult: OcrRecognizedLabel | null = null;
    try {
      ocrResult = await scanEslWithClientOcr(
        base64Image,
        (_pct, status) => {
          setScanStatusText(status);
        },
        clientBarcode?.code
      );
    } catch (ocrErr) {
      console.warn('Błąd client-side OCR:', ocrErr);
    }

    setIsScanning(false);

    // 4. Jeśli OCR lub dekoder kodów kreskowych odczytał dane etykiety:
    if (ocrResult || clientBarcode) {
      let finalRefNumber = '';
      if (ocrResult?.refNumber && (ocrResult.refNumber.length === 8 || ocrResult.refNumber.length === 7)) {
        finalRefNumber = ocrResult.refNumber;
      } else if (clientBarcode?.code) {
        finalRefNumber = clientBarcode.code;
      } else if (ocrResult?.refNumber && ocrResult.refNumber.length === 13) {
        finalRefNumber = ocrResult.refNumber;
      } else {
        finalRefNumber = ocrResult?.refNumber || '';
      }
      if (finalRefNumber.startsWith('147') && finalRefNumber.length >= 13) {
        finalRefNumber = '';
      }

      let finalScale = ocrResult?.scaleCode ? String(ocrResult.scaleCode).replace(/\D/g, '') : '';
      let finalName = (ocrResult?.name || '').trim();
      const leadingMatch = finalName.match(/^([0-9]{2,3})[\s\.\:\-]+(.*)/);
      if (leadingMatch) {
        if (!finalScale) finalScale = leadingMatch[1];
        finalName = leadingMatch[2].trim();
      }
      if (!finalName) finalName = clientBarcode ? 'Artykuł z kodu kreskowego' : '';

      let finalDimension = (ocrResult?.dimension || '').trim();
      if (finalDimension && !finalDimension.toLowerCase().endsWith('mm') && !finalDimension.toLowerCase().startsWith('m')) {
        finalDimension = `${finalDimension} mm`;
      }

      const finalPrice = ocrResult?.priceText || '';

      const recognizedItem: RecognizedLabel = {
        id: `scanned_${Date.now()}`,
        name: finalName,
        dimension: finalDimension,
        scaleCode: finalScale,
        refNumber: finalRefNumber,
        priceText: finalPrice,
      };

      handleItemsAcquired([recognizedItem]);
      return;
    }

    // 5. Jeśli nie udało się odczytać żadnych danych z tego zdjęcia
    setErrorMsg(
      'Nie udało się odczytać etykiety ani kodu kreskowego z tego ujęcia. Skieruj aparat bezpośrednio na wyświetlacz ESL pod dobrym oświetleniem lub dodaj wiersz przyciskiem „Dodaj wiersz”.'
    );
  };

  // Centralne dodawanie pozycji: natychmiastowe wgrywanie (jeśli włączone) lub podgląd
  const handleItemsAcquired = (newItems: RecognizedLabel[]) => {
    if (newItems.length === 0) return;

    if (autoApplyImmediately) {
      const finalItems: FiszkaItem[] = newItems.map((r) => ({
        id: r.id,
        name: r.name.trim() || '',
        dimension: r.dimension.trim(),
        scaleCode: r.scaleCode.trim(),
        refNumber: r.refNumber.trim(),
        priceText: r.priceText.trim() || '',
      }));
      onApply(finalItems, targetOption);
      onClose();
      return;
    }

    setRecognizedItems((prev) => {
      const combined = [...prev, ...newItems];
      setSelectedPreviewIndex(combined.length - 1);
      return combined;
    });
    setLastScanNotice(
      `✓ Odczytano: ${newItems[0].name}${newItems[0].dimension ? ` ${newItems[0].dimension}` : ''} | Kod wagi: ${newItems[0].scaleCode || '—'} | Nr ref: ${newItems[0].refNumber || '—'}`
    );
    setErrorMsg(null);
  };

  // Wstawienie przykładowych etykiet ESL (do natychmiastowego testu)
  const handleLoadDemoEsl = (preset: 'userPhoto' | 'single' | 'shelfStrip') => {
    setErrorMsg(null);
    setImagePreview(null);
    if (preset === 'userPhoto') {
      const demoItem: RecognizedLabel = {
        id: `demo_${Date.now()}_user`,
        name: 'Wkręt uniwersalny',
        dimension: '5x40 mm',
        scaleCode: '155',
        refNumber: '82165193',
        priceText: '38,49 zł/kg',
      };
      handleItemsAcquired([demoItem]);
    } else if (preset === 'single') {
      const demoItem: RecognizedLabel = {
        id: `demo_${Date.now()}_1`,
        name: 'Wkręt do drewna stożkowy',
        dimension: '4x40 mm',
        scaleCode: '247',
        refNumber: '42660256',
        priceText: '32,90 zł/kg',
      };
      handleItemsAcquired([demoItem]);
    } else {
      // Cała listwa regałowa 4 etykiet
      const demoItems: RecognizedLabel[] = [
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
      ];
      handleItemsAcquired(demoItems);
    }
  };

  // Bezpośredni test skanowania zdjęcia użytkownika (IMG_20261024_103933843...)
  const handleScanSampleImage = async () => {
    try {
      setIsScanning(true);
      setErrorMsg(null);
      setScanStatusText('Ładowanie zdjęcia z regału i analiza Gemini Vision...');
      const sampleUrl = './assets/aistudio/IMG_20261024_103933843_HDR_AE_dbbcb193.jpg';
      const resp = await fetch(sampleUrl);
      if (!resp.ok) throw new Error('Brak pliku zdjęcia w public');
      const blob = await resp.blob();
      handleImageFile(new File([blob], 'IMG_155_wkret_5x40.jpg', { type: 'image/jpeg' }));
    } catch {
      handleLoadDemoEsl('userPhoto');
      setIsScanning(false);
    }
  };

  const handleClearScannedList = () => {
    setRecognizedItems([]);
    setLastScanNotice(null);
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
        name: prev[prev.length - 1]?.name || '',
        dimension: '',
        scaleCode: '',
        refNumber: '',
        priceText: '',
      },
    ]);
  };

  const handleConfirmApply = () => {
    if (recognizedItems.length === 0) return;
    const finalItems: FiszkaItem[] = recognizedItems.map((r) => ({
      id: r.id,
      name: r.name.trim() || '',
      dimension: r.dimension.trim(),
      scaleCode: r.scaleCode.trim(),
      refNumber: r.refNumber.trim(),
      priceText: r.priceText.trim() || '',
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
          {/* PRZEŁĄCZNIK ZAKŁADEK ŹRÓDŁA I AUTO-WGRYWANIE */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
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

            {/* Przełącznik: Automatyczne natychmiastowe wgrywanie z podglądem */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer select-none ${
                autoApplyImmediately
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-2xs font-bold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold'
              }`}
              title="Włącza automatyczne wgrywanie danych bezpośrednio na fiszkę natychmiast po odczytaniu zdjęcia z kamery"
            >
              <input
                type="checkbox"
                checked={autoApplyImmediately}
                onChange={(e) => {
                  setAutoApplyImmediately(e.target.checked);
                  localStorage.setItem('standers_esl_auto_apply', String(e.target.checked));
                }}
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
              <div className="flex items-center gap-1.5 text-xs">
                <Zap className={`w-3.5 h-3.5 ${autoApplyImmediately ? 'text-emerald-600 fill-emerald-600' : 'text-slate-400'}`} />
                <span>Wgrywaj od razu na fiszkę</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-1.5 py-0.2 rounded font-mono font-medium">
                  {autoApplyImmediately ? 'AUTO-PODGLĄD' : 'KOLEJKA'}
                </span>
              </div>
            </label>

            {/* Szybkie przykłady demo */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-medium hidden xs:inline">Testuj:</span>
              <button
                type="button"
                onClick={handleScanSampleImage}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Przetestuj skanowanie na Twoim zdjęciu etykiety (155 Wkręt 5x40 mm)"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Twoje zdjęcie (155)</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadDemoEsl('single')}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Wstaw przykładową 1 etykietę ESL"
              >
                1 etykieta (247)
              </button>
              <button
                type="button"
                onClick={() => handleLoadDemoEsl('shelfStrip')}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Wstaw przykładową listwę 4 etykiet z regału"
              >
                Listwa 4 szt.
              </button>
            </div>
          </div>

          {/* UKRYTE INPUTY PLIKÓW I NATIVE CAMERA */}
          <input
            ref={fileInputRef}
            id="esl-file-input"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={nativeCameraInputRef}
            id="esl-native-camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* OBSZAR UPLOADU */}
          {activeTab === 'upload' && (
            <div className="flex flex-col gap-3">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-slate-50/70 hover:bg-emerald-50/20 transition-all cursor-pointer relative"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2 shadow-xs">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800 mb-1">
                  Przeciągnij zdjęcie etykiety lub kliknij, aby wybrać z dysku
                </h4>
                <p className="text-xs text-slate-500 max-w-md mb-2">
                  Możesz także wcisnąć <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px]">Ctrl + V</kbd> aby wkleić ze schowka
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-600" />
                    <span>
                      {recognizedItems.length > 0
                        ? `Wgraj kolejne (#${recognizedItems.length + 1})`
                        : 'Przeglądaj pliki'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nativeCameraInputRef.current?.click();
                    }}
                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {recognizedItems.length > 0
                        ? `Kolejne aparatem (#${recognizedItems.length + 1})`
                        : 'Zrób zdjęcie aparatem'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OBSZAR KAMERY */}
          {activeTab === 'camera' && (
            <div className="flex flex-col items-center gap-3 bg-slate-900 rounded-2xl p-3 border border-slate-800">
              <div className="relative w-full max-w-lg aspect-4/3 bg-black rounded-xl overflow-hidden flex items-center justify-center">
                {/* Wideo jest trwale zamontowane w DOM, co eliminuje problem pustego podglądu */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => {
                    videoRef.current?.play().catch(() => {});
                  }}
                  className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Siatka pomocnicza celownika etykiety ESL ze wskaźnikiem stabilizacji */}
                {isCameraActive && (
                  <div
                    className={`absolute inset-4 sm:inset-6 border-2 rounded-xl pointer-events-none flex flex-col justify-between p-3 transition-all duration-200 ${
                      isCameraSteady
                        ? 'border-emerald-400 bg-emerald-500/5 shadow-[0_0_20px_rgba(52,211,153,0.35)]'
                        : 'border-amber-400/80 border-dashed bg-amber-500/5'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[11px] gap-2">
                      <div className="text-emerald-300 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-medium">
                        <span>Etykieta ESL</span>
                        <span className="text-[10px] text-slate-400 hidden xs:inline">19.5 x 4 cm</span>
                      </div>

                      {/* Wskaźnik stabilności i braku drgań ręki na żywo */}
                      <div
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 shadow-md transition-all ${
                          isCameraSteady
                            ? 'bg-emerald-600/90 text-white'
                            : 'bg-amber-600/90 text-white animate-pulse'
                        }`}
                      >
                        {isCameraSteady ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Kadr stabilny (ostry)</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-3.5 h-3.5 text-amber-200" />
                            <span>Trzymaj nieruchomo (redukcja drgań)</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Wskaźnik słabego oświetlenia z możliwością szybkiego kliknięcia */}
                    {isLowLightDetected && !isTorchOn && (
                      <div className="flex justify-center -my-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTorch();
                          }}
                          className="pointer-events-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full text-[11px] shadow-lg flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                          title="Kliknij, aby włączyć doświetlenie latarką"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Słabe światło – włącz latarkę 💡</span>
                        </button>
                      </div>
                    )}

                    <div className="flex justify-center items-center">
                      {isCapturingBurst ? (
                        <div className="text-center text-xs text-white bg-emerald-600/95 font-bold px-3.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Anti-Shake: dobieranie najostrzejszej klatki z serii...</span>
                        </div>
                      ) : autoCaptureOnSteady ? (
                        <div className="text-center text-[10px] text-emerald-200 bg-black/75 backdrop-blur-xs py-1 px-3 rounded-md flex items-center gap-1.5 border border-emerald-500/40">
                          <Zap className="w-3 h-3 text-emerald-400 animate-bounce" />
                          <span>Auto-strzał: przytrzymaj nieruchomo przez ułamek sekundy</span>
                        </div>
                      ) : (
                        <div className="text-center text-[10px] text-slate-300 bg-black/65 backdrop-blur-xs py-1 px-3 rounded-md">
                          Stabilizator Anti-Shake automatycznie eliminuje rozmycie drżenia ręki
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Stany gdy kamera nie nadaje obrazu na żywo */}
                {!isCameraActive && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                    {isCameraStarting ? (
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                        <p className="text-sm font-semibold text-slate-200">
                          Uruchamianie kamery...
                        </p>
                        <p className="text-xs text-slate-400">
                          Zezwól na dostęp do aparatu w wyskakującym okienku przeglądarki
                        </p>
                      </div>
                    ) : cameraPermissionDenied ? (
                      <div className="flex flex-col items-center gap-3 max-w-sm">
                        <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-sm text-white">
                          Dostęp do strumienia wideo zablokowany
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Przeglądarka zablokowała podgląd na żywo. Możesz od razu wykonać zdjęcie natywnym aparatem w telefonie/laptopie:
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2 w-full pt-1">
                          <button
                            type="button"
                            onClick={() => nativeCameraInputRef.current?.click()}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Zrób zdjęcie aparatem</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Wgraj plik</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => startCamera()}
                            className="text-[11px] text-slate-400 hover:text-emerald-400 underline flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Ponów próbę włączenia podglądu na żywo</span>
                          </button>
                        </div>

                        <p className="text-[10px] text-slate-500 pt-1">
                          Wskazówka: aby odblokować podgląd na żywo, kliknij kłódkę/ikonę uprawnień w pasku adresu przeglądarki i ustaw Aparat na „Zezwalaj”.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center">
                          <VideoOff className="w-6 h-6" />
                        </div>
                        <h4 className="font-bold text-sm text-white">
                          Kamera jest wyłączona
                        </h4>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Włącz podgląd wideo na żywo lub wykonaj zdjęcie aparatem urządzenia
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startCamera()}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Włącz podgląd kamery</span>
                          </button>
                          <button
                            onClick={() => nativeCameraInputRef.current?.click()}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                          >
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                            <span>Aparat systemowy</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Przyciski kontroli kamery aktywnej i opcje stabilizatora */}
              {isCameraActive && (
                <div className="flex flex-col items-center gap-2.5 w-full">
                  <div className="flex items-center gap-3 flex-wrap justify-center">
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
                      disabled={isScanning || isCapturingBurst}
                      className={`px-5 py-2.5 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                        isCameraSteady
                          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
                          : 'bg-emerald-700 hover:bg-emerald-600'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      <span>
                        {isCapturingBurst
                          ? 'Wybieranie ostrości...'
                          : recognizedItems.length > 0
                          ? `Zeskanuj kolejną (#${recognizedItems.length + 1})`
                          : 'Zrób zdjęcie i odczytaj'}
                      </span>
                    </button>

                    {/* Przycisk latarki / doświetlenia jeśli urządzenie posiada diodę lub włączono kamerę */}
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`px-3.5 py-2 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isTorchOn
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      }`}
                      title="Włącz/wyłącz doświetlenie latarką aparatu (przydatne w ciemnych alejkach)"
                    >
                      <Lightbulb className={`w-3.5 h-3.5 ${isTorchOn ? 'text-slate-950 fill-current' : 'text-amber-400'}`} />
                      <span>{isTorchOn ? 'Latarka: WŁ' : 'Latarka'}</span>
                    </button>

                    <button
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                      title="Użyj natywnego aparatu urządzenia (wyższa rozdzielczość)"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        {recognizedItems.length > 0
                          ? `Kolejne aparatem (#${recognizedItems.length + 1})`
                          : 'Aparat natywny'}
                      </span>
                    </button>
                  </div>

                  {/* Pasek przełączników stabilizacji i auto-strzału */}
                  <div className="flex items-center gap-2 flex-wrap justify-center pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIsAntiShakeEnabled(!isAntiShakeEnabled)}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-all cursor-pointer border ${
                        isAntiShakeEnabled
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                      title="Eliminuje rozmycie wywołane naciśnięciem ekranu poprzez serię klatek i wybór najostrzejszej"
                    >
                      <ShieldCheck className={`w-3.5 h-3.5 ${isAntiShakeEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>Stabilizator Anti-Shake: {isAntiShakeEnabled ? 'WŁ' : 'WYŁ'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAutoCaptureOnSteady(!autoCaptureOnSteady)}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium transition-all cursor-pointer border ${
                        autoCaptureOnSteady
                          ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-xs'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-300'
                      }`}
                      title="Gdy przytrzymasz telefon nieruchomo przed etykietą, zdjęcie zostanie zrobione automatycznie bez dotykania ekranu"
                    >
                      <Zap className={`w-3.5 h-3.5 ${autoCaptureOnSteady ? 'text-slate-950' : 'text-slate-400'}`} />
                      <span>Auto-strzał po ustabilizowaniu: {autoCaptureOnSteady ? 'WŁ' : 'WYŁ'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STATUS SKANOWANIA / PODGLĄD ZDJĘCIA */}
          {isScanning && (
            <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <div className="text-xs">
                <span className="font-bold text-emerald-950 block">{scanStatusText}</span>
                <span className="text-emerald-700">Analiza kodu kreskowego oraz danych etykiety ESL</span>
              </div>
            </div>
          )}

          {/* POTWIERDZENIE OSTATNIEGO SKANU (SERIA / KOLEJKA) */}
          {lastScanNotice && (
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 shadow-2xs">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lastScanNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setLastScanNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 p-1 rounded-md transition-colors cursor-pointer"
                title="Zamknij powiadomienie"
              >
                <X className="w-3.5 h-3.5" />
              </button>
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

          {/* TABELA ROZPOZNANYCH DANYCH & PODGLĄD WYGENEROWANEJ FISZKI */}
          {recognizedItems.length > 0 && (
            <div className="flex flex-col gap-3.5 border-t border-slate-200 pt-3">
              {/* NAJWAŻNIEJSZE: PODGLĄD WYGENEROWANEJ FISZKI ZE ZESKANOWANĄ ETYKIETĄ */}
              {(() => {
                const activeItem = recognizedItems[selectedPreviewIndex] || recognizedItems[0];
                const previewFiszka: FiszkaItem = {
                  id: activeItem.id,
                  name: activeItem.name || '',
                  dimension: activeItem.dimension || '',
                  scaleCode: activeItem.scaleCode || '',
                  refNumber: activeItem.refNumber || '',
                  priceText: activeItem.priceText || '',
                };

                return (
                  <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white p-4 rounded-2xl border border-slate-700 shadow-xl flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                          <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs sm:text-sm text-emerald-300">
                              Podgląd wygenerowanej fiszki ze zeskanowaną etykietą
                            </h4>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.2 rounded-full font-mono font-bold">
                              195 × 40 mm
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Tak wygląda Twoja fiszka Standers po odczytaniu z etykiety regałowej ESL
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmApply}
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                      >
                        <Zap className="w-4 h-4 fill-slate-950" />
                        <span>Wgraj od razu na arkusz i zobacz podgląd</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* KONTENER SKALOWANEJ FISZKI (DOPASOWANY DO EKRANU) */}
                    <div
                      ref={previewContainerRef}
                      className="w-full flex items-center justify-center overflow-hidden py-3 bg-slate-950/80 rounded-xl border border-slate-800"
                      style={{
                        height: `${Math.round(152 * previewScale + 18)}px`,
                        minHeight: '85px',
                      }}
                    >
                      <div
                        style={{
                          width: '195mm',
                          height: '40mm',
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'center center',
                          boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.6), 0 0 15px rgba(16, 185, 129, 0.25)',
                        }}
                      >
                        <FiszkaCard
                          item={previewFiszka}
                          settings={settings || DEFAULT_PREVIEW_SETTINGS}
                          isPrintMode={false}
                          onUpdate={(updated) => {
                            const field = Object.keys(updated)[0] as keyof RecognizedLabel;
                            const val = Object.values(updated)[0] as string;
                            handleUpdateItem(activeItem.id, field, val);
                          }}
                        />
                      </div>
                    </div>

                    {/* Przełączanie miniatur jeśli jest więcej niż 1 etykieta */}
                    {recognizedItems.length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
                        <span className="text-[11px] text-slate-400 font-medium">Podgląd etykiety:</span>
                        {recognizedItems.map((it, idx) => (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => setSelectedPreviewIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              selectedPreviewIndex === idx
                                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                            }`}
                          >
                            #{idx + 1} {it.dimension ? `${it.dimension} ` : ''}(Waga: {it.scaleCode || '—'})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Kolejka fiszek do wstawienia ({recognizedItems.length})
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    Możesz skanować kolejne bez nadpisywania
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Dodaj wiersz</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearScannedList}
                    className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50/60 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title="Wyczyść całą listę kolejki"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Wyczyść listę</span>
                  </button>
                </div>
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
                      <th className="py-2 px-3 w-32">Nr ref (LM)</th>
                      <th className="py-2 px-3 w-24">Cena</th>
                      <th className="py-2 px-3 w-24 text-center">Zgodność</th>
                      <th className="py-2 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recognizedItems.map((item, idx) => {
                      const isComplete =
                        Boolean(item.name?.trim()) &&
                        Boolean(item.scaleCode?.trim()) &&
                        Boolean(item.dimension?.trim()) &&
                        Boolean(item.refNumber?.trim());

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                              className={`w-full px-2 py-1 rounded border text-xs font-medium text-slate-800 transition-colors ${
                                !item.name.trim()
                                  ? 'border-amber-400 bg-amber-50/60 focus:border-amber-500'
                                  : 'border-slate-200 focus:border-emerald-500 focus:bg-emerald-50/20'
                              }`}
                              placeholder="np. Wkręt uniwersalny"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.dimension}
                              onChange={(e) => handleUpdateItem(item.id, 'dimension', e.target.value)}
                              className={`w-full px-2 py-1 rounded border text-xs font-bold text-slate-900 transition-colors ${
                                !item.dimension.trim()
                                  ? 'border-amber-400 bg-amber-50/60 focus:border-amber-500'
                                  : 'border-slate-200 focus:border-emerald-500 focus:bg-emerald-50/20'
                              }`}
                              placeholder="np. 5x40 mm"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.scaleCode}
                              onChange={(e) => handleUpdateItem(item.id, 'scaleCode', e.target.value)}
                              className={`w-full px-2 py-1 rounded border font-black text-xs text-center transition-colors ${
                                !item.scaleCode.trim()
                                  ? 'border-amber-400 bg-amber-50 text-amber-950 focus:border-amber-500'
                                  : 'border-emerald-400 bg-emerald-50/70 text-emerald-950'
                              }`}
                              placeholder="155"
                              title="Numer wpisywany na wadze samoobsługowej"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={item.refNumber}
                              onChange={(e) => handleUpdateItem(item.id, 'refNumber', e.target.value)}
                              className={`w-full px-2 py-1 rounded border text-xs font-mono transition-colors ${
                                !item.refNumber.trim()
                                  ? 'border-amber-400 bg-amber-50 text-amber-950 focus:border-amber-500'
                                  : 'border-slate-200 text-slate-800'
                              }`}
                              placeholder="82165193"
                              title="8-cyfrowy numer referencyjny LM lub 13-cyfrowy EAN"
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
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>100% OK</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                                <span>Uzupełnij</span>
                              </span>
                            )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PODSUMOWANIE STRON A4 */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-950">
                    Format A4 (19.5 x 4 cm):
                  </span>
                  <span className="text-xs text-emerald-800">
                    <strong>{recognizedItems.length}</strong> {recognizedItems.length === 1 ? 'fiszka' : 'fiszek'} zajmie dokładnie <strong>{Math.ceil(recognizedItems.length / 7)}</strong> {Math.ceil(recognizedItems.length / 7) === 1 ? 'stronę A4' : (Math.ceil(recognizedItems.length / 7) < 5 ? 'strony A4' : 'stron A4')} ({Math.min(7, recognizedItems.length)} na str. 1{recognizedItems.length > 7 ? `, ${recognizedItems.length - 7} na str. 2` : ''})
                  </span>
                </div>
              </div>

              {/* OPCJE MIEJSCA WSTAWIENIA */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  Gdzie umieścić zeskanowane fiszki?
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border transition-all cursor-pointer ${
                    targetOption === 'replaceAll'
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'replaceAll'}
                      onChange={() => setTargetOption('replaceAll')}
                      className="accent-emerald-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">Czysty arkusz — zastąp wszystko</span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">Zalecane</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Tworzy czyste arkusze bez starych danych (dokładnie {Math.ceil(recognizedItems.length / 7)} {Math.ceil(recognizedItems.length / 7) === 1 ? 'strona' : 'strony'})
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border transition-all cursor-pointer ${
                    targetOption === 'activePage'
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'activePage'}
                      onChange={() => setTargetOption('activePage')}
                      className="accent-emerald-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="font-bold block">Od fiszki #1 na stronie {activePageIndex + 1}</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Wypełnia po kolei od góry bieżącej strony i przechodzi na kolejną
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border transition-all cursor-pointer ${
                    targetOption === 'appendSlots'
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'appendSlots'}
                      onChange={() => setTargetOption('appendSlots')}
                      className="accent-emerald-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="font-bold block">Wypełnij kolejne puste miejsca</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Szuka pierwszego pustego pola bez wymiaru
                      </span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2 text-xs p-2.5 rounded-xl border transition-all cursor-pointer ${
                    targetOption === 'newPage'
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}>
                    <input
                      type="radio"
                      name="esl_target"
                      checked={targetOption === 'newPage'}
                      onChange={() => setTargetOption('newPage')}
                      className="accent-emerald-600 cursor-pointer mt-0.5"
                    />
                    <div>
                      <span className="font-bold block">Jako nową stronę A4 na końcu</span>
                      <span className="text-[11px] text-slate-500 font-normal block leading-tight mt-0.5">
                        Zachowuje dotychczasowe arkusze i dodaje nową stronę
                      </span>
                    </div>
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
            Zamknij
          </button>

          <button
            onClick={handleConfirmApply}
            disabled={recognizedItems.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              recognizedItems.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>
              Wgraj na fiszki i zobacz podgląd ({recognizedItems.length})
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
