// Radar Zaborów 6.0 · Cloudflare Pages Function
// Współrzędne: 52°15′46,6″ N, 20°41′09,9″ E
// ?radius=20&mode=positions -> szybkie pozycje, bez odpytywania baz zdjęć/tras
// ?radius=20&mode=full      -> pozycje + metadane, odpytywane rzadziej przez przeglądarkę
const HOME = Object.freeze({ lat: 52.2629444444, lon: 20.6860833333 });
const MAX_DETAILS = 15;
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const PROVIDERS = [
  km => ({ name: 'ADSB One', url: `https://api.adsb.one/v2/point/${HOME.lat}/${HOME.lon}/${Math.ceil(km / 1.852) + 1}` }),
  km => ({ name: 'ADSB.lol', url: `https://api.adsb.lol/v2/point/${HOME.lat}/${HOME.lon}/${Math.ceil(km / 1.852) + 1}` }),
  km => ({ name: 'ADSB.fi', url: `https://opendata.adsb.fi/api/v3/lat/${HOME.lat}/lon/${HOME.lon}/dist/${Math.ceil(km / 1.852) + 1}` }),
];
const AIRLINES = {
  LOT: ['LOT Polish Airlines', 'LO'], RYR: ['Ryanair', 'FR'], WZZ: ['Wizz Air', 'W6'],
  DLH: ['Lufthansa', 'LH'], BAW: ['British Airways', 'BA'], KLM: ['KLM', 'KL'],
  AFR: ['Air France', 'AF'], UAE: ['Emirates', 'EK'], THY: ['Turkish Airlines', 'TK'],
  SAS: ['Scandinavian Airlines', 'SK'], EZY: ['easyJet', 'U2'], ENT: ['Enter Air', 'E4'],
};
const AIRPORT_COORDS = {
  WAW: [52.1657, 20.9671], WMI: [52.4511, 20.6517], KRK: [50.0777, 19.7848],
};
const num = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const clean = value => typeof value === 'string' ? value.trim() : '';

