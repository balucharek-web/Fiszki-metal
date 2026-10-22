# Generator Fiszek Regałowych A4 (19.5 × 4.0 cm)

Aplikacja do generowania i drukowania fiszek / etykiet regałowych na artykuły metalowe i złączne (np. wkręty do drewna, śruby, kołki) w formacie arkusza A4.

## Cechy szablonu
- **Format fiszki:** 19.5 cm szerokości × 4.0 cm wysokości (195 × 40 mm)
- **Czarna ramka cenowa:** 5.5 cm szerokości × 3.7 cm wysokości (55 × 37 mm)
- **W pełni edytowalne pola bezpośrednio na podglądzie:**
  - Nazwa towaru (np. *Wkręt do drewna*)
  - Wymiar (np. *6x80 mm*)
  - Kod na wadze (np. *247*) na zielonym pasku
  - Numer referencyjny (`Ref: 42660256`) oraz pole `Cena`
- **Układ A4:** 6 fiszek na stronę (z liniami cięcia) lub 7 fiszek (maksymalne zapełnienie)
- **Druk 1:1:** Pasek kontrolny 50 mm (5 cm) na marginesie do weryfikacji skali linijką

## Uruchomienie lokalne
```bash
npm install
npm run dev
```

## Budowanie do wersji statycznej (GitHub Pages)
```bash
npm run build
```
Wygenerowany katalog `dist/` jest gotowy do publikacji na GitHub Pages.
