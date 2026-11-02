# Radar Zaborów 6.0 – trasy i odświeżanie co 3 sekundy

Cloudflare Pages + funkcja serverless. Punkt obserwacyjny: **52.26294444 N, 20.68608333 E**.

## Co się zmieniło

- **3 s** między odczytami pozycji, gdy w ustawionym promieniu widać co najmniej jeden samolot; **30 s**, gdy nie ma samolotów. Po błędzie odczekuje 30 s.
- Metadane lotów (trasy, rejestracje, zdjęcia) są pobierane osobno, znacznie rzadziej, maksymalnie co 90 s dla znanych maszyn, lub po co najmniej 15 s od poprzedniej próby, jeśli pojawią się nowe. Dzięki temu obraz i logo nie migają co 3 s, a serwisy zewnętrzne nie są niepotrzebnie obciążane.
- Przebudowana logika tras: ADSB.lol `routeset` + ADSBdb, opcjonalnie HexDB. W pobliżu lotniska bierze pod uwagę wysokość, odległość i prędkość pionową oraz kierunek lotu. Gdy źródła są sprzeczne lub nie pozwalają sensownie określić trasy, karta pokazuje „Nieustalona”. Wyświetlone trasy są **orientacyjne** i nie stanowią potwierdzonego planu lotu.
- Usunięto dodatkowe linki do galerii JetPhotos i przyciski z kart samolotów, a także linki z dolnej belki. Miniatura z Planespotters.net jest wciąż łączem do oryginalnego zdjęcia (wymagane przez warunki dostawcy) i ma podpis autora. To nie jest osobny przycisk ani widoczny link tekstowy.
- Zachowano wpisywanie własnego promienia 1–200 km, radar, logotypy, zdjęcia i widoczną strefę 10 km. Nie ma alarmu.

## Instalacja

W repozytorium `kpokonieczny1/radar-zaborow` zastąp dwa pliki:

1. Plik główny `index.html`.
2. `functions/api/flights.js`.

Zatwierdź zmiany (**Commit changes**). Cloudflare Pages wdroży je automatycznie. Po zakończeniu otwórz https://radar-zaborow.pages.dev/ i zrób Ctrl+F5.

## Testowanie

- **Pozycje bez obciążających dodatków**: `https://radar-zaborow.pages.dev/api/flights?radius=20&mode=positions`
- **Pozycje + trasy + zdjęcia**: `https://radar-zaborow.pages.dev/api/flights?radius=20&mode=full`

Przy działającym połączeniu pierwszy endpoint zwraca `count`, `flights`, `inside_10km`; drugi dodatkowo pola `from`, `to`, `route_status`, `photo`. Kiedy nie ma danych o trasie, pola `from` i `to` będą `null` – to uczciwsze niż błędny kierunek lotu.

## Ważne ograniczenia

- 3 sekundy to częstotliwość **prób odświeżenia**. Dane ADS-B niekoniecznie zmieniają się tak szybko, a gdy serwer lub dostawca ogranicza ruch (np. 429/403), aplikacja zwalnia do 30 s. Jeżeli ruch na tablecie byłby stale aktywny przez całą dobę, oznacza to do ok. 28 800 odczytów pozycji dziennie; trzeba respektować regulaminy dostawców i ich zmienne limity API.
- Po zablokowaniu/uśpieniu tabletu przeglądarka może zawiesić JavaScript.
- Jedna fotografia SP-LYI pochodzi z ręcznie wskazanego odnośnika JetPhotos i może być niedostępna w trybie osadzania. **Przed jej publicznym eksponowaniem należy upewnić się, że fotograf udzielił zgody lub zastosować dozwoloną formę osadzania**. Można usunąć wpis `SP-LYI` w obiekcie `USER_PHOTOS` w `index.html`, aby go wyłączyć.
- Żaden otwarty katalog tras nie gwarantuje aktualnej trasy danego rejsu. Pełna zgodność z Flightradar24 wymaga odrębnego źródła danych/licencji.
