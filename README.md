# Radar Zaborów 18.0 – przyciemniony podkład OSM

Aktualizacja po wersji 17.2: **podmień tylko plik `index.html`** w głównym katalogu repozytorium `kpokonieczny1/radar-zaborow` i zatwierdź Commit changes. Cloudflare Pages wdroży go automatycznie. Pozostałe pliki `functions/api/*.js`, tokeny i ustawienia FR24 pozostają bez zmian.

## Zmiana
- Pod okręgami i samolotami rysowane są kafelki OpenStreetMap, przyciemnione i odbarwione, aby nie konkurowały z symbolami lotów.
- Radar pozostaje skierowany na północ, a ikony samolotów zachowują obrót zgodny z kursem ADS-B.
- Znaczniki WAW/EPWA oraz QPB/EPBC nadal są widoczne, gdy mieszczą się w promieniu.
- Kafelki zmieniają się tylko po zmianie współrzędnych środka albo promienia; szybkie odświeżanie pozycji nie powoduje przeładowania mapy.
- Wyświetlana jest wymagana atrybucja © OpenStreetMap contributors.

## Uwagi
Do pobrania podkładu tablet musi mieć internet. Gdy mapy nie da się pobrać, pozostaje ciemne tło i aktywna warstwa radaru. Nie pobieramy kafelków masowo ani offline. Warunki użytkowania: https://operations.osmfoundation.org/policies/tiles/.

Przetestuj w przeglądarce po aktualizacji i użyj Ctrl+F5 przy wyświetleniu starej wersji. Na urządzeniu Android odśwież stronę lub zamknij i ponownie uruchom kartę.
