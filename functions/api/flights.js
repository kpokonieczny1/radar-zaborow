// Radar Zaborów 5.0 — Cloudflare Pages Functions
// Dokładny punkt: 52°15′46,6″ N, 20°41′09,9″ E
const LAT = 52.2629444444;
const LON = 20.6860833333;
const DETAIL_LIMIT = 10;
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

function distanceKm(lat, lon, refLat = LAT, refLon = LON) {
  const r = Math.PI / 180;
  const a = Math.sin((lat - refLat) * r / 2) ** 2
    + Math.cos(refLat * r) * Math.cos(lat * r) * Math.sin((lon - refLon) * r / 2) ** 2;
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
async function fetchJson(url, options = {}, timeoutMs = 6500) {
  const response = await fetch(url, {
    ...options,
    headers: { 'accept': 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function positions(radiusKm) {
  const problems = [];
  for (const entry of sources(radiusKm)) {
    try {
      const raw = await fetchJson(entry.url);
      const aircraft = Array.isArray(raw.ac) ? raw.ac : (Array.isArray(raw.aircraft) ? raw.aircraft : null);
      if (!aircraft) throw new Error('Brak listy samolotów');
      return { aircraft, source: entry.name };
    } catch (error) {
      problems.push(`${entry.name}: ${String(error.message || error)}`);
    }
  }
  throw new Error(problems.join(' | '));
}

// Przechowuj metadane przez Cloudflare Cache API (w Pages waitUntil jest w context,
// nie w context.ctx). Cache nie jest warunkiem działania strony.
async function cachedJson(url, cacheKey, ttlSeconds, context, timeout = 4500) {
  let cache = null;
  let cacheRequest = null;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      cache = caches.default;
      cacheRequest = new Request(new URL(`/__radar_cache_v4/${encodeURIComponent(cacheKey)}`, context.request.url));
      const hit = await cache.match(cacheRequest);
      if (hit) return hit.json();
    }
  } catch { cache = null; }
  const result = await fetchJson(url, {}, timeout);
  if (cache && cacheRequest && typeof context.waitUntil === 'function') {
    try {
      context.waitUntil(cache.put(cacheRequest, new Response(JSON.stringify(result), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSeconds}` },
      })).catch(() => {}));
    } catch { /* cache opcjonalny */ }
  }
  return result;
}

function httpUrl(value, hosts) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return null;
    return url.href;
  } catch { return null; }
}
function fromPlanespotters(json) {
  const p = Array.isArray(json?.photos) ? json.photos[0] : null;
  if (!p) return null;
  const thumb = httpUrl(p.thumbnail_large?.src || p.thumbnail?.src,
    ['planespotters.net', 'plnspttrs.net']);
  const link = httpUrl(p.link, ['planespotters.net']);
  const photographer = String(typeof p.photographer === 'string' ? p.photographer
    : (p.photographer?.name || '')).trim();
  if (!thumb || !link) return null;
  return { thumbnail: thumb, link, photographer, source: 'Planespotters.net' };
}
function fromAdsbdb(plane) {
  const thumb = httpUrl(plane?.url_photo_thumbnail || plane?.url_photo, ['airport-data.com']);
  const link = httpUrl(plane?.url_photo || plane?.url_photo_thumbnail, ['airport-data.com']);
  return thumb && link ? { thumbnail: thumb, link, photographer: null,
    source: 'airport-data.com / ADSBdb' } : null;
}
function baseInfo(a) {
  return {
    hex: String(a.hex || '').replace(/^~/, '').trim().toUpperCase(),
    flight: String(a.flight || '').trim().toUpperCase() || null,
    registration: a.r || null,
    model: a.t || null,
    operator: a.ownOp || null,
    airline_iata: null, from: null, to: null, photo: null,
    lat: a.lat, lon: a.lon,
    km: Math.round(distanceKm(a.lat, a.lon) * 10) / 10,
    altitude_m: Number.isFinite(a.alt_baro) ? Math.round(a.alt_baro * 0.3048) : null,
    speed_kmh: Number.isFinite(a.gs) ? Math.round(a.gs * 1.852) : null,
    track: Number.isFinite(a.track) ? a.track : null,
    // ADS-B vertical speed is feet/min; used for basic sanity checking of route.
    vertical_fpm: Number.isFinite(a.baro_rate) ? a.baro_rate :
      (Number.isFinite(a.geom_rate) ? a.geom_rate : null),
  };
}
function airport(src) {
  if (!src || typeof src !== 'object') return null;
  return { name: src.name || src.location || src.municipality || null,
    code: src.iata || src.iata_code || src.icao || src.icao_code || null,
    lat: Number.isFinite(src.lat) ? src.lat :
      (Number.isFinite(src.latitude) ? src.latitude : null),
    lon: Number.isFinite(src.lon) ? src.lon :
      (Number.isFinite(src.longitude) ? src.longitude : null),
  };
}
function sensibleRoute(record, flight) {
  if (record?.plausible !== true || !Array.isArray(record?._airports)) return null;
  const from = airport(record._airports[0]);
  const to = airport(record._airports[record._airports.length - 1]);
  if (!from || !to || !from.code || !to.code) return null;
  const startDist = Number.isFinite(from.lat) && Number.isFinite(from.lon)
    ? distanceKm(flight.lat, flight.lon, from.lat, from.lon) : null;
  const endDist = Number.isFinite(to.lat) && Number.isFinite(to.lon)
    ? distanceKm(flight.lat, flight.lon, to.lat, to.lon) : null;
  // Nisko nad Warszawą? Nie pokazuj trasy odległej od obu lotnisk.
  if (flight.altitude_m !== null && flight.altitude_m < 3500) {
    if (startDist !== null && endDist !== null && Math.min(startDist, endDist) > 85) return null;
    // Gdy maszyna wyraźnie się wznosi, nie jest właśnie u celu odległego o setki km.
    if (flight.vertical_fpm !== null && flight.vertical_fpm > 250 &&
        startDist !== null && startDist > 100 && endDist !== null && endDist < 85) return null;
    // Analogicznie podczas wyraźnego schodzenia.
    if (flight.vertical_fpm !== null && flight.vertical_fpm < -250 &&
        endDist !== null && endDist > 100 && startDist !== null && startDist < 85) return null;
  }
  return { from, to };
}
async function routesFor(planes) {
  const requests = planes.filter(p => /^[A-Z0-9]{3,10}$/.test(p.flight || ''))
    .map(p => ({ callsign: p.flight, lat: p.lat, lng: p.lon }));
  if (!requests.length) return new Map();
  try {
    const answer = await fetchJson('https://api.adsb.lol/api/0/routeset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planes: requests }),
    }, 5000);
    const rows = Array.isArray(answer) ? answer : [];
    return new Map(rows.filter(r => typeof r?.callsign === 'string')
      .map(r => [r.callsign.trim().toUpperCase(), r]));
  } catch { return new Map(); }
}
async function detailsFor(a, routeIndex, context) {
  const p = baseInfo(a);
  const hex = p.hex;
  const hasHex = /^[A-F0-9]{6}$/.test(hex);
  const callsign = p.flight || '';
  const validCallsign = /^[A-Z0-9]{3,10}$/.test(callsign);
  let plane = {};
  let oldRoute = {};
  if (hasHex) {
    try {
      const query = validCallsign ? `?callsign=${encodeURIComponent(callsign)}` : '';
      const raw = await cachedJson(`https://api.adsbdb.com/v0/aircraft/${hex}${query}`,
        `db-${hex}-${callsign || 'none'}`, 21600, context);
      plane = raw?.response?.aircraft || {};
      oldRoute = raw?.response?.flightroute || {};
    } catch { /* samolot może nie istnieć w bazie */ }
  }
  const fromDB = fromAdsbdb(plane);
  let photo = null;
  if (hasHex) {
    // Publiczny bufor ADSB.lol chroni przed blokadami Planespotters.net po stronie Cloudflare.
    for (const [url, cacheKey] of [
      [`https://api.adsb.lol/0/planespotters_net/hex/${hex}`, `ps-proxy-${hex}`],
      [`https://api.planespotters.net/pub/photos/hex/${hex}`, `ps-direct-${hex}`],
    ]) {
      try {
        const data = await cachedJson(url, cacheKey, 86400, context);
        photo = fromPlanespotters(data);
        if (photo) break;
      } catch { /* spróbuj kolejne źródło */ }
    }
  }
  // Nie każdy odbiornik raportuje poprawnie hex; drugi krok po rejestracji
  // umożliwia odnalezienie zdjęć, gdy po ICAO24 nie ma wyniku.
  const reg = String(plane.registration || p.registration || '').trim().toUpperCase();
  if (!photo && /^[A-Z0-9-]{3,12}$/.test(reg)) {
    try {
      const data = await cachedJson(
        `https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`,
        `ps-reg-${reg}`, 86400, context, 4500);
      photo = fromPlanespotters(data);
    } catch { /* API może blokować żądania, nie psuj radaru */ }
  }
  photo = photo || fromDB;
  const route = sensibleRoute(routeIndex.get(callsign), p);
  const iata = String(oldRoute?.airline?.iata || '').trim().toUpperCase();
  return {
    ...p,
    registration: plane.registration || p.registration,
    model: plane.type || p.model,
    operator: oldRoute?.airline?.name || plane.registered_owner || p.operator,
    airline_iata: /^[A-Z0-9]{2}$/.test(iata) ? iata : null,
    from: route?.from || null,
    to: route?.to || null,
    route_verified: Boolean(route),
    photo,
    photo_fallback: photo?.source === 'Planespotters.net' ? fromDB : null,
  };
}

export async function onRequestGet(context) {
  const { request } = context;
  const raw = new URL(request.url).searchParams.get('radius') ?? '10';
  const radius = Number(raw);
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isFinite(radius) || radius < 1 || radius > 200) {
    return new Response(JSON.stringify({ error: 'Podaj promień 1–200 km (do dwóch miejsc po przecinku).' }),
      { status: 400, headers: JSON_HEADERS });
  }
  try {
    const effectiveRadius = Math.max(radius, 10);
    const { aircraft, source } = await positions(effectiveRadius);
    const valid = aircraft.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map(p => ({ p, dist: distanceKm(p.lat, p.lon) }))
      .filter(x => x.dist <= effectiveRadius).sort((x, y) => x.dist - y.dist);
    const visible = valid.filter(x => x.dist <= radius).map(x => x.p);
    const routeIndex = await routesFor(visible.slice(0, DETAIL_LIMIT).map(baseInfo));
    const detailed = await Promise.all(visible.slice(0, DETAIL_LIMIT)
      .map(p => detailsFor(p, routeIndex, context)));
    const basic = visible.slice(DETAIL_LIMIT).map(baseInfo);
    return new Response(JSON.stringify({
      updated: new Date().toISOString(),
      center: { lat: LAT, lon: LON }, radius_km: radius, source,
      count: visible.length, inside_10km: valid.filter(x => x.dist <= 10).length,
      flights: [...detailed, ...basic],
      notice: 'Trasy tylko wtedy, gdy zewnętrzna baza uznaje je za prawdopodobne; nie są potwierdzonym planem lotu.',
    }), { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Nie udało się pobrać samolotów.',
      detail: String(error.message || error) }), { status: 502, headers: JSON_HEADERS });
  }
}