function kmBetween(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function distanceHome(lat, lon) { return kmBetween(HOME.lat, HOME.lon, lat, lon); }
function bearing(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180, dLon = (bLon - aLon) * r;
  const y = Math.sin(dLon) * Math.cos(bLat * r);
  const x = Math.cos(aLat * r) * Math.sin(bLat * r) - Math.sin(aLat * r) * Math.cos(bLat * r) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function angleDifference(a, b) { return Math.abs(((a - b + 540) % 360) - 180); }

async function jsonFetch(url, options = {}, timeout = 5000) {
  const response = await fetch(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function firstPositions(km) {
  const errors = [];
  for (const makeProvider of PROVIDERS) {
    const provider = makeProvider(km);
    try {
      const result = await jsonFetch(provider.url, {}, 4500);
      const list = Array.isArray(result?.ac) ? result.ac : result?.aircraft;
      if (!Array.isArray(list)) throw new Error('Nieznana odpowiedź API');
      return { list, source: provider.name };
    } catch (error) { errors.push(`${provider.name}: ${error.message}`); }
  }
  throw new Error(errors.join(' | '));
}

// Cache API pomaga, ale poprawność działania nie zależy od tego, czy cache jest dostępny.
async function cachedJson(context, key, ttlSeconds, load) {
  let cache, request;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      cache = caches.default;
      request = new Request(new URL('/__radar_cache_v6/' + encodeURIComponent(key), context.request.url));
      const saved = await cache.match(request);
      if (saved) return saved.json();
    }
  } catch { cache = null; }
  const value = await load();
  if (cache && request && typeof context.waitUntil === 'function') {
    try {
      context.waitUntil(cache.put(request, new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${ttlSeconds}` },
      })).catch(() => {}));
    } catch { /* brak cache */ }
  }
  return value;
}

function normalizeAircraft(raw) {
  const lat = num(raw?.lat), lon = num(raw?.lon);
  if (lat === null || lon === null) return null;
  const callsign = clean(raw.flight).toUpperCase();
  const hex = clean(raw.hex).replace(/^~/, '').toUpperCase();
  const airline = AIRLINES[callsign.slice(0, 3)];
  return {
    hex, flight: callsign || null, registration: clean(raw.r) || null,
    model: clean(raw.t) || null, operator: airline?.[0] || clean(raw.ownOp) || null,
    airline_iata: airline?.[1] || null,
    lat, lon, km: Math.round(distanceHome(lat, lon) * 10) / 10,
    altitude_m: num(raw.alt_baro) === null ? null : Math.round(raw.alt_baro * 0.3048),
    speed_kmh: num(raw.gs) === null ? null : Math.round(raw.gs * 1.852),
    track: num(raw.track), vertical_fpm: num(raw.baro_rate) ?? num(raw.geom_rate),
  };
}
function airport(value) {
  if (!value || typeof value !== 'object') return null;
  const code = clean(value.iata_code || value.iata || value.icao_code || value.icao).toUpperCase();
  const coords = AIRPORT_COORDS[code];
  return {
    code: code || null, name: clean(value.name || value.location || value.municipality) || null,
    lat: num(value.lat) ?? num(value.latitude) ?? coords?.[0] ?? null,
    lon: num(value.lon) ?? num(value.longitude) ?? coords?.[1] ?? null,
  };
}
function buildRoute(from, to, source, plausible = false) {
  const start = airport(from), end = airport(to);
  if (!start?.code || !end?.code || start.code === end.code) return null;
  return { from: start, to: end, source, plausible };
}
function routeFromLol(row) {
  const airports = row?._airports;
  if (!Array.isArray(airports) || airports.length < 2) return null;
  return buildRoute(airports[0], airports[airports.length - 1], 'ADSB.lol', row.plausible === true);
}
function routeFromDb(value) {
  return buildRoute(value?.origin, value?.destination, 'ADSBdb');
}
function routeFromHexdb(value) {
  return buildRoute(value?.origin || value?.from, value?.destination || value?.to, 'HexDB');
}

// ADS-B nie przenosi tras. Ocena jakości nie jest potwierdzeniem planu lotu.
// Przy niskim locie nad Zaborowem wymagamy powiązania z pobliskim lotniskiem.
function routeScore(route, plane) {
  if (!route) return -Infinity;
  const point = a => num(a.lat) !== null && num(a.lon) !== null
    ? kmBetween(plane.lat, plane.lon, a.lat, a.lon) : null;
  const start = point(route.from), end = point(route.to);
  const altitude = plane.altitude_m;
  const low = altitude !== null && altitude < 5000;
  const knownDistances = [start, end].filter(d => d !== null);
  if (low && (!knownDistances.length || Math.min(...knownDistances) > 110)) return -Infinity;
  let score = route.plausible ? 3 : 0;
  if (route.source === 'ADSB.lol') score += 1;
  if (knownDistances.length) {
    const nearby = Math.min(...knownDistances);
    if (nearby <= 35) score += 5;
    else if (nearby <= 65) score += 3;
    else if (nearby <= 110) score += 1;
  }
  const climb = plane.vertical_fpm;
  if (low && climb !== null && Math.abs(climb) > 200 && start !== null && end !== null) {
    const departure = climb > 0;
    const nearExpected = departure ? start : end;
    const nearUnexpected = departure ? end : start;
    if (nearExpected < 70) score += 4;
    if (nearUnexpected < 45 && nearExpected > 110) return -Infinity;
    if (plane.track !== null && nearExpected < 90) {
      const field = departure ? route.from : route.to;
      const expectedTrack = departure
        ? bearing(field.lat, field.lon, plane.lat, plane.lon)
        : bearing(plane.lat, plane.lon, field.lat, field.lon);
      const diff = angleDifference(plane.track, expectedTrack);
      if (diff < 65) score += 2;
      else if (diff > 145 && nearExpected > 12) score -= 2;
    }
  }
  // Na dużej wysokości pojedyncza niepotwierdzona trasa jest zbyt słabym dowodem.
  if (!low && !route.plausible) score -= 2;
  return score;
}
function pickRoute(candidates, plane) {
  const scored = candidates.filter(Boolean).map(route => ({ route, score: routeScore(route, plane) }))
    .filter(x => Number.isFinite(x.score)).sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  const best = scored[0];
  const matches = scored.filter(x => x.route.from.code === best.route.from.code
    && x.route.to.code === best.route.to.code).length;
  if (matches > 1) best.score += 3;
  // Konflikt dwóch podobnie wiarygodnych tras: nie zgaduj celu podróży.
  const conflict = scored.find(x => (x.route.from.code !== best.route.from.code
    || x.route.to.code !== best.route.to.code) && x.score >= best.score - 1.5);
  if (conflict && matches < 2) return null;
  if (best.score < 4) return null;
  return { from: best.route.from, to: best.route.to,
    route_status: matches > 1 || best.route.plausible ? 'prawdopodobna' : 'orientacyjna',
    route_source: best.route.source };
}

function allowedUrl(value, domains) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && domains.some(d => url.hostname === d || url.hostname.endsWith('.' + d))
      ? url.href : null;
  } catch { return null; }
}
function photoFromPlanespotters(data) {
  const row = Array.isArray(data?.photos) ? data.photos[0] : null;
  if (!row) return null;
  const thumb = allowedUrl(row.thumbnail_large?.src || row.thumbnail?.src, ['planespotters.net', 'plnspttrs.net']);
  const page = allowedUrl(row.link, ['planespotters.net']);
  if (!thumb || !page) return null;
  return { thumbnail: thumb, link: page,
    photographer: clean(row.photographer?.name || row.photographer) || 'Autor fotografii',
    source: 'Planespotters.net' };
}
function photoFromDb(row) {
  const thumbnail = allowedUrl(row?.url_photo_thumbnail || row?.url_photo, ['airport-data.com']);
  const link = allowedUrl(row?.url_photo || row?.url_photo_thumbnail, ['airport-data.com']);
  return thumbnail && link ? { thumbnail, link, photographer: '', source: 'airport-data.com' } : null;
}

async function routeRows(planes, context) {
  const flights = planes.filter(p => /^[A-Z0-9]{3,10}$/.test(p.flight || ''));
  if (!flights.length) return new Map();
  // Prośba o nowe trasy co ~90 s, nie co 3 s. Punkt jest zaokrąglony
  // do 0,1°, żeby lot w ruchu nie unieważniał cache za każdym odświeżeniem.
  const key = flights.map(p => `${p.flight}:${p.lat.toFixed(1)}:${p.lon.toFixed(1)}`).sort().join('|');
  try {
    const rows = await cachedJson(context, `routes:${key}`, 90, () => jsonFetch(
      'https://api.adsb.lol/api/0/routeset', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planes: flights.map(p => ({ callsign: p.flight, lat: p.lat, lng: p.lon })) }),
      }, 6000));
    return new Map((Array.isArray(rows) ? rows : []).filter(row => clean(row.callsign))
      .map(row => [clean(row.callsign).toUpperCase(), row]));
  } catch { return new Map(); }
}

async function enrich(plane, lol, context) {
  const hex = plane.hex;
  const callsign = plane.flight || '';
  let rawDb = {}, rawHexdb = {};
  if (/^[A-F0-9]{6}$/.test(hex)) {
    try {
      const suffix = /^[A-Z0-9]{3,10}$/.test(callsign) ? `?callsign=${encodeURIComponent(callsign)}` : '';
      rawDb = await cachedJson(context, `adsbdb:${hex}:${callsign}`, 3600,
        () => jsonFetch(`https://api.adsbdb.com/v0/aircraft/${hex}${suffix}`, {}, 4500));
    } catch { /* bez danych bazy */ }
  }
  const dbPlane = rawDb?.response?.aircraft || {};
  let dbRoute = rawDb?.response?.flightroute || null;
  if (!dbRoute && /^[A-Z0-9]{3,10}$/.test(callsign)) {
    try {
      const raw = await cachedJson(context, `route-db:${callsign}`, 900,
        () => jsonFetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, {}, 4500));
      dbRoute = raw?.response?.flightroute || null;
    } catch { /* brak */ }
  }
  if (!lol && !dbRoute && /^[A-Z0-9]{3,10}$/.test(callsign)) {
    try {
      rawHexdb = await cachedJson(context, `hex-route:${callsign}`, 1200,
        () => jsonFetch(`https://hexdb.io/api/v2/routes/${encodeURIComponent(callsign)}`, {}, 3500));
    } catch { /* brak */ }
  }
  const route = pickRoute([routeFromLol(lol), routeFromDb(dbRoute), routeFromHexdb(rawHexdb)], plane);
  const iata = clean(dbRoute?.airline?.iata).toUpperCase();
  const photoDb = photoFromDb(dbPlane);
  let photo = null;
  if (/^[A-F0-9]{6}$/.test(hex)) {
    for (const [key, url] of [
      [`lolphoto:${hex}`, `https://api.adsb.lol/0/planespotters_net/hex/${hex}`],
      [`psphoto:${hex}`, `https://api.planespotters.net/pub/photos/hex/${hex}`],
    ]) {
      try {
        photo = photoFromPlanespotters(await cachedJson(context, key, 86400, () => jsonFetch(url, {}, 4500)));
        if (photo) break;
      } catch { /* kolejne źródło */ }
    }
  }
  const reg = clean(dbPlane.registration || plane.registration).toUpperCase();
  if (!photo && /^[A-Z0-9-]{3,12}$/.test(reg)) {
    try {
      photo = photoFromPlanespotters(await cachedJson(context, `regphoto:${reg}`, 86400,
        () => jsonFetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`, {}, 4500)));
    } catch { /* brak */ }
  }
  const caller = AIRLINES[callsign.slice(0, 3)];
  return {
    ...plane,
    registration: clean(dbPlane.registration) || plane.registration,
    model: clean(dbPlane.type) || plane.model,
    operator: caller?.[0] || clean(dbRoute?.airline?.name) || clean(dbPlane.registered_owner) || plane.operator,
    airline_iata: caller?.[1] || (/^[A-Z0-9]{2}$/.test(iata) ? iata : plane.airline_iata),
    from: route?.from || null, to: route?.to || null,
    route_status: route?.route_status || null, route_source: route?.route_source || null,
    photo: photo || photoDb, photo_fallback: photo && photoDb ? photoDb : null,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawRadius = url.searchParams.get('radius') ?? '10';
  const radius = Number(rawRadius);
  const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'positions';
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawRadius) || !Number.isFinite(radius)
      || radius < 1 || radius > 200) {
    return new Response(JSON.stringify({ error: 'Promień musi wynosić od 1 do 200 km.' }),
      { status: 400, headers: HEADERS });
  }
  try {
    const effective = Math.max(radius, 10);
    const raw = await firstPositions(effective);
    const valid = raw.list.map(normalizeAircraft).filter(Boolean)
      .filter(p => p.km <= effective).sort((a, b) => a.km - b.km);
    const flights = valid.filter(p => p.km <= radius);
    let output = flights;
    if (mode === 'full' && flights.length) {
      const detailed = flights.slice(0, MAX_DETAILS);
      const routes = await routeRows(detailed, context);
      const rich = await Promise.all(detailed.map(p => enrich(p, routes.get(p.flight || ''), context)));
      output = [...rich, ...flights.slice(MAX_DETAILS)];
    }
    return new Response(JSON.stringify({
      updated: new Date().toISOString(), source: raw.source, mode,
      center: HOME, radius_km: radius, count: flights.length,
      inside_10km: valid.filter(p => p.km <= 10).length, flights: output,
    }), { status: 200, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Nie udało się pobrać pozycji.', detail: String(error.message || error) }),
      { status: 502, headers: HEADERS });
  }
}
