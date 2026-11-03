# Radar Zaborów 12.0 — aktualne trasy FR24

Pliki przeznaczone do **Cloudflare Pages (GitHub)**. Jest to aktualizacja wersji 11.0.

## Co robi wersja 12

- Pozycje, zdjęcia, logo, promień, współrzędne i odświeżanie 3 s: bez zmian, z ADS-B.
- Po aktywacji: trasy i numery rejsów z **produkcyjnego Flightradar24**.
- Trasy są pobierane przez Cloudflare **tylko po wykryciu nowego samolotu**, jedną paczką do 10 znaków wywoławczych.
- Endpoint **`/api/live/flight-positions/full` z filtrem `callsigns`** zapewnia bieżące trasy (bardziej aktualne niż lista historycznych przypisań).
- Sprawdzenie `callsign`, a gdy są dostępne również `hex` i `reg`. W razie braku trasy FR24 nie prezentujemy trasy z alternatywnych baz jako wyniku FR24.
- Po stronie przeglądarki ponowienie dla nieznanej trasy nie częściej niż po 5 minutach; znalezione trasy są przechowywane w pamięci karty przez 30 minut. Opcjonalny cache Cloudflare analogicznie 5/30 minut.
- W panelu `Trasy Flightradar24 – aktualne rejsy` wpisuje się **PIN**, nie token API. PIN pozostaje w pamięci aktualnej karty do jej zamknięcia lub przeładowania.
- Sandbox nadal działa niezależnie.

## Ważne: warunki licencyjne

Regulamin FR24, sekcja 6.3.1(1)(iii), zabrania bez odrębnego upoważnienia używania FR24 API do uzupełniania bieżących danych innego operatora. **Nie włączaj tego połączenia przed uzyskaniem zgody FR24.** W tym celu kod wymaga ustawienia `FR24_HYBRID_PERMISSION_GRANTED=yes` w Cloudflare dopiero po uzyskaniu zgody.

https://www.flightradar24.com/terms-of-service

## Jak wdrożyć

1. Na `https://github.com/kpokonieczny1/radar-zaborow` podmień `index.html`.
2. Podmień `functions/api/fr24-routes.js` (jeżeli jeszcze nie ma — dodaj).
3. Nie musisz wymieniać `functions/api/flights.js` ani `functions/api/fr24.js`.
4. `Commit changes` spowoduje wdrożenie Cloudflare Pages.
5. W Cloudflare → Workers & Pages → radar-zaborow → Settings → Variables and Secrets → **Production** dodaj:

| Name | Type | Value |
|---|---|---|
| `FR24_API_TOKEN` | Secret | **produkcyjny** token FR24 |
| `FR24_ROUTE_PIN` | Secret | własny losowy kod min. 8 znaków (zalecane 20+) |
| `FR24_HYBRID_PERMISSION_GRANTED` | Variable | `yes` **wyłącznie po zgodzie FR24** |

6. Wdróż ponownie aplikację, jeżeli sekrety nie pojawią się od razu w bieżącym wdrożeniu.
7. Otwórz stronę, rozwiń **Trasy Flightradar24 – aktualne rejsy**, wpisz PIN i wybierz **Włącz trasy FR24**.

**Bezpieczeństwo:** nie umieszczaj tokenu ani PIN-u w publicznym repozytorium ani na zrzucie ekranu. PIN chroni publiczny endpoint przed przypadkowym zużyciem Twoich kredytów; dla dodatkowej ochrony warto ograniczyć dostęp do strony przez Cloudflare Access.

## Koszty i ograniczenia

`live/flight-positions/full` kosztuje obecnie **8 kredytów za zwrócony samolot**, pusty wynik kosztuje 1 kredyt. Jedno wywołanie sprawdza do 10 maszyn; nie wykonujemy go co 3 s. W odpowiedzi nie wszystkie loty muszą mieć trasę; brak wyników nie oznacza błędu aplikacji. `limit=30` ogranicza maksymalną liczbę wierszy w odpowiedzi API. Rzeczywiste zużycie zależy od ruchu i ponownych prób.

Źródła: https://fr24api.flightradar24.com/docs/credit-overview oraz https://fr24api.flightradar24.com/docs/sandbox-environment.

## Testy

Walidacja składni JavaScript, testy z zasymulowanym API (FRA → WAW dla `LOT6EA`, odrzucanie niezgodnego `hex` / `reg`, brak PIN/zgody), bez użycia Twojego produkcyjnego tokenu. Rzeczywisty test po stronie Cloudflare następuje po konfiguracji sekretów i aktywacji.
