// Radar Zaborów — Cloudflare Pages Functions, v1.1
const LAT = 52.2634;
const LON = 20.6845;
const RADIUS_KM = 10;
const RADIUS_NM = 6;

const SOURCES = [
  { name: 'ADSB One', url: `https://api.adsb.one/v2/point/${LAT}/${LON}/${RADIUS_NM}` },
  { name: 'ADSB.lol', url: `https://api.adsb.lol/v2/point/${LAT}/${LON}/${RADIUS_NM}` },
  { name: 'ADSB.fi', url: `https://opendata.adsb.fi/api/v3/lat/${LAT}/lon/${LON}/dist/${RADIUS_NM}` },
];

const responseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function distanceKm(lat, lon) {
  const r = Math.PI / 180;
  const dLat = (lat - LAT) * r;
  const dLon = (lon - LON) * r;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(LAT * r) * Math.cos(lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchJson(url, timeoutMs = 7000) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'RadarZaborow/1.1 (personal aircraft display)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('Niepoprawne dane JSON');
  return data;
}

async function readPositions() {
  const errors = [];
  for (const src of SOURCES) {
    try {
      const raw = await fetchJson(src.url);
      const aircraft = Array.isArray(raw.ac) ? raw.ac
        : Array.isArray(raw.aircraft) ? raw.aircraft : null;
      if (!aircraft) throw new Error('Brak listy samolotów w odpowiedzi');
      return { aircraft, source: src.name, errors };
    } catch (error) {
      errors.push(`${src.name}: ${error.message || String(error)}`);
    }
  }
  throw new Error(errors.join(' | '));
}

function airport(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    name: obj.name || obj.municipality || null,
    code: obj.iata_code || obj.icao_code || obj.iata || obj.icao || null,
  };
}

async function detailsFor(a) {
  const hex = String(a.hex || '').replace(/^~/, '').trim().toUpperCase();
  const callsign = String(a.flight || '').trim().toUpperCase();
  const validHex = /^[A-F0-9]{6}$/.test(hex);
  const validCallsign = /^[A-Z0-9]{3,10}$/.test(callsign);
  let plane = {};
  let route = {};

  if (validHex) {
    const url = `https://api.adsbdb.com/v0/aircraft/${hex}`
      + (validCallsign ? `?callsign=${encodeURIComponent(callsign)}` : '');
    try {
      const data = (await fetchJson(url, 5000)).response;
      if (data && typeof data === 'object') {
        plane = data.aircraft || {};
        route = data.flightroute || {};
      }
    } catch {}
  }
  if (!Object.keys(route).length && validCallsign) {
    try {
      const data = (await fetchJson(
        `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, 5000
      )).response;
      if (data && typeof data === 'object') route = data.flightroute || {};
    } catch {}
  }

  if (validHex && !plane.type) {
    try {
      const other = await fetchJson(`https://hexdb.io/api/v2/aircraft/${hex}`, 4000);
      plane = { ...other, ...plane };
    } catch {}
  }
  if (validCallsign && !route.origin && !route.destination) {
    try {
      const other = await fetchJson(
        `https://hexdb.io/api/v2/routes/${encodeURIComponent(callsign)}`, 4000
      );
      route = { ...other, ...route };
    } catch {}
  }

  return {
    hex,
    flight: callsign || null,
    registration: plane.registration || a.r || null,
    model: plane.type || a.t || null,
    operator: route.airline?.name || plane.registered_owner || a.ownOp || null,
    from: airport(route.origin),
    to: airport(route.destination),
    lat: a.lat,
    lon: a.lon,
    km: Math.round(distanceKm(a.lat, a.lon) * 10) / 10,
    altitude_m: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * 0.3048) : null,
    speed_kmh: typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null,
    track: typeof a.track === 'number' ? a.track : null,
  };
}

export async function onRequestGet() {
  try {
    const { aircraft, source } = await readPositions();
    const nearby = aircraft.filter(a => typeof a.lat === 'number'
      && typeof a.lon === 'number'
      && distanceKm(a.lat, a.lon) <= RADIUS_KM)
      .sort((a, b) => distanceKm(a.lat, a.lon) - distanceKm(b.lat, b.lon));

    const enriched = await Promise.all(nearby.slice(0, 12).map(detailsFor));
    const remaining = nearby.slice(12).map(a => ({
      hex: String(a.hex || '').replace(/^~/, '').toUpperCase(),
      flight: String(a.flight || '').trim() || null,
      registration: a.r || null,
      model: a.t || null,
      operator: a.ownOp || null,
      from: null,
      to: null,
      lat: a.lat,
      lon: a.lon,
      km: Math.round(distanceKm(a.lat, a.lon) * 10) / 10,
      altitude_m: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * 0.3048) : null,
      speed_kmh: typeof a.gs === 'number' ? Math.round(a.gs * 1.852) : null,
      track: typeof a.track === 'number' ? a.track : null,
    }));

    return new Response(JSON.stringify({
      updated: new Date().toISOString(),
      center: { lat: LAT, lon: LON },
      radius_km: RADIUS_KM,
      source,
      count: nearby.length,
      flights: [...enriched, ...remaining],
      notice: 'Trasy są informacją orientacyjną z baz lotniczych.',
    }), { status: 200, headers: responseHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Nie udało się pobrać pozycji samolotów.',
      detail: String(error.message || error),
      help: 'API może blokować zapytania z Cloudflare. W takim wypadku potrzebne jest inne miejsce uruchomienia pośrednika.',
    }), { status: 502, headers: responseHeaders });
  }
}
