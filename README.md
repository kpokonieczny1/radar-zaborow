# Radar Zaborów 16.0 – lotniska i przybliżony wiek samolotu

## Zmiany

### Oznaczenia lotnisk

Na tarczy radaru pojawiają się nieruchome, żółte znaczniki lotnisk:

- **Lotnisko Chopina / Okęcie** – WAW / EPWA, punkt odniesienia 52.1658333333 N, 20.9672222222 E.
- **Warszawa-Babice** – QPB / EPBC, punkt odniesienia 52.2691666667 N, 20.9072222222 E.

Znaczniki są widoczne **tylko w granicach aktualnego promienia**. Z centrum Zaborowa do Babic jest ok. **15 km**, a do Okęcia ok. **22 km**, dlatego do obserwacji obu lotnisk ustaw promień **co najmniej 25 km**. Punkty są stałe, nie są pobierane z API FR24 i nie zużywają kredytów. Są to punkty referencyjne lotnisk, a nie dokładne końce pasów startowych. Samoloty naziemne nadal są ukrywane przez filtr.

### Wiek samolotu

W kompaktowej karcie dodano pole **Wiek**, np. `ok. 7 lat (2019)`.

- Wiek liczony jest **przybliżenie**: `bieżący rok - rok produkcji`, a nie z dokładnej daty pierwszego lotu.
- Informacje o roczniku próbowane są najpierw z danych ADS-B (jeżeli dostawca je zwraca), a następnie przez osobną funkcję `aircraft-age.js` z bezpłatnej bazy OpenAirframes (przede wszystkim dane FAA dla rejestracji amerykańskich) i pomocniczo ADSB.lol.
- Dla części samolotów, szczególnie europejskich, może być pokazane `nieznany` – nie wnioskujemy wieku z typu maszyny ani daty rejestracji.
- Dane są przechowywane lokalnie na tablecie do 30 dni, a odpowiedzi API mogą być również buforowane przez Cloudflare. FR24 **nie jest wywoływany** w celu ustalania wieku.

## Aktualizacja GitHub / Cloudflare Pages

Zastąp w repozytorium `kpokonieczny1/radar-zaborow`:

1. Plik główny `index.html` nowym plikiem z tej paczki.
2. Plik `functions/api/flights.js` nową wersją z tej paczki.
3. **Dodaj nowy** plik `functions/api/aircraft-age.js` do istniejącego katalogu `functions/api/`.

Pozostałe pliki (`fr24-routes.js`, `airports.js`), sekret FR24 i konfiguracja Cloudflare **pozostają bez zmian**.

Po `Commit changes` poczekaj na automatyczne wdrożenie, otwórz `https://radar-zaborow.pages.dev/` i odśwież stronę z wyczyszczeniem pamięci podręcznej (w Androidzie można zamknąć i ponownie uruchomić stronę).

## Szybki test wieku API

`https://radar-zaborow.pages.dev/api/aircraft-age?hex=AC0CAB`

Gdy baza zna rok, JSON zawiera `year_built` i `age_years`; w innym przypadku pola te mają wartość `null`. Test nie wykorzystuje FR24.

## Źródła i ograniczenia

- Współrzędne EPWA: oficjalny eAIP PANSA, ARP 520957N 0205802E.
- Współrzędne EPBC: Urząd Lotnictwa Cywilnego, 52°16′09″N 20°54′26″E.
- Rok produkcji: `https://api.pigeite.com` (OpenAirframes, FAA), metadane ADSB.lol i dostępne pola w aktualnym strumieniu ADS-B.

Testy lokalne obejmują walidację współrzędnych markerów i obecności znaczników przy różnych promieniach, renderowanie wieku i składnię JavaScript. Nie weryfikowano na produkcyjnym Cloudflare dostępności zewnętrznych baz.
