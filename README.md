# Radar Zaborów 4.0 — Cloudflare Pages

Nowa wersja panelu dla tabletu. Ustawienia pozostają bez zmian:
- Lokalizacja: 52.2629444444 N, 20.6860833333 E (52°15′46,6″ N; 20°41′09,9″ E).
- Promień wpisywany ręcznie (1–200 km), zapamiętywany w przeglądarce.
- Odświeżanie co 30 s bez samolotów; co 10 s, gdy w zasięgu pojawią się samoloty.
- Pozycja, odległość, wysokość i prędkość z sieci ADS-B.
- Modele/rejestracje/przewoźnicy z ADSBdb, nazwy linii i logo jeżeli dostępne.
- Zdjęcia z Planespotters.net (przez bufor ADSB.lol, zapasowo bezpośrednio),
  a w razie braku z danych ADSBdb/airport-data.com. Autor/źródło pod zdjęciem.
- Alarm, powiadomienia i dźwięki są całkowicie wyłączone i usunięte z interfejsu.
- Trasy: preferowane API routeset ADSB.lol, tylko odpowiedzi oznaczone jako
  prawdopodobne i zgodne z prostymi kontrolami geograficznymi; przy braku
  potwierdzenia — „Trasa niepotwierdzona”.

## Aktualizacja w GitHub

W repozytorium https://github.com/kpokonieczny1/radar-zaborow
podmień dwa pliki, zachowując ścieżki:

1. `index.html` — główny katalog repozytorium.
2. `functions/api/flights.js` — podkatalog `functions/api`.

Na GitHubie otwórz plik, kliknij ołówek, wklej kod z nowego pliku i
kliknij „Commit changes”. Zrób tak dla obu plików.
Cloudflare Pages powinien automatycznie opublikować wersję na
https://radar-zaborow.pages.dev/.

Po „Success” na Cloudflare odśwież stronę na tablecie (ew. Ctrl+F5 w PC).
Dodatkowy podgląd danych: https://radar-zaborow.pages.dev/api/flights?radius=30

## Ograniczenia

- Nie ma gwarancji dostępności fotografii dla każdego samolotu, także w przypadku
  prawidłowego działania API. Zapasowe zdjęcia pojawiają się tylko wtedy,
  gdy posiada je ADSBdb.
- Trasy nie są bieżącymi planami lotu. Jeśli nie da się ich wiarygodnie określić,
  nie są wyświetlane. Nie należy wnioskować skąd/dokąd tylko na podstawie bliskości lotniska.
- Dla ochrony bezpłatnych limitów usług rozszerzone metadane są pobierane dla
  maksymalnie 10 najbliższych samolotów w wybranym zasięgu. Pozostałe pozycje
  pojawiają się na radarze, ale mogą nie mieć zdjęć ani trasy.
- API Planespotters.net, ADSB.lol i ADSBdb mogą mieć limity lub przerwy.
- Projekt sprawdzono składniowo i na symulowanych odpowiedziach API.
  Własnego wdrożenia na Cloudflare nie testowano.
