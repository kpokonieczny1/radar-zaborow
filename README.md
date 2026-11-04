# Radar Zaborów 17.2 — wiek tylko gdy znany

Aktualizacja **bez AirLabs**, bez zmian w pozycjach, trasach FR24, zdjęciach,
lotniskach, współrzędnych i układzie.

## Wgraj tylko dwa pliki

1. Zastąp w repozytorium GitHub główny `index.html` plikiem z tego archiwum.
2. Zastąp `functions/api/aircraft-age.js` nową wersją z tego archiwum.
3. Zatwierdź zmiany przez **Commit changes**. Cloudflare Pages wdroży projekt.
4. Na tablecie odśwież stronę, najlepiej po zamknięciu i ponownym otwarciu.

## Co się zmienia

- Dla samolotów z rozpoznanym rokiem produkcji widoczny jest `Wiek: ok. N lat (RRRR)`.
- Dla pozostałych **nie jest wyświetlane w ogóle pole wieku**, również przy błędach API.
- Endpoint próbuje odczytać rok produkcji z OpenAirframes/FAA i opcjonalnych metadanych ADSB.lol.
- Zapytania nie korzystają ani z AirLabs, ani z FR24; nie zużywają ich kredytów.
- Brak wieku zapamiętujemy na 6 godzin, znaleziony rok na 30 dni.
- Usunięcie sekretu `AIRLABS_API_KEY` w Cloudflare jest opcjonalne; nowy kod go ignoruje.

## Diagnostyka

`https://radar-zaborow.pages.dev/api/aircraft-age?hex=48E973`

Jeżeli pojawi się `status: not_found`, radar nie pokaże pola wieku.
To prawidłowe zachowanie dla samolotu, którego rocznik nie jest dostępny w tych źródłach.
