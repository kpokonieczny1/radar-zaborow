# Radar Zaborów 20.0 – FR24, tryb nocny, Start/Stop i kredyty

## Co nowego
- **Pozycje i trasy tylko z produkcyjnego API FR24** (`live/flight-positions/full`), bez OpenSky i blokowanych ADSB.lol / ADSB.fi.
- **Przerwa nocna 00:00–06:00 czasu Europe/Warsaw**, z automatycznym wznowieniem po godzinie 06:00, o ile radar nie został wyłączony ręcznie. **Blokada jest też po stronie Cloudflare** (`functions/api/flights.js` i `fr24-usage.js`). W tym czasie endpoint lotów nie wykonuje płatnego zapytania FR24.
- **Przełącznik „Wyłącz radar / Włącz radar”** na tablecie, który przerywa odpytywanie API w tej przeglądarce i zapamiętuje stan po odświeżeniu.
- **Raport zużycia kredytów FR24** z oficjalnego `/api/usage?period=30d`, odświeżany nie częściej niż co 10 minut lub ręcznie. Dotyczy ostatnich 30 dni, **nie jest dokładnym saldem bieżącego okresu rozliczeniowego**.
- **Animacja samolotów co 1 sekundę** – pozycja między odczytami jest *szacowana*, nie pobiera dodatkowych kredytów. Różne symbole samolotów i śmigłowców, zegar, data, mapa OSM, trzy lokalizacje i zdjęcia pozostają.
- Fotografie po rejestracji / ICAO24 są pobierane przez **osobny, bezpłatny** `/api/flight-metadata`, bez dodatkowego zapytania o pozycje FR24.

## Instalacja w GitHub/Cloudflare Pages

1. W repozytorium `kpokonieczny1/radar-zaborow` zastąp główny **index.html**.
2. W folderze `functions/api/` zastąp istniejący **flights.js**.
3. W tym samym folderze dodaj **fr24-usage.js** i **flight-metadata.js**.
4. Zachowaj dotychczasowe `airports.js` i `aircraft-age.js`. Stary `fr24-routes.js` jest już niepotrzebny – **zaleca się go usunąć**, aby stara płatna funkcja nie była przypadkiem wywoływana.
5. Zatwierdź **Commit changes**. Cloudflare Pages opublikuje nową wersję.
6. W Cloudflare → Workers & Pages → radar-zaborow → Settings → Variables and Secrets sprawdź, czy w środowisku **Production** istnieje sekret `FR24_API_TOKEN`. Nie umieszczaj tokenu w HTML ani GitHubie.
7. Otwórz `https://radar-zaborow.pages.dev/` i sprawdź przełącznik oraz licznik. Standardowy czas pobierania to **180 sekund** (można ustawić od **120 do 900 sekund** w ustawieniach). 

## Kredyty i koszty – ważne

- FR24 nalicza orientacyjnie **8 kredytów za każdy zwrócony rekord** z pełnego endpointu, a **1 kredyt przy pustej odpowiedzi**. W funkcji włączono `limit=12` oraz regionalny bufor Cloudflare `180 s`, aby ograniczać koszty. Limit 12 może ukrywać część samolotów w większych obszarach. Czas na odczyty i animację są od siebie niezależne.
- **Bufor `caches.default` jest regionalny i best-effort**; nie jest globalnym, atomowym ogranicznikiem budżetu. Przy wielu urządzeniach, zmianie lokalizacji/promienia, odświeżaniu ręcznym lub wywoływaniu publicznego API koszty mogą wzrosnąć.
- Przełącznik Stop zatrzymuje zapytania **z danej przeglądarki**, nie blokuje możliwości wywołania publicznego endpointu przez inne osoby. Aby ochronić płatny token i zapobiec nadużyciom, **ogranicz dostęp do strony i endpointów przez Cloudflare Access** (lub dodaj serwerowe uwierzytelnianie i twardy limit kredytów).
- Kredyty pokazane w radarze to oficjalna statystyka *ostatnich 30 dni*. **Dokładne kredyty pozostałe w abonamencie** widać w portalu `https://fr24api.flightradar24.com/` → Credits Overview.
- Bez logowania albo w przypadku testowej odpowiedzi FR24 nie da się potwierdzić, że nowe API rzeczywiście będzie działać na produkcji – testy tej paczki wykonano na danych symulowanych.

## Pliki

- `index.html` – wygląd i logika radaru
- `functions/api/flights.js` – pozycje i trasy FR24, nocny stop, serwerowy bufor odczytów
- `functions/api/fr24-usage.js` – raport zużycia 30 dni
- `functions/api/flight-metadata.js` – zdjęcia z Planespotters.net, bez FR24
