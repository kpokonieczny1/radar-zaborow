# Radar Zaborów 13.0

Aktualizacja poprzedniej wersji 12.0.

## Co się zmieniło

- Usunięto widoczne pole „Źródło danych” i niepotrzebny tryb demonstracyjny. Radar pokazuje realne dane ADS-B.
- Dostępne są przyciski ustawiające środek: Zaborów, Mieszkanie, Praca.
  - Zaborów: 52.2629444444, 20.6860833333
  - Mieszkanie: 52.280300, 20.9214805556 (52°16′49,08″ N, 20°55′17,33″ E)
  - Praca: 52.2534111111, 20.904650 (52°15′12,28″ N, 20°54′16,74″ E)
- Usunięto widoczne pole PIN. Aby zachować ochronę płatnych zapytań FR24, po wybraniu „Włącz trasy FR24” przeglądarka zapyta o kod raz w danej karcie. Kod zostaje w sessionStorage do zamknięcia karty; nie ma go w HTML ani repozytorium. Cloudflare nadal wymaga sekretu FR24_ROUTE_PIN i uprawnienia FR24 do łączenia źródeł.
- Nazwy oraz kody krajów ISO-3 dla lotnisk z kodami IATA/ICAO są pobierane dodatkową funkcją `/api/airports` z otwartych źródeł (AirportMiles / FreeAirportDB), a nie z FR24. Najczęstsze lotniska mają mapę zapasową, a wyniki są zapamiętywane w przeglądarce. Jeśli źródła nie znajdą nazwy, zostaje sam kod.

## Wdrożenie na Cloudflare Pages

1. W swoim repozytorium GitHub podmień **index.html**.
2. Do katalogu `functions/api/` **dodaj nowy plik** `airports.js`.
3. Pozostaw istniejące `functions/api/flights.js`, `functions/api/fr24-routes.js` i `functions/api/fr24.js` z tej paczki albo z wersji 12.0.
4. Zatwierdź zmiany (*Commit changes*) i poczekaj na automatyczny deployment Cloudflare.
5. W Cloudflare w Production zachowaj `FR24_API_TOKEN` (Secret), `FR24_ROUTE_PIN` (Secret), `FR24_HYBRID_PERMISSION_GRANTED=yes` **wyłącznie po otrzymaniu zgody FR24** na łączenie bieżących danych różnych dostawców.
6. Otwórz stronę. Aby włączyć trasy FR24, naciśnij przycisk „Włącz trasy FR24” i wpisz PIN w systemowym oknie — nie trzeba go podawać ponownie przy przeładowaniu tej samej karty.

**Uwaga o bezpieczeństwie:** nie można bezpiecznie usunąć całej autoryzacji płatnego API, jeśli publiczna strona pozostaje dostępna dla wszystkich. Aby całkowicie usunąć prośbę o PIN, trzeba zabezpieczyć całą witrynę inną metodą, np. Cloudflare Access. Samo ukrycie pola nie wystarcza.

## Testy

- Kliknij „Mieszkanie”, potem „Praca” — współrzędne powinny aktualizować widok i zapytania do API.
- Wróć do „Zaborów”.
- Dla wykrytego lotu z kodem lotniska bez nazwy przeglądarka spróbuje pobrać nazwę i ISO-3 niezależnie od FR24.
- Kontrola zapytania: `/api/airports?codes=WAW,FRA,ARN,EGLL`. Powinny pojawić się wpisy lotnisk, o ile zewnętrzne serwisy odpowiadają.

Źródła danych lotnisk: https://ourairports.com/data/ (public domain), https://airportmiles.com/api (CC0), https://freeairportdb.com/api.
