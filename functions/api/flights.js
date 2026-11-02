// Radar Zaborów 9.0 · Cloudflare Pages Function
// ?lat=52.26294444&lon=20.68608333&radius=20&mode=positions
// ?lat=52.26294444&lon=20.68608333&radius=20&mode=full
// Domyślny środek: Zaborów, 52°15′46,6″ N, 20°41′09,9″ E.
const DEFAULT_CENTER = Object.freeze({ lat: 52.2629444444, lon: 20.6860833333 });
const MAX_DETAILS = 15;
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const PROVIDERS = [
  (km, center) => ({ name: 'ADSB One', url: `https://api.adsb.one/v2/point/${center.lat}/${center.lon}/${Math.ceil(km / 1.852) + 1}` }),
  (km, center) => ({ name: 'ADSB.lol', url: `https://api.adsb.lol/v2/point/${center.lat}/${center.lon}/${Math.ceil(km / 1.852) + 1}` }),
  (km, center) => ({ name: 'ADSB.fi', url: `https://opendata.adsb.fi/api/v3/lat/${center.lat}/lon/${center.lon}/dist/${Math.ceil(km / 1.852) + 1}` }),
];
const AIRLINES = {
  LOT: ['LOT Polish Airlines', 'LO'], RYR: ['Ryanair', 'FR'], WZZ: ['Wizz Air', 'W6'],
  DLH: ['Lufthansa', 'LH'], BAW: ['British Airways', 'BA'], KLM: ['KLM', 'KL'],
  AFR: ['Air France', 'AF'], UAE: ['Emirates', 'EK'], THY: ['Turkish Airlines', 'TK'],
  SAS: ['Scandinavian Airlines', 'SK'], EZY: ['easyJet', 'U2'], ENT: ['Enter Air', 'E4'],
};
const num = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const clean = value => typeof value === 'string' ? value.trim() : '';

