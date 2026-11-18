# Radar Zaborów 20.2 — adaptacyjne odświeżanie i kontrola kredytów

## Działanie
- **60 sekund** między pobraniami pozycji z FR24, jeśli ostatni odczyt nie wykazał samolotów w ustawionym promieniu.
- **30 sekund**, gdy w promieniu są samoloty. Obie wartości można zmienić w zwijanym panelu Ustawienia. Nowe domyślne 60/30 s nie są nadpisywane przez dawne ustawienia 20.0.
- Symbole poruszają się co **1 sekundę** lokalnie. To **predykcja** na podstawie kursu/prędkości; nie wiąże się z kredytami FR24.
- Samolot znika z listy i mapy, jeśli nie ma go w kolejnej odpowiedzi lub jego obliczona pozycja wykracza poza promień (w ciągu ok. 1 s).
- Backendowy cache pozycji to **25 s**, a nie 180 s. Zmieniono jego klucz, aby uniknąć starych odpowiedzi po aktualizacji.
- Jedno zapytanie pozycji naraz z danej karty przeglądarki, poprawione zmiany interwałów.
- Licznik kredytów pozostaje w oparciu o endpoint `api/usage`, sprawdzany najczęściej **co 10 minut**. Obok liczby kredytów wyświetla się **godzina ostatniego raportu** (polski czas). Raport = zużycie przez ostatnie 30 dni; *nie* bieżące saldo abonamentowe.
- Pozostają: przerwa nocna 00:00–06:00 (po stronie serwera i przeglądarki), przycisk Stop, OSM, zegar, trzy środki radaru, zdjęcia, lotniska i trasy FR24.

## Aktualizacja GitHub / Cloudflare Pages
1. Na github.com/kpokonieczny1/radar-zaborow podmień `index.html`.
2. W `functions/api` podmień `flights.js`.
3. Zatwierdź zmiany (Commit changes). Cloudflare Pages automatycznie wdroży nową wersję.
4. Odśwież stronę na tablecie. Nie trzeba zmieniać tokenu ani pozostałych funkcji API.

## Kredyty: ważne
Radar uruchomiony 18 godzin dziennie bez żadnych samolotów przy 60 s wykonuje **1080 zapytań dziennie**, czyli minimum ok. 32 400 kredytów w 30 dni. Gdy wykryje samoloty, wzrasta częstotliwość do 30 s, a pełny rekord samolotu jest dodatkowo płatny. Nie ma gwarancji zmieszczenia się w limicie Explorer 60 000. Używaj przełącznika Stop i kontroluj rzeczywiste saldo w panelu FR24. Pamięć podręczna Cloudflare jest lokalna (best-effort) i nie jest twardym limitem wydatków; publiczne płatne endpointy warto chronić przez Cloudflare Access. Wysłanego już zapytania nie zawsze można odwołać bez naliczenia kredytów.

## Pliki
- `index.html`
- `functions/api/flights.js`
