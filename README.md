# Radar Zaborów 7.0 — konfigurowalny środek i częstotliwość

Projekt na Cloudflare Pages do wyświetlania samolotów na tablecie.

## Nowe możliwości

- **Środek radaru:** dowolna szerokość i długość geograficzna. Domyślnie Zaborów: `52.2629444444, 20.6860833333` (52°15′46,6″ N, 20°41′09,9″ E).
- **Współrzędne:** wpisuj stopnie dziesiętne, np. `52.26294444` i `20.68608333`, lub stopnie/minuty/sekundy, np. `52 15 46,6` oraz `20 41 09,9`. Dopuszczalne są również oznaczenia N/S/E/W.
- **Promień:** 1–200 km.
- **Częstotliwość przy obecności samolotu:** dowolna liczba całkowita od 3 do 300 sekund, domyślnie 3 s. Bez samolotów przeglądarka sprawdza dane co 30 s.
- **Przycisk „Środek: Zaborów”:** przywraca domyślne współrzędne, zachowując promień i częstotliwość wpisane w formularzu.
- Wszystkie ustawienia zapisywane są lokalnie w przeglądarce, gdy jej mechanizm localStorage jest dostępny.

Ważne: współrzędne są przekazywane do **API**, które rzeczywiście pobiera i filtruje pozycje względem nowego środka. Radar na ekranie też jest przeliczany. Zdjęcia, logotypy i trasy zachowują sposób działania z wersji 6.0. Metadane są odświeżane rzadziej (około 90 s), żeby nie obciążać baz zdjęć i tras.

## Aktualizacja

W repozytorium GitHub `kpokonieczny1/radar-zaborow` podmień **oba** pliki:

1. `index.html`
2. `functions/api/flights.js`

Możesz to zrobić przez **Add file → Upload files** w odpowiednim katalogu. Potem kliknij **Commit changes**. Cloudflare Pages powinien automatycznie wdrożyć zmiany, zachowując adres `https://radar-zaborow.pages.dev/`.

Nie wgrywaj folderu `radar-zaborow-v7` jako dodatkowego katalogu repozytorium. Plik `index.html` musi być w jego katalogu głównym, a `flights.js` — w `functions/api/`.

## API i test

- Pozycje (domyślny środek): `https://radar-zaborow.pages.dev/api/flights?radius=20&mode=positions`
- Pozycje (własny środek): `https://radar-zaborow.pages.dev/api/flights?lat=52.26294444&lon=20.68608333&radius=20&mode=positions`
- Metadane tras i zdjęć (własny środek): `https://radar-zaborow.pages.dev/api/flights?lat=52.26294444&lon=20.68608333&radius=20&mode=full`

Odpowiedź JSON zawiera `center`, `radius_km`, `count`, `flights` i `inside_10km`. Parametry `lat` i `lon` są opcjonalne — gdy ich nie podasz, przyjmowany jest Zaborów. W parametrach URL używaj kropki dziesiętnej.

## Ograniczenia

- 3 sekundy to odstęp **między próbami pobierania danych**, liczony po zakończeniu poprzedniego zapytania. Nie gwarantuje to odświeżenia pozycji przez dostawcę ADS-B co 3 sekundy.
- Przy błędzie serwisu próby są zwalniane do 30 s. Dostawcy danych mogą mieć limity liczby zapytań; sprawdź warunki korzystania.
- Przeglądarka tabletu może wstrzymać odświeżanie, gdy karta jest w tle albo ekran zostanie wygaszony.
- Zewnętrzne zdjęcia nie zawsze są dostępne; zdjęcie SP-LYI wskazane ręcznie przez użytkownika podlega warunkom JetPhotos i prawom autora.
- Trasy z otwartych katalogów są orientacyjne. Nie są gwarantowanym, aktualnym planem lotu.

Wersję 7.0 przetestowano składniowo oraz na symulowanych odpowiedziach API i symulacji interakcji z formularzem. Nie wykonano testu na produkcyjnym Cloudflare.