function kmBetween(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function distanceFromCenter(lat, lon, center) { return kmBetween(center.lat, center.lon, lat, lon); }
async function jsonFetch(url, options = {}, timeout = 5000) {
  const response = await fetch(url, {
    ...options,
    headers: { accept: 'application/json', ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function firstPositions(km, center) {
  const errors = [];
  for (const makeProvider of PROVIDERS) {
    const provider = makeProvider(km, center);
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
      request = new Request(new URL('/__radar_cache_v9/' + encodeURIComponent(key), context.request.url));
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

function normalizeAircraft(raw, center) {
  const lat = num(raw?.lat), lon = num(raw?.lon);
  if (lat === null || lon === null) return null;
  const callsign = clean(raw.flight).toUpperCase();
  const hex = clean(raw.hex).replace(/^~/, '').toUpperCase();
  const airline = AIRLINES[callsign.slice(0, 3)];
  return {
    hex, flight: callsign || null, registration: clean(raw.r) || null,
    model: clean(raw.t) || null, operator: airline?.[0] || clean(raw.ownOp) || null,
    airline_iata: airline?.[1] || null,
    lat, lon, km: Math.round(distanceFromCenter(lat, lon, center) * 10) / 10,
    altitude_m: num(raw.alt_baro) === null ? null : Math.round(raw.alt_baro * 0.3048),
    speed_kmh: num(raw.gs) === null ? null : Math.round(raw.gs * 1.852),
    track: num(raw.track),
  };
}
// ISO 3166-1 alpha-2 -> alpha-3. Kraje pochodzą ze źródeł lotniczych;
// nie wnioskujemy kraju z samego prefiksu ICAO lotniska.
const ISO2_TO_ISO3 = Object.freeze({
  AD:'AND', AE:'ARE', AF:'AFG', AG:'ATG', AI:'AIA', AL:'ALB', AM:'ARM', AO:'AGO', AQ:'ATA', AR:'ARG',
  AS:'ASM', AT:'AUT', AU:'AUS', AW:'ABW', AX:'ALA', AZ:'AZE', BA:'BIH', BB:'BRB', BD:'BGD', BE:'BEL',
  BF:'BFA', BG:'BGR', BH:'BHR', BI:'BDI', BJ:'BEN', BL:'BLM', BM:'BMU', BN:'BRN', BO:'BOL', BQ:'BES',
  BR:'BRA', BS:'BHS', BT:'BTN', BV:'BVT', BW:'BWA', BY:'BLR', BZ:'BLZ', CA:'CAN', CC:'CCK', CD:'COD',
  CF:'CAF', CG:'COG', CH:'CHE', CI:'CIV', CK:'COK', CL:'CHL', CM:'CMR', CN:'CHN', CO:'COL', CR:'CRI',
  CU:'CUB', CV:'CPV', CW:'CUW', CX:'CXR', CY:'CYP', CZ:'CZE', DE:'DEU', DJ:'DJI', DK:'DNK', DM:'DMA',
  DO:'DOM', DZ:'DZA', EC:'ECU', EE:'EST', EG:'EGY', EH:'ESH', ER:'ERI', ES:'ESP', ET:'ETH', FI:'FIN',
  FJ:'FJI', FK:'FLK', FM:'FSM', FO:'FRO', FR:'FRA', GA:'GAB', GB:'GBR', GD:'GRD', GE:'GEO', GF:'GUF',
  GG:'GGY', GH:'GHA', GI:'GIB', GL:'GRL', GM:'GMB', GN:'GIN', GP:'GLP', GQ:'GNQ', GR:'GRC', GS:'SGS',
  GT:'GTM', GU:'GUM', GW:'GNB', GY:'GUY', HK:'HKG', HM:'HMD', HN:'HND', HR:'HRV', HT:'HTI', HU:'HUN',
  ID:'IDN', IE:'IRL', IL:'ISR', IM:'IMN', IN:'IND', IO:'IOT', IQ:'IRQ', IR:'IRN', IS:'ISL', IT:'ITA',
  JE:'JEY', JM:'JAM', JO:'JOR', JP:'JPN', KE:'KEN', KG:'KGZ', KH:'KHM', KI:'KIR', KM:'COM', KN:'KNA',
  KP:'PRK', KR:'KOR', KW:'KWT', KY:'CYM', KZ:'KAZ', LA:'LAO', LB:'LBN', LC:'LCA', LI:'LIE', LK:'LKA',
  LR:'LBR', LS:'LSO', LT:'LTU', LU:'LUX', LV:'LVA', LY:'LBY', MA:'MAR', MC:'MCO', MD:'MDA', ME:'MNE',
  MF:'MAF', MG:'MDG', MH:'MHL', MK:'MKD', ML:'MLI', MM:'MMR', MN:'MNG', MO:'MAC', MP:'MNP', MQ:'MTQ',
  MR:'MRT', MS:'MSR', MT:'MLT', MU:'MUS', MV:'MDV', MW:'MWI', MX:'MEX', MY:'MYS', MZ:'MOZ', NA:'NAM',
  NC:'NCL', NE:'NER', NF:'NFK', NG:'NGA', NI:'NIC', NL:'NLD', NO:'NOR', NP:'NPL', NR:'NRU', NU:'NIU',
  NZ:'NZL', OM:'OMN', PA:'PAN', PE:'PER', PF:'PYF', PG:'PNG', PH:'PHL', PK:'PAK', PL:'POL', PM:'SPM',
  PN:'PCN', PR:'PRI', PS:'PSE', PT:'PRT', PW:'PLW', PY:'PRY', QA:'QAT', RE:'REU', RO:'ROU', RS:'SRB',
  RU:'RUS', RW:'RWA', SA:'SAU', SB:'SLB', SC:'SYC', SD:'SDN', SE:'SWE', SG:'SGP', SH:'SHN', SI:'SVN',
  SJ:'SJM', SK:'SVK', SL:'SLE', SM:'SMR', SN:'SEN', SO:'SOM', SR:'SUR', SS:'SSD', ST:'STP', SV:'SLV',
  SX:'SXM', SY:'SYR', SZ:'SWZ', TC:'TCA', TD:'TCD', TF:'ATF', TG:'TGO', TH:'THA', TJ:'TJK', TK:'TKL',
  TL:'TLS', TM:'TKM', TN:'TUN', TO:'TON', TR:'TUR', TT:'TTO', TV:'TUV', TW:'TWN', TZ:'TZA', UA:'UKR',
  UG:'UGA', UM:'UMI', US:'USA', UY:'URY', UZ:'UZB', VA:'VAT', VC:'VCT', VE:'VEN', VG:'VGB', VI:'VIR',
  VN:'VNM', VU:'VUT', WF:'WLF', WS:'WSM', YE:'YEM', YT:'MYT', ZA:'ZAF', ZM:'ZMB', ZW:'ZWE',
});
function airportCountryISO3(value) {
  if (!value || typeof value !== 'object') return null;
  const raw = clean(value.countryiso2 || value.country_iso_name || value.country_code
    || value.iso_country || value.country_iso || value.country_iso2 || value.countryCode
    || value.country_iso3 || '').toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return ISO2_TO_ISO3[raw] || null;
  if (/^[A-Z]{3}$/.test(raw) && Object.values(ISO2_TO_ISO3).includes(raw)) return raw;
  return null;
}
function airport(value) {
  if (!value || typeof value !== 'object') return null;
  const code = clean(value.iata_code || value.iata || value.icao_code || value.icao).toUpperCase();
  return {
    code: code || null, name: clean(value.name || value.location || value.municipality) || null,
    country_iso3: airportCountryISO3(value),
  };
}
function buildRoute(from, to, source, plausible = false) {
  const start = airport(from), end = airport(to);
  if (!start?.code || !end?.code || start.code === end.code) return null;
  return { from: start, to: end, source, plausible };
}
function routeFromLol(row) {
  if (!row || typeof row !== 'object') return null;
  const airports = Array.isArray(row._airports) ? row._airports : row.airports;
  if (Array.isArray(airports) && airports.length >= 2) {
    return buildRoute(airports[0], airports[airports.length - 1], 'ADSB.lol', row.plausible === true);
  }
  // W części odpowiedzi dostawca zwraca tylko lotniska jako "WAW-LHR".
  // Nie wyprowadzamy z samych kodów żadnych nazw ani krajów.
  const codes = clean(row._airport_codes_iata || row.airport_codes || row._airport_codes || '');
  const pieces = codes.split('-').map(value => value.trim()).filter(Boolean);
  if (pieces.length >= 2 && pieces.every(value => /^[A-Z]{3,4}$/i.test(value))) {
    return buildRoute({ iata: pieces[0] }, { iata: pieces[pieces.length - 1] },
      'ADSB.lol', row.plausible === true);
  }
  return null;
}
function routeFromDb(value) {
  return buildRoute(value?.origin, value?.destination, 'ADSBdb');
}
function routeFromHexdb(value) {
  return buildRoute(value?.origin || value?.from, value?.destination || value?.to, 'HexDB');
}

// Trasy NIE są przesyłane przez ADS-B. Wyświetlamy nieprzefiltrowaną
// propozycję z pierwszej bazy, która podaje oba lotniska; bez oceniania
// jej zgodności z pozycją, wysokością, kierunkiem czy plausible=false.
// Kolejność: ADSB.lol → ADSBdb → HexDB. Oznaczenie źródła jest obowiązkowe.
function pickRoute(candidates) {
  const route = candidates.find(Boolean);
  if (!route) return null;
  return {
    from: route.from,
    to: route.to,
    route_source: route.source,
    route_status: 'z bazy – niezweryfikowana',
    route_plausible: route.plausible === true,
  };
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
  // HexDB odpytujemy, jeżeli ani ADSB.lol, ani ADSBdb nie podają pełnej trasy.
  const availableRoute = routeFromLol(lol) || routeFromDb(dbRoute);
  if (!availableRoute && /^[A-Z0-9]{3,10}$/.test(callsign)) {
    try {
      rawHexdb = await cachedJson(context, `hex-route:${callsign}`, 1200,
        () => jsonFetch(`https://hexdb.io/api/v2/routes/${encodeURIComponent(callsign)}`, {}, 3500));
    } catch { /* brak */ }
  }
  const route = pickRoute([availableRoute, routeFromHexdb(rawHexdb)]);
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
    route_plausible: route?.route_plausible ?? null,
    photo: photo || photoDb, photo_fallback: photo && photoDb ? photoDb : null,
  };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const rawRadius = url.searchParams.get('radius') ?? '10';
  const radius = Number(rawRadius);
  const rawLat = url.searchParams.get('lat') ?? String(DEFAULT_CENTER.lat);
  const rawLon = url.searchParams.get('lon') ?? String(DEFAULT_CENTER.lon);
  const mode = url.searchParams.get('mode') === 'full' ? 'full' : 'positions';
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawRadius) || !Number.isFinite(radius)
      || radius < 1 || radius > 200) {
    return new Response(JSON.stringify({ error: 'Promień musi wynosić od 1 do 200 km.' }),
      { status: 400, headers: HEADERS });
  }
  const decimal = /^[-+]?\d+(?:\.\d{1,10})?$/;
  const lat = Number(rawLat), lon = Number(rawLon);
  if (!decimal.test(rawLat) || !decimal.test(rawLon) || !Number.isFinite(lat)
      || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return new Response(JSON.stringify({ error: 'Nieprawidłowe współrzędne. Szerokość: -90…90°, długość: -180…180°.' }),
      { status: 400, headers: HEADERS });
  }
  const center = { lat, lon };
  try {
    const effective = Math.max(radius, 10);
    const raw = await firstPositions(effective, center);
    const valid = raw.list.map(plane => normalizeAircraft(plane, center)).filter(Boolean)
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
      center, radius_km: radius, count: flights.length,
      inside_10km: valid.filter(p => p.km <= 10).length, flights: output,
    }), { status: 200, headers: HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Nie udało się pobrać pozycji.', detail: String(error.message || error) }),
      { status: 502, headers: HEADERS });
  }
}
