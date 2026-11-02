// Radar Zaborów 3.0 • Cloudflare Pages Function
// Współrzędne: 52°15'46,6"N 20°41'09,9"E (WGS84)
const LAT = 52.2629444444;
const LON = 20.6860833333;
const MIN_RADIUS_KM = 1;
const MAX_RADIUS_KM = 200;
const ALERT_RADIUS_KM = 10;
const DETAIL_LIMIT = 12;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function distanceKm(lat, lon) {
  const r = Math.PI / 180;
  const a = Math.sin((lat-LAT)*r/2)**2 +
    Math.cos(LAT*r)*Math.cos(lat*r)*Math.sin((lon-LON)*r/2)**2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function sources(radiusKm) {
  const nm = Math.ceil(radiusKm / 1.852) + 1;
  return [
    { name: 'ADSB One', url: `https://api.adsb.one/v2/point/${LAT}/${LON}/${nm}` },
    { name: 'ADSB.lol', url: `https://api.adsb.lol/v2/point/${LAT}/${LON}/${nm}` },
    { name: 'ADSB.fi', url: `https://opendata.adsb.fi/api/v3/lat/${LAT}/lon/${LON}/dist/${nm}` },
  ];
}
async function fetchJson(url, ms=6500) {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(ms),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data === null || typeof data !== 'object') throw new Error('Nieprawidłowy JSON');
  return data;
}
async function readPositions(radiusKm) {
  const errors = [];
  for (const source of sources(radiusKm)) {
    try {
      const response = await fetchJson(source.url, 6500);
      const aircraft = Array.isArray(response.ac) ? response.ac :
        Array.isArray(response.aircraft) ? response.aircraft : null;
      if (!aircraft) throw new Error('Brak tablicy samolotów');
      return { aircraft, source: source.name };
    } catch (error) {
      errors.push(`${source.name}: ${error.message || String(error)}`);
    }
  }
  throw new Error(errors.join(' | '));
}

// W Cloudflare Cache API utrzymujemy szczegóły, by odświeżanie co 10 s
// nie obciążało baz zdjęć, modeli i tras. Poza Cloudflare działa bez cache.
async function lookup(url, key, lifetimeSeconds, baseUrl, ctx, timeoutMs=5000) {
  let cache;
  let cacheRequest;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      cache = caches.default;
      cacheRequest = new Request(new URL(`/__radar_cache/${encodeURIComponent(key)}`, baseUrl));
      const hit = await cache.match(cacheRequest);
      if (hit) return await hit.json();
    }
  } catch { cache = undefined; }

  const value = await fetchJson(url, timeoutMs);
  if (cache && cacheRequest && ctx && typeof ctx.waitUntil === 'function') {
    const copy = new Response(JSON.stringify(value), {
      headers: { 'content-type':'application/json', 'cache-control':`public, max-age=${lifetimeSeconds}` },
    });
    try { ctx.waitUntil(cache.put(cacheRequest, copy).catch(() => {})); } catch { /* cache opcjonalny */ }
  }
  return value;
}
function airport(input) {
  if (!input || typeof input !== 'object') return null;
  return { name: input.name || input.municipality || null,
    code: input.iata_code || input.icao_code || input.iata || input.icao || null };
}
function baseInfo(a) {
  return {
    hex: String(a.hex || '').replace(/^~/,'').trim().toUpperCase(),
    flight: String(a.flight || '').trim().toUpperCase() || null,
    registration: a.r || null,
    model: a.t || null,
    operator: a.ownOp || null,
    airline_iata: null,
    from: null, to: null,
    photo: null,
    lat: a.lat, lon: a.lon,
    km: Math.round(distanceKm(a.lat,a.lon)*10)/10,
    altitude_m: Number.isFinite(a.alt_baro) ? Math.round(a.alt_baro*0.3048) : null,
    speed_kmh: Number.isFinite(a.gs) ? Math.round(a.gs*1.852) : null,
    track: Number.isFinite(a.track) ? a.track : null,
  };
}
function validHttpUrl(url, allowedDomains) {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && allowedDomains.some(d => u.hostname === d || u.hostname.endsWith(`.${d}`))
      ? u.href : null;
  } catch { return null; }
}
function normalizePhoto(data) {
  const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
  if (!photo) return null;
  const thumb = validHttpUrl(photo.thumbnail?.src, ['planespotters.net']);
  const link = validHttpUrl(photo.link, ['planespotters.net']);
  const name = typeof photo.photographer === 'string' ? photo.photographer.trim() :
    (typeof photo.photographer?.name === 'string' ? photo.photographer.name.trim() : '');
  // Zgodnie z zasadami Planespotters.net pokazujemy miniaturę tylko z nazwiskiem autora
  // i linkiem do oryginału. Bez danych do przypisania praw rezygnujemy ze zdjęcia.
  if (!thumb || !link || !name) return null;
  return { thumbnail: thumb, link, photographer: name };
}
async function enrich(a, baseUrl, ctx, allowHexFallback) {
  const item = baseInfo(a);
  const hex = item.hex;
  const callsign = item.flight || '';
  const hasHex = /^[A-F0-9]{6}$/.test(hex);
  const hasCallsign = /^[A-Z0-9]{3,10}$/.test(callsign);
  let plane = {}, route = {};

  if (hasHex) {
    try {
      const path = `https://api.adsbdb.com/v0/aircraft/${hex}` +
        (hasCallsign ? `?callsign=${encodeURIComponent(callsign)}` : '');
      const d = (await lookup(path, `adsbdb-${hex}-${hasCallsign?callsign:'none'}`,
        3600, baseUrl, ctx)).response;
      if (d && typeof d === 'object') { plane = d.aircraft || {}; route = d.flightroute || {}; }
    } catch { /* identyfikacja nie jest konieczna do podania pozycji */ }
  }
  if (!Object.keys(route).length && hasCallsign) {
    try {
      const d = (await lookup(`https://api.adsbdb.com/v0/callsign/${callsign}`,
        `route-${callsign}`, 3600, baseUrl, ctx)).response;
      route = d?.flightroute || {};
    } catch { /* brak danych o trasie */ }
  }
  if (allowHexFallback && hasHex && !plane.type) {
    try {
      const other = await lookup(`https://hexdb.io/api/v2/aircraft/${hex}`,
        `hexdb-${hex}`, 86400, baseUrl, ctx, 4000);
      plane = { ...other, ...plane };
    } catch { /* brak danych */ }
  }
  if (allowHexFallback && hasCallsign && !route.origin && !route.destination) {
    try {
      const other = await lookup(`https://hexdb.io/api/v2/routes/${callsign}`,
        `hexroute-${callsign}`, 3600, baseUrl, ctx, 4000);
      route = { ...other, ...route };
    } catch { /* brak danych */ }
  }

  let photo = null;
  if (hasHex) {
    try {
      const result = await lookup(`https://api.planespotters.net/pub/photos/hex/${hex}`,
        `photo-${hex}`, 86400, baseUrl, ctx, 4500);
      photo = normalizePhoto(result);
    } catch { /* Brak fotografii – pokazujemy symbol samolotu. */ }
  }
  const iata = String(route.airline?.iata || '').trim().toUpperCase();
  return {
    ...item,
    registration: plane.registration || item.registration,
    model: plane.type || item.model,
    operator: route.airline?.name || plane.registered_owner || item.operator,
    airline_iata: /^[A-Z0-9]{2}$/.test(iata) ? iata : null,
    from: airport(route.origin),
    to: airport(route.destination),
    photo,
  };
}

