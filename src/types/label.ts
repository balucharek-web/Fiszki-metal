export interface FiszkaItem {
  id: string;
  name: string;        // np. "Wkręt do drewna"
  dimension: string;   // np. "6x80 mm"
  scaleCode: string;   // np. "247"
  refNumber?: string;  // np. "42660256"
  priceText?: string;  // np. "Cena" lub "12,90 zł"
}

export type CuttingGuideStyle = 'dashed' | 'solid' | 'cropmarks' | 'none';

export interface SheetSettings {
  itemsPerPage: 6 | 7;
  showCuttingGuides: boolean;
  cuttingGuideStyle: CuttingGuideStyle;
  showScissorsIcon: boolean;
  showRightSection: boolean;      // Sekcja z Ceną i Ref
  brandName: string;              // Domyślnie "STANDERS"
  brandSubtitle?: string;
  customLogoUrl?: string;
  useStandersLogo: boolean;
  scaleLabelText: string;         // Domyślnie "Wpisz na wadze:"
  badgeColor: string;             // Domyślnie "#d4f4c2" (pastelowa zieleń jak w oryginale)
  includeCalibrationRuler: boolean; // Pasek 5 cm do sprawdzenia skali
  verticalSpacingMm: number;      // Odstęp między fiszkami w mm (np. 0, 2, 4)
}
