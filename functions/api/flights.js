// Radar Zaborów — API dla Cloudflare Pages Functions, wersja 2.0.
// Wspierane promienie: 10, 20, 50 km. Brak kluczy API.
const LAT = 52.2634;
const LON = 20.6845;
const ALLOWED_RADII = new Set([10, 20, 50]);

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

function sources(radiusKm) {
  // API używają mil morskich; dobieramy nieco większy obszar,
  // a następnie filtrujemy dokładnie po odległości w kilometrach.
  const nauticalMiles = Math.ceil(radiusKm / 1.852) + 1;
  return [
    { name: 'ADSB One', url: `https://api.adsb.one/v2/point/${LAT}/${LON}/${nauticalMiles}` },
    { name: 'ADSB.lol', url: `https://api.adsb.lol/v2/point/${LAT}/${LON}/${nauticalMiles}` },
    { name: 'ADSB.fi', url: `https://opendata.adsb.fi/api/v3/lat/${LAT}/lon/${LON}/dist/${nauticalMiles}` },
  ];
}

async function fetchJson(url, timeoutMs = 7000) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'User-Agent': 'RadarZaborow/2.0 (personal aircraft display)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('Niepoprawna odpowiedź JSON');
  return data;
}

async function readPositions(radiusKm) {
  const errors = [];
  for (const src of sources(radiusKm)) {
    try {
      const raw = await fetchJson(src.url);
      const aircraft = Array.isArray(raw.ac) ? raw.ac
        : Array.isArray(raw.aircraft) ? raw.aircraft : null;
      if (!aircraft) throw new Error('Brak listy samolotów');
      return { aircraft, source: src.name };
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

function basicFlight(a) {
  return {
    hex: String(a.hex || '').replace(/^~/, '').trim().toUpperCase(),
    flight: String(a.flight || '').trim().toUpperCase() || null,
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
  };
}

async function enrich(a) {
  const base = basicFlight(a);
  const hex = base.hex;
  const callsign = base.flight || '';
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
    } catch { /* Brak wpisu w bazie nie zatrzymuje radaru. */ }
  }
  if (!Object.keys(route).length && validCallsign) {
    try {
      const data = (await fetchJson(
        `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`, 5000
      )).response;
      if (data && typeof data === 'object') route = data.flightroute || {};
    } catch { /* brak danych */ }
  }

  if (validHex && !plane.type) {
    try {
      const other = await fetchJson(`https://hexdb.io/api/v2/aircraft/${hex}`, 4000);
      plane = { ...other, ...plane };
    } catch { /* brak danych */ }
  }
  if (validCallsign && !route.origin && !route.destination) {
    try {
      const other = await fetchJson(
        `https://hexdb.io/api/v2/routes/${encodeURIComponent(callsign)}`, 4000
      );
      route = { ...other, ...route };
    } catch { /* brak danych */ }
  }

  return {
    ...base,
    registration: plane.registration || base.registration,
    model: plane.type || base.model,
    operator: route.airline?.name || plane.registered_owner || base.operator,
    from: airport(route.origin),
    to: airport(route.destination),
  };
}

export async function onRequestGet({ request }) {
  const param = new URL(request.url).searchParams.get('radius');
  const radiusKm = param === null ? 10 : Number(param);
  if (!ALLOWED_RADII.has(radiusKm)) {
    return new Response(JSON.stringify({ error: 'Dozwolone promienie: 10, 20, 50 km.' }), {
      status: 400,
      headers: responseHeaders,
    });
  }

  try {
    const { aircraft, source } = await readPositions(radiusKm);
    const nearby = aircraft
      .filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lon)
        && distanceKm(a.lat, a.lon) <= radiusKm)
      .sort((a, b) => distanceKm(a.lat, a.lon) - distanceKm(b.lat, b.lon));

    // Wszystkie wykryte pozycje pozostają na radarze. Najbliższych 12
    // wzbogacamy o trasę i typ, żeby ograniczyć zapytania do zewnętrznych baz.
    const detailed = await Promise.all(nearby.slice(0, 12).map(enrich));
    const others = nearby.slice(12).map(basicFlight);
    const flights = [...detailed, ...others];

    return new Response(JSON.stringify({
      updated: new Date().toISOString(),
      center: { lat: LAT, lon: LON },
      radius_km: radiusKm,
      alert_radius_km: 10,
      source,
      count: flights.length,
      inside_10km: flights.filter(f => f.km <= 10).length,
      flights,
      notice: 'Trasy z baz lotniczych są orientacyjne i mogą być niepełne.',
    }), { status: 200, headers: responseHeaders });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Nie udało się pobrać pozycji samolotów.',
      detail: String(error.message || error),
    }), { status: 502, headers: responseHeaders });
  }
}
