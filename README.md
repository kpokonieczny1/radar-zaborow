# Radar Zaborów 5.0 — zdjęcia i galerie JetPhotos

Wersja oparta na Radarze Zaborów 4.0. Zachowuje radar, trasę (jeśli potwierdzona), promień wpisywany ręcznie oraz odświeżanie 30/10 s. Nie dodaje alarmu.

## Co zmieniono

- Dla samolotu **SP-LYI** dostępny jest podany przez użytkownika odnośnik do fotografii [JetPhotos #12226928](https://www.jetphotos.com/photo/12226928) (fot. Paweł Cieplak). Przeglądarka ładuje zdjęcie bezpośrednio z CDN JetPhotos — nie zapisujemy kopii na Cloudflare ani w repozytorium. Jeśli serwer nie zezwoli na obraz na cudzej stronie, pokaże się awaryjna miniatura lub link do galerii.
- Dla innych samolotów strona wyświetla miniaturę z **Planespotters.net** lub **ADSBdb**, jeśli uda się pobrać, a zawsze również link do galerii JetPhotos po numerze rejestracyjnym.
- API próbuje też wyszukiwać miniatury w Planespotters po numerze rejestracyjnym, jeśli brak zdjęcia po identyfikatorze hex.
- Rozpoznawanie podstawowych linii po prefiksie znaku wywoławczego (LOT, RYR, WZZ itp.) działa także bez danych operatora z ADSBdb.

**Ograniczenie:** JetPhotos nie ma tu podłączonego oficjalnego publicznego API wyszukiwania fotografii. Samo podanie URL JetPhotos nie umożliwia automatycznej obsługi wszystkich samolotów. Ich serwery mogą blokować hotlinkowanie, a publiczna prezentacja zdjęć wymaga respektowania warunków autora; na karcie wskazanego zdjęcia jest napisane „Contact photographer for terms of use”. Aby korzystać ze zdjęcia na publicznej stronie, poproś o zgodę autora lub użyj udostępnianej przez portal opcji osadzania, o ile pozwala na takie zastosowanie.

## Aktualizacja

1. Podmień `index.html` w głównym katalogu repozytorium.
2. Podmień `functions/api/flights.js` w katalogu `functions/api/`.
3. Kliknij **Commit changes**. Cloudflare Pages automatycznie wdroży nową wersję.
4. Otwórz `https://radar-zaborow.pages.dev/`, ewentualnie odśwież `Ctrl+F5`.

Bezpośrednie zdjęcie SP-LYI i pozostałe odnośniki nie stanowią gwarancji dostępności fotografii na stronie. Jeśli dostęp do CDN wymaga zgody właściciela, wyłącz wpis w stałej `JETPHOTOS_VERIFIED` w pliku `index.html`.
