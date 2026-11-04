# Radar Zaborów 17.0 — globalne sprawdzanie wieku przez AirLabs

**Zmieniono tylko dwa pliki:** `index.html` i `functions/api/aircraft-age.js`.
Nie zmieniano radaru, zdjęć, API pozycji, tras FR24, ustawień i znaczników lotnisk.

## Wdrożenie (Cloudflare Pages)

1. Podmień `index.html` i `functions/api/aircraft-age.js` na GitHubie w repozytorium `kpokonieczny1/radar-zaborow`.
2. Utwórz konto AirLabs, https://airlabs.co/signup, jeśli nie masz klucza API.
3. Cloudflare → Workers & Pages → radar-zaborow → Settings → Variables and Secrets → **Add**:
   - Name: `AIRLABS_API_KEY`
   - Type: **Secret**
   - Value: klucz API z AirLabs (nie wklejaj go do pliku, repozytorium ani czatu)
   - Environment: **Production**.
4. Wykonaj nowe wdrożenie, jeżeli Cloudflare tego wymaga (np. nowy commit na GitHubie).
5. Przetestuj konfigurację: `https://radar-zaborow.pages.dev/api/aircraft-age?check=1`
   - `"airlabs_configured":true` — sekret jest dostępny w funkcji.
6. Sprawdź pojedynczy samolot po ICAO24: `https://radar-zaborow.pages.dev/api/aircraft-age?hex=AC0CAB` (FAA fallback) lub podaj hex europejskiego samolotu z radaru razem z `&registration=...`.

## Co dokładnie działa?

- Funkcja pyta AirLabs Fleets po numerze rejestracyjnym (lub ICAO24, gdy rejestracja jest nieznana).
- Odczytuje `built` i `age`; weryfikuje zgodność rejestracji/ICAO24. Jeśli jest rok produkcji, pokazuje `ok. N lat (RRRR)`. Jeśli jest wyłącznie wiek, pokazuje `ok. N lat`.
- Dla niektórych amerykańskich samolotów pozostaje bezpłatne źródło OpenAirframes/FAA.
- Odpowiedzi pozytywne są zapamiętywane na tablecie i w Cloudflare ok. 30 dni; po błędzie lub braku klucza aplikacja próbuje ponownie znacznie szybciej.
- Pamięć starych błędnych odpowiedzi z wersji 16 nie blokuje nowego wyszukiwania (zmieniono wersję klucza pamięci).
- **Nie korzysta z FR24, więc nie zużywa kredytów Flightradar24.** AirLabs ma jednak osobne limity i zasady rozliczania wywołań.

## Ważne ograniczenie darmowego planu

AirLabs dokumentuje pola `built` i `age`, ale **nie gwarantuje ich dostępności w planie Free**. Jeśli zwraca rekord bez tych pól, aplikacja wyświetli „brak dostępu do wieku” zamiast fałszywego wieku. Nie kupuj planu płatnego bez najpierw wykonania testu po kluczu. W razie braku uprawnień do bazy flot konieczny będzie inny dostawca albo plan obejmujący tę bazę.

## Źródła

- https://airlabs.co/docs/fleets
- https://github.com/pigeon318/OpenAirframes
