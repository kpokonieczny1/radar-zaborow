// Radar Zaborów 17.2 — wiek samolotu tylko jeśli znaleziono rok produkcji.
// Brak AirLabs, brak FR24, brak wymaganych kluczy API.
// Endpoint: /api/aircraft-age?hex=48E973 (registration jest opcjonalne i ignorowane).
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};
const currentYear = () => new Date().getUTCFullYear();
function yearOrNull(value) {
  if (value == null || value === '') return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 1940 && year <= currentYear() ? year : null;
}
async function fetchJSON(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {accept: 'application/json'},
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  return response.json();
}
async function findAge(hex) {
  // 1. OpenAirframes: rok produkcji z rejestru FAA, gdy jest rekord.
  try {
    const entry = await fetchJSON(`https://api.pigeite.com/aircraft/${hex.toLowerCase()}`, 5000);
    const returnedHex = String(entry?.icao_hex || '').trim().toUpperCase();
    if (returnedHex === hex) {
      const year = yearOrNull(entry?.year_manufactured ?? entry?.year_built);
      if (year !== null) return {year, source: 'OpenAirframes / FAA'};
    }
  } catch { /* źródło nie odpowiada lub nie ma rekordu */ }

  // 2. W publicznym ADSB.lol rok jest opcjonalny; z wielu rekordów go nie dostaniemy.
  try {
    const data = await fetchJSON(`https://api.adsb.lol/v2/hex/${hex}`, 4500);
    const row = (Array.isArray(data?.ac) ? data.ac : [])
      .find(a => String(a?.hex || '').replace(/^~/, '').toUpperCase() === hex);
    const year = yearOrNull(row?.year_built ?? row?.year_manufactured ??
      row?.built_year ?? row?.built ?? row?.year ?? row?.yr);
    if (year !== null) return {year, source: 'ADSB.lol'};
  } catch { /* brak rocznika w dostępnych metadanych */ }

  return null;
}
function json(data, ttlSeconds, status = 200) {
  return new Response(JSON.stringify(data), {status, headers: {
    ...HEADERS, 'cache-control': `public, max-age=${ttlSeconds}`,
  }});
}
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const hex = String(url.searchParams.get('hex') || '').replace(/^~/, '').trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(hex))
    return json({error: 'Nieprawidłowy identyfikator ICAO24.'}, 0, 400);

  // Nowa wersja klucza: wcześniejsze negatywne wyniki AirLabs nie blokują prób.
  const cacheKey = new Request(new URL(`/__radar_aircraft_age_v17_2/${hex}`, url));
  try {
    const cached = await caches?.default?.match(cacheKey);
    if (cached) return cached;
  } catch { /* Cloudflare Cache API jest opcjonalne */ }

  const match = await findAge(hex);
  const year = match?.year ?? null;
  const ttl = year !== null ? 30 * 86400 : 6 * 3600;
  const payload = {
    hex,
    year_built: year,
    age_years: year !== null ? currentYear() - year : null,
    status: year !== null ? 'ok' : 'not_found',
    source: match?.source ?? null,
  };
  const response = json(payload, ttl);
  try {
    if (typeof context.waitUntil === 'function' && typeof caches !== 'undefined' && caches.default)
      context.waitUntil(caches.default.put(cacheKey, response.clone()).catch(() => {}));
  } catch { /* brak cache */ }
  return response;
}
