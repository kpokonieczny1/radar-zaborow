# Radar Zaborów 2.0 – wybór 10 / 20 / 50 km i alarm

Projekt dla istniejącej strony `https://radar-zaborow.pages.dev/`, publikowanej za pośrednictwem GitHub i Cloudflare Pages.

## Zmiany

- Wybór promienia: 10 km, 20 km lub 50 km.
- Lista lotów i pozycje na radarze zmieniają się zgodnie z wybranym promieniem.
- Strefa 10 km jest oznaczona zielonym okręgiem, niezależnie od wybranego zasięgu.
- Przycisk „Włącz alarm 10 km”: widoczny komunikat, krótki dźwięk (jeśli przeglądarka zezwala) oraz powiadomienie systemowe, jeśli jest dostępne i użytkownik udzieli uprawnień.
- Alarm dotyczy nowego samolotu wykrytego w promieniu 10 km od przybliżonego środka Zaborowa. Przy pierwszym odczycie następuje tylko ustalenie stanu początkowego; alert pojawia się przy kolejnym nowym wykryciu. Ten sam samolot nie generuje kolejnego alarmu przez co najmniej 15 minut.
- Automatyczne odświeżanie co 30 sekund, kiedy karta jest widoczna.

## Jak wgrać do istniejącego projektu

W repozytorium `kpokonieczny1/radar-zaborow` podmień **dwa pliki** (nie twórz drugiego repozytorium):

1. `index.html` w głównym katalogu repozytorium.
2. `functions/api/flights.js` w odpowiednim katalogu.

Dla każdego pliku na GitHubie: otwórz plik, kliknij ołówek (Edit this file), zastąp całą treść nową, a następnie kliknij Commit changes.

Cloudflare Pages wykryje commity i opublikuje nową wersję na tym samym adresie.

## Test

- `https://radar-zaborow.pages.dev/api/flights?radius=10`
- `https://radar-zaborow.pages.dev/api/flights?radius=20`
- `https://radar-zaborow.pages.dev/api/flights?radius=50`

W JSON-ie sprawdź `radius_km`, `count`, `inside_10km` i `flights`.

## Ważne ograniczenia

- Tablet musi mieć aktywną kartę strony i połączenie z internetem. Nie jest to niezawodny system powiadamiania w tle lub przy wygaszonym ekranie.
- Dane ADS-B są przybliżone i nie obejmują każdego samolotu. Nie wszystkie loty mają rozpoznaną linię i trasę.
- Najbliższych 12 samolotów w jednym odczycie wzbogacamy zapytaniami do baz ADSBdb / hexdb.io; pozostałe wyświetlają dane dostępne bezpośrednio z ADS-B.
- Na większym zasięgu dostawca może zastosować ograniczenia API. Radar próbuje ADSB One, ADSB.lol i ADSB.fi.
- Promień jest mierzony poziomo od współrzędnych 52.2634, 20.6845, a nie od dokładnego adresu domu.
- Projekt wymaga Cloudflare Pages Functions, nie działa w pełni na samym GitHub Pages.
