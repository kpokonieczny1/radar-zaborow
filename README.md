# Radar Zaborów 10.0 – ADS-B na żywo + Flightradar24 Sandbox

Projekt Cloudflare Pages. Domyślne centrum: 52.26294444° N, 20.68608333° E.

## Co zostało dodane

Przełącznik źródła: **ADS-B (rzeczywiste loty)** oraz **FR24 Sandbox (dane przykładowe)**.

W trybie ADS-B wszystko działa jak w wersji 9.0: radar, wpisywane współrzędne, promień, zdjęcia, przewoźnicy, odświeżanie co 3 s gdy jest samolot i 30 s gdy nie ma. Trasy pochodzą z dotychczasowych baz i mogą być błędne.

W trybie FR24 Sandbox API udostępnia m.in. `callsign`, `flight`, `orig_iata`, `dest_iata`, `reg` i `type`. Są to **stałe, przykładowe dane**, nie rzeczywiste samoloty nad Zaborowem. Dlatego w tym trybie mapa i ustawienia lokalizacji są ukryte, a informacje o lotach nie odświeżają się automatycznie. Nie łączymy danych testowych FR24 z ADS-B.

## Aktualizacja na GitHubie

1. Rozpakuj archiwum ZIP na komputerze.
2. W repozytorium `https://github.com/kpokonieczny1/radar-zaborow` zamień główny `index.html` na plik z archiwum.
3. W podkatalogu `functions/api/` dodaj nowy plik `fr24.js` z archiwum (GitHub → **Add file → Upload files**).
4. Plik `functions/api/flights.js` dołączyliśmy dla kompletności. Jeśli masz obecnie wersję 9.0, **nie musisz go podmieniać**. Jeśli wgrałeś wcześniejszą wersję, podmień również ten plik.
5. Zatwierdź zmiany przez **Commit changes**.

## Bezpieczne dodanie tokenu FR24 Sandbox w Cloudflare

Nie dodawaj tokenu do GitHuba, `index.html` ani do tekstu rozmowy.

1. Wejdź na `https://dash.cloudflare.com/`.
2. **Workers & Pages → radar-zaborow → Settings → Variables and Secrets** (układ panelu może się różnić).
3. Dodaj nową zmienną jako **Secret**, o nazwie dokładnie `FR24_SANDBOX_TOKEN`.
4. Wklej do niej **pełny token Sandbox** z Key Management portalu Flightradar24, bez dopisywania `Bearer`.
5. Ustaw dla środowiska **Production**, zapisz. W razie potrzeby w zakładce Deployments uruchom nowe wdrożenie albo zrób drobny commit, bo zmiana sekretu może wymagać nowego wdrożenia.
6. Jeśli stary token był widoczny na publicznie udostępnionym zrzucie ekranu, unieważnij go i użyj nowego.

## Test

Po aktualizacji odwiedź:

- `https://radar-zaborow.pages.dev/api/fr24` – surowe **przykładowe** dane JSON z FR24 Sandbox.
- `https://radar-zaborow.pages.dev/` – strona radaru. Wybierz **FR24 Sandbox · test integracji**.

Jeżeli `/api/fr24` zwraca błąd 503 i komunikat o braku tokenu, sprawdź sekret w Cloudflare. Jeśli zwraca 502, sprawdź poprawność tokenu lub dostępność API. W odpowiedzi JSON nie jest ujawniany token.

Sandbox ignoruje współrzędne, promień i czas. Pokazany przykładowy lot `SAS7679 / SK7679` z trasą `ARN → FUE` jest rekordem testowym z dokumentacji, **nie potwierdzeniem aktualnego lotu**.

## Ważne ograniczenia

- Konto Flightradar24 Silver nie daje produkcyjnego dostępu do API. Do rzeczywistych danych FR24 wymagana jest osobna subskrypcja i inny token.
- Wersja 10.0 **nie** odpytuje płatnego API. Jest przygotowaniem do integracji.
- Regulamin FR24 zabrania używania jego API do uzupełniania danych z innego źródła śledzenia ruchu lotniczego. Dlatego tryby są oddzielne. Przy przyszłym wdrożeniu FR24 Live trzeba pobierać dane o locie z FR24, nie wzbogacać danych ADS-B, oraz zadbać o ochronę przed nieautoryzowanymi zapytaniami zużywającymi kredyty.
- Fotografii nie udostępnia podstawowy endpoint FR24; dla dotychczasowego trybu ADS-B zdjęcia pochodzą ze źródeł użytych w wersji 9.0, z ograniczeniami praw do zdjęć.

Dokumentacja: https://fr24api.flightradar24.com/docs/sandbox-environment
