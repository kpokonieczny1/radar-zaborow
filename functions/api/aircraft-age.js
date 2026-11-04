// Radar Zaborów 16.0 – bezpłatne informacje o roku produkcji samolotu.
// Pozycje i trasy nie są tu pobierane. Ten endpoint NIE korzysta z FR24.
// Baza OpenAirframes jest na razie oparta przede wszystkim na rejestrze FAA (USA).
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=3600',
  'x-content-type-options': 'nosniff',
};
const validYear = value => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1940 && year <= new Date().getUTCFullYear()
    ? year : null;
};
async function requestJson(url, ms) {
  const response = await fetch(url, {headers:{accept:'application/json'}, signal:AbortSignal.timeout(ms)});
  if (!response.ok) return null;
  return response.json();
}
async function lookup(hex) {
  // 1. OpenAirframes – wiarygodny rok z rejestru FAA, jeśli posiada rekord.
  // Nie odczytujemy i nie przechowujemy nazwisk ani innych danych właścicieli.
  try {
    const data = await requestJson(`https://api.pigeite.com/aircraft/${hex.toLowerCase()}`, 5000);
    if (data && String(data.icao_hex || '').toUpperCase() === hex) {
      const year = validYear(data.year_manufactured ?? data.year_built);
      if (year) return {year_built:year, source:'OpenAirframes / FAA'};
    }
  } catch { /* brak dostępu lub brak samolotu w bazie */ }
  // 2. Metadane samolotu z otwartego odbiornika, o ile dostawca zwraca rok.
  // Jest to jednorazowe zapytanie o daną maszynę, nie cykliczne śledzenie.
  try {
    const data = await requestJson(`https://api.adsb.lol/v2/hex/${hex}`, 4000);
    const match = (Array.isArray(data?.ac) ? data.ac : [])
      .find(a => String(a?.hex || '').replace(/^~/, '').toUpperCase() === hex);
    const year = validYear(match?.year_built ?? match?.built_year ?? match?.year ?? match?.yr);
    if (year) return {year_built:year, source:'ADSB.lol – metadane statku'};
  } catch { /* rok jest opcjonalny */ }
  return {year_built:null, source:null};
}
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const hex = String(url.searchParams.get('hex') || '').trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(hex)) return new Response(JSON.stringify({error:'Niepoprawny identyfikator ICAO24.'}),
    {status:400,headers:{...JSON_HEADERS,'cache-control':'no-store'}});
  const key = new Request(new URL(`/__radar_age_cache_v1/${hex}`,url));
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const hit = await caches.default.match(key);
      if (hit) return hit;
    }
  } catch { /* Cloudflare cache może być niedostępny */ }
  const result = await lookup(hex);
  const payload = JSON.stringify({hex, year_built:result.year_built,
    age_years:result.year_built ? new Date().getUTCFullYear() - result.year_built : null,
    source:result.source,
    note:'Wiek przybliżony, liczony na podstawie roku produkcji, nie daty pierwszego lotu.'});
  const maxAge = result.year_built ? 30 * 86400 : 6 * 3600;
  const response = new Response(payload,{status:200,headers:{...JSON_HEADERS,'cache-control':`public, max-age=${maxAge}`}});
  try {
    if (typeof caches !== 'undefined' && caches.default && typeof context.waitUntil === 'function')
      context.waitUntil(caches.default.put(key,response.clone()).catch(()=>{}));
  } catch { /* bez cache */ }
  return response;
}
