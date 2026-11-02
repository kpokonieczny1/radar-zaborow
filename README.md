# Radar Zaborów (10 km)

Tabletowa strona www wykorzystująca ADSB.fi (pozycje) i ADSBdb (typ, linia, trasa). Dane nie są gwarantowane dla wszystkich samolotów. Promień dotyczy odległości poziomej.

## Wdrożenie przez GitHub + Cloudflare Pages
1. Załóż nowe PUBLICZNE lub prywatne repozytorium w GitHub (np. radar-zaborow).
2. Prześlij do głównego katalogu repozytorium **index.html** oraz folder **functions** z zawartością.
3. W Cloudflare: Workers & Pages → Create → Pages → Connect to Git, wybierz repozytorium.
4. Framework preset: None; build command: pozostaw pustą; build output directory: `/` (root), jeśli interfejs wymaga wpisu użyj `.`.
5. Wdróż. Otwórz otrzymany adres `*.pages.dev` na tablecie.
6. Do pracy ciągłej włącz w tablecie tryb kiosku / nie usypiaj ekranu i skonfiguruj bezpieczne zasilanie.

**Uwaga:** Wersja wykorzystuje Pages Functions, więc samo przesłanie ZIP-a przez Direct Upload w panelu Cloudflare nie wdroży API. Wymagane jest wdrożenie z Git lub Wrangler.

## API własnej strony
`https://TWOJ-ADRES.pages.dev/api/flights`

## Szczegóły
- Środek: 52.2634 N, 20.6845 E (przybliżony środek Zaborowa, nie adres domu).
- Promień 10 km (ADSB.fi 5.4 NM, dodatkowo dokładny filtr Haversine).
- Ekran odświeża dane co 30 s.
- Jeśli API ADSBdb nie znajdzie lotu, wyświetla „Brak danych”.
- W przypadku większego ruchu brane jest do 25 najbliższych samolotów, aby ograniczyć obciążenie API.
- Zewnętrzne serwisy mogą limitować zapytania; jeśli tak się stanie, aplikacja pokaże błąd.
- Warto sprawdzić aktualne warunki korzystania z API przed publicznym udostępnieniem strony.

Źródła: https://github.com/adsbfi/opendata ; https://adsbdb.com/ ; https://developers.cloudflare.com/pages/functions/get-started/
