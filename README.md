## Aktualizacja 14.1

Dodano kod IATA `QPB` — Warszawa-Babice, Polska (`POL`); zachowano `EPBC`.
Aby zaktualizować, podmień `index.html`, `functions/api/fr24-routes.js` i `functions/api/airports.js` na GitHubie.
Pozostałe ustawienia Cloudflare bez zmian.

# Radar Zaborów 14.0

Aktualizacja wersji 13.0 — nowe ikony na radarze, zwijany panel FR24 i obsługa tras niepełnych.

## Zmiany

- **Panel „Trasy Flightradar24” jest domyślnie zwinięty.** Rozwiń go, aby włączyć lub wyłączyć FR24. Stan „Aktywne” / „Wyłączone” widać również po zwinięciu.
- **Pozycje samolotów mają sylwetki w rzucie z góry, obracane według pola `track` (0° = północ, 90° = wschód).** Brak danych o kursie jest oznaczony znakiem `?`, aby nie sugerować błędnego kierunku.
- **Niepełna trasa FR24 nie jest odrzucana.** Dla lotu z lotniska EPBC będzie pokazane `Wylot: EPBC · Warszawa-Babice · POL` i `Przylot: Lotnisko docelowe nieznane`, jeśli API nie ma danych o celu.
- Dodana lokalna nazwa lotniska Warszawa-Babice (EPBC) i kod kraju POL, również do zapasowej bazy lotnisk.
- Zachowane: zdjęcia, linie, promień i współrzędne środka (Zaborów/Mieszkanie/Praca), ustawiany interwał, zabezpieczenia dostępu i cache FR24.

## Wdrożenie na Cloudflare Pages

Z rozpakowanego archiwum **podmień dokładnie trzy pliki** w repozytorium `kpokonieczny1/radar-zaborow`:

1. `index.html` (główny katalog repozytorium),
2. `functions/api/fr24-routes.js`,
3. `functions/api/airports.js`.

Pozostałe pliki mogą zostać takie, jak w obecnej instalacji (dotychczasowe `flights.js` i `fr24.js` pozostają bez zmian). Zatwierdź zmiany w GitHubie przez **Commit changes**, poczekaj na zakończenie automatycznego wdrożenia w Cloudflare Pages i odśwież stronę klawiszami Ctrl+F5.

Sekrety Cloudflare (`FR24_API_TOKEN`, `FR24_ROUTE_PIN` oraz potwierdzenie uprawnień do hybrydowego użycia FR24) pozostają bez zmian. **Nigdy nie umieszczaj tokenu w HTML ani repozytorium.**

## Sprawdzenie

1. Panel FR24 ma być domyślnie zwinięty, a przycisk do aktywacji widoczny po rozwinięciu.
2. Gdy dostępna jest wartość `track`, ikona samolotu ma wskazywać kurs; bez `track` powinno pojawić się `?`.
3. Lot z kodem EPBC i bez lotniska docelowego ma pokazać „Warszawa-Babice → Lotnisko docelowe nieznane”.
4. Brak części trasy nie może wywoływać ciągłych ponownych zapytań FR24 co 3 sekundy — taka informacja jest buforowana jako rozpoznana.

Uwaga: testy offline na danych testowych nie stanowią potwierdzenia, że produkcyjne API FR24 poda wszystkie lotniska. Dane częściowe pokazujemy bez zgadywania celu podróży.
