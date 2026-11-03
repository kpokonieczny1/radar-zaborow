# Radar Zaborów 15.0 — kompaktowy interfejs i filtr ruchu naziemnego

Aktualizacja działającego projektu **Cloudflare Pages** w repozytorium `kpokonieczny1/radar-zaborow`.

## Co nowego

1. Niski nagłówek i pojedynczy pasek trzech lokalizacji: **Zaborów**, **Mieszkanie**, **Praca**. Ustawienia współrzędnych, promienia i częstotliwości są domyślnie zwinięte. Zawartość FR24 również można rozwinąć tylko wtedy, kiedy jest potrzebna.
2. Każda karta lotu ma **zdjęcie po lewej**, a po prawej w kilku wierszach nazwę przewoźnika, znak wywoławczy, lotniska wylotu i przylotu, kod kraju oraz model, rejestrację, numer rejsu (jeśli dostępny), wysokość i prędkość. Karta jest tak zwarta, jak to możliwe przy czytelnej prezentacji wszystkich danych. Przy małej szerokości ekranu wysokość może wzrosnąć.
3. Odfiltrowano pojazdy obsługi lotniska i obiekty naziemne **jeszcze po stronie API**, zanim trafią na radar. Filtr wykorzystuje kategorię ADS-B (`C0`–`C7`) lub informację o znajdowaniu się na ziemi (`alt_baro: "ground"` / `on_ground: true`). **Samoloty kołujące także są ukrywane; pojawią się, kiedy będą w powietrzu.** Nieznane lub błędne oznaczenia w danych zewnętrznych mogą pozostawić pojedyncze pojazdy na liście.

## Aktualizacja GitHuba

Należy podmienić **dokładnie dwa pliki**:

- `index.html` w katalogu głównym repozytorium;
- `functions/api/flights.js` w katalogu `functions/api/`.

Nie trzeba zmieniać plików `functions/api/fr24-routes.js`, `functions/api/airports.js` ani `functions/api/fr24.js`, o ile są już zainstalowane z wersji 14.1. Wersja 15 zachowuje ustawienia FR24, domyślne trzy lokalizacje, zdjęcia, logo, rozpoznawanie Babic `QPB` / `EPBC` i częstotliwość 3 s (albo inną wpisaną przez użytkownika).

Wgraj nowe pliki do tych samych katalogów, wykonaj **Commit changes**, poczekaj na wdrożenie w Cloudflare Pages i otwórz `https://radar-zaborow.pages.dev/`. W razie starego wyglądu użyj `Ctrl+F5`.

## Jak ustawić radary

- Przyciskami w górnym pasku wybierasz lokalizację.
- Przycisk **⚙ Ustawienia** rozwija pola promienia, współrzędnych i interwału.
- Przycisk **Trasy FR24** rozwija panel włączania/wyłączania tras. Przechowywanie i zabezpieczenie tokenu FR24 pozostaje bez zmian.

## Ograniczenia

- Pozycje i kategorie pochodzą z zewnętrznej sieci ADS-B. Filtr jest heurystyczny i nie stanowi gwarancji identyfikacji rodzaju obiektu.
- Odświeżanie co 3 sekundy to *częstotliwość zapytań*, a nie gwarancja nowych danych w każdej odpowiedzi.
- Układ i filtr przetestowano na przykładowych danych w środowisku przeglądarkowym; bieżące działanie na produkcyjnym Cloudflare należy sprawdzić po wdrożeniu.
