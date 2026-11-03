// Radar Zaborów 10.0 – FR24 Sandbox, wyłącznie dane przykładowe.
// Cloudflare Pages Function: /api/fr24
// Wymaga sekretu FR24_SANDBOX_TOKEN w ustawieniach Pages.
const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};
const API_ENDPOINT = 'https://fr24api.flightradar24.com/api/live/flight-positions/full';
const airlineNames = Object.freeze({
  SAS: ['Scandinavian Airlines', 'SK'], LOT: ['LOT Polish Airlines', 'LO'],
  RYR: ['Ryanair', 'FR'], WZZ: ['Wizz Air', 'W6'], DLH: ['Lufthansa', 'LH'],
  BAW: ['British Airways', 'BA'], KLM: ['KLM', 'KL'], AFR: ['Air France', 'AF'],
  EZY: ['easyJet', 'U2'], ENT: ['Enter Air', 'E4'],
});
const knownSandboxAirports = Object.freeze({
  // Występują w oficjalnej, stałej odpowiedzi przykładowej FR24.
  ARN: { name: 'Sztokholm-Arlanda', country_iso3: 'SWE' },
  FUE: { name: 'Fuerteventura', country_iso3: 'ESP' },
});
const str = v => typeof v === 'string' ? v.trim() : '';
const numeric = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
function airport(codeIata, codeIcao) {
  const iata = str(codeIata).toUpperCase();
  const code = iata || str(codeIcao).toUpperCase();
  if (!code) return null;
  const known = knownSandboxAirports[iata] || {};
  return { code, name: known.name || null, country_iso3: known.country_iso3 || null };
}
function normalize(row) {
  if (!row || typeof row !== 'object') return null;
  const flight = str(row.callsign).toUpperCase();
  const icao = str(row.operating_as || row.painted_as).toUpperCase();
  const airline = airlineNames[flight.slice(0, 3)] || airlineNames[icao] || null;
  const altitudeFt = numeric(row.alt);
  const speedKnots = numeric(row.gspeed);
  const from = airport(row.orig_iata, row.orig_icao);
  const to = airport(row.dest_iata, row.dest_icao);
  return {
    hex: str(row.hex).toUpperCase(),
    flight: flight || null, flight_number: str(row.flight).toUpperCase() || null,
    registration: str(row.reg) || null,
    model: str(row.type) || null,
    operator: airline?.[0] || str(row.operating_as || row.painted_as) || null,
    airline_iata: airline?.[1] || null,
    lat: numeric(row.lat), lon: numeric(row.lon), km: null,
    altitude_m: altitudeFt === null ? null : Math.round(altitudeFt * 0.3048),
    speed_kmh: speedKnots === null ? null : Math.round(speedKnots * 1.852),
    track: numeric(row.track),
    from, to,
    route_source: 'Flightradar24 Sandbox',
    route_status: 'stała odpowiedź testowa',
    photo: null, photo_fallback: null,
  };
}
function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
export async function onRequestGet({ env }) {
  const token = str(env?.FR24_SANDBOX_TOKEN);
  if (!token) {
    return reply({
      error: 'Brak tokenu Sandbox na serwerze.',
      detail: 'Dodaj w Cloudflare Pages sekret FR24_SANDBOX_TOKEN i ponownie wdróż stronę.',
    }, 503);
  }
  try {
    // Parametry są ignorowane przez FR24 Sandbox, ale jest to realny endpoint produkcyjny
    // w trybie testowym, autoryzowany specjalnym tokenem Sandbox.
    const bounds = '52.35,52.17,20.55,20.82';
    const response = await fetch(`${API_ENDPOINT}?bounds=${bounds}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Version': 'v1',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      let detail = '';
      // Nie przekazuj nieznanej odpowiedzi z serwera — może zawierać dane wrażliwe.
      if (response.status === 401 || response.status === 403) {
        detail = 'Token jest nieważny lub nie ma dostępu do endpointu.';
      } else if (response.status === 429) {
        detail = 'Serwer API ograniczył liczbę zapytań.';
      } else {
        detail = 'Sprawdź token Sandbox i status usługi FR24.';
      }
      return reply({ error: `Flightradar24 API: HTTP ${response.status}`, detail }, 502);
    }
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) {
      return reply({ error: 'Nieoczekiwany format danych Flightradar24 Sandbox.' }, 502);
    }
    const flights = payload.data.map(normalize).filter(Boolean);
    return reply({
      source: 'Flightradar24 Sandbox',
      sandbox: true,
      updated: new Date().toISOString(),
      count: flights.length,
      flights,
      notice: 'DANE PRZYKŁADOWE. FR24 Sandbox ignoruje współrzędne, promień i czas. Nie są to samoloty nad Zaborowem.',
    });
  } catch (e) {
    return reply({
      error: 'Nie udało się połączyć z Flightradar24 Sandbox.',
      detail: e?.name === 'TimeoutError' ? 'Przekroczono czas oczekiwania (10 s).' : 'Błąd połączenia API.',
    }, 502);
  }
}