export async function onRequestGet({ request, ctx }) {
  const raw = new URL(request.url).searchParams.get('radius');
  const radius = raw === null ? 10 : Number(raw);
  if (!Number.isFinite(radius) || radius < MIN_RADIUS_KM || radius > MAX_RADIUS_KM ||
      !/^\d+(?:\.\d{1,2})?$/.test(raw ?? '10')) {
    return new Response(JSON.stringify({ error: 'Wpisz promień od 1 do 200 km (maksymalnie 2 miejsca po przecinku).' }),
      { status: 400, headers: HEADERS });
  }
  try {
    const effectiveRadius = Math.max(radius, ALERT_RADIUS_KM);
    const { aircraft, source } = await readPositions(effectiveRadius);
    const withCoords = aircraft.filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon))
      .map(a => ({ a, distance: distanceKm(a.lat,a.lon) }))
      .filter(pair => pair.distance <= effectiveRadius)
      .sort((x,y) => x.distance-y.distance);

    const near10 = withCoords.filter(p => p.distance <= ALERT_RADIUS_KM).map(p => baseInfo(p.a));
    const visible = withCoords.filter(p => p.distance <= radius).map(p => p.a);
    // Cloudflare Workers Free: do 50 outbound subrequests/request. Ograniczamy
    // fallbacky dla większej liczby maszyn, aby nie przekraczać limitu.
    const allowHexFallback = visible.length <= 8;
    const detailed = await Promise.all(visible.slice(0, DETAIL_LIMIT)
      .map(a => enrich(a, request.url, ctx, allowHexFallback)));
    const basic = visible.slice(DETAIL_LIMIT).map(baseInfo);
    return new Response(JSON.stringify({
      updated: new Date().toISOString(),
      center: { lat: LAT, lon: LON },
      radius_km: radius,
      alert_radius_km: ALERT_RADIUS_KM,
      source,
      count: visible.length,
      inside_10km: near10.length,
      nearby_10km: near10.map(f => ({ hex:f.hex, flight:f.flight, registration:f.registration, km:f.km })),
      flights: [...detailed, ...basic],
      notice: 'Pozycje mogą być niepełne. Lotniska i przewoźnicy są odczytywani z baz danych, nie z bieżącego planu lotu.',
    }), { status:200, headers:HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error:'Nie udało się pobrać pozycji samolotów.',
      detail:String(error.message || error) }), { status:502, headers:HEADERS });
  }
}
