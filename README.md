# Radar Zaborów 9.0 — trasy z API bez filtrowania

Zmiana względem wersji 8.0: trasy z baz danych są **wyświetlane nawet wtedy, gdy nie przejdą wcześniejszej heurystycznej kontroli położenia samolotu**. Dotyczy to też odpowiedzi ADSB.lol z `plausible: false`.

## Jak wybierana jest trasa

1. **ADSB.lol Routeset** — jeśli wskazuje oba lotniska (nawet przy `plausible: false`).
2. **ADSBdb** — jeśli ADSB.lol nie zwróciło kompletnej trasy.
3. **HexDB** — jeśli dwie poprzednie bazy nie podały trasy.

Na karcie pojawia się „Źródło trasy: ... · dane niezweryfikowane”. To jest **informacja z katalogu lotów, a nie potwierdzona aktualna trasa**. Czasami baza zwróci trasę historyczną lub błędną. Gdy żadna baza nie zna trasy, wciąż wyświetla się „Trasa nieustalona”.

## Aktualizacja

W repozytorium `kpokonieczny1/radar-zaborow` podmień:

- `index.html` (katalog główny),
- `functions/api/flights.js` (zachowaj katalogi).

Zatwierdź **Commit changes**. Cloudflare Pages automatycznie opublikuje aktualizację pod adresem `https://radar-zaborow.pages.dev/`.

Po wdrożeniu możesz sprawdzić dane bezpośrednio w JSON: `https://radar-zaborow.pages.dev/api/flights?radius=30&mode=full`.

Nie zmieniono ustawień współrzędnych (domyślnie Zaborów: 52.2629444444, 20.6860833333), promienia, częstotliwości odświeżania, zdjęć ani logotypów.

Uwaga: trasy i zdjęcia są nadal uzależnione od dostępności zewnętrznych serwisów. Żadna z użytych otwartych baz nie gwarantuje zgodności z bieżącymi lotami Flightradar24.
