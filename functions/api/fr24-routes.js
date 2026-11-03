// Radar Zaborów 12.0 — Cloudflare Pages Function: wyłącznie trasy FR24.
// Używa produkcyjnego /api/live/flight-positions/full z filtrem callsigns.
// Pozycje ADS-B w przeglądarce pozostają niezależne.
// WŁĄCZENIE: FR24_HYBRID_PERMISSION_GRANTED=yes tylko z uprawnieniem FR24.
// Sekrety Cloudflare Production: FR24_API_TOKEN i FR24_ROUTE_PIN.

const LIVE_URL = 'https://fr24api.flightradar24.com/api/live/flight-positions/full';
const CACHE_TTL_OK = 30 * 60; // wynik na czas obserwacji danego lotu
const CACHE_TTL_NONE = 5 * 60;
const MAX_AIRCRAFT = 10;
const HEADERS = {
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};
const AIRPORTS = Object.freeze({
  WAW:['Warszawa-Chopin','POL'], WMI:['Warszawa-Modlin','POL'], EPBC:['Warszawa-Babice','POL'], KRK:['Kraków-Balice','POL'],
  SZZ:['Szczecin-Goleniów','POL'], GDN:['Gdańsk','POL'], WRO:['Wrocław','POL'],
  KTW:['Katowice','POL'], POZ:['Poznań-Ławica','POL'], RZE:['Rzeszów','POL'],
  FRA:['Frankfurt nad Menem','DEU'], MUC:['Monachium','DEU'], BER:['Berlin-Brandenburg','DEU'],
  DUS:['Düsseldorf','DEU'], HAM:['Hamburg','DEU'], STR:['Stuttgart','DEU'],
  LHR:['Londyn-Heathrow','GBR'], LGW:['Londyn-Gatwick','GBR'], STN:['Londyn-Stansted','GBR'],
  LTN:['Londyn-Luton','GBR'], MAN:['Manchester','GBR'], LPL:['Liverpool','GBR'],
  EDI:['Edynburg','GBR'], DUB:['Dublin','IRL'], SNN:['Shannon','IRL'],
  CDG:['Paryż-CDG','FRA'], ORY:['Paryż-Orly','FRA'], BVA:['Paryż-Beauvais','FRA'],
  AMS:['Amsterdam-Schiphol','NLD'], BRU:['Bruksela','BEL'], CRL:['Charleroi','BEL'],
  VIE:['Wiedeń','AUT'], ZRH:['Zurych','CHE'], GVA:['Genewa','CHE'],
  CPH:['Kopenhaga','DNK'], ARN:['Sztokholm-Arlanda','SWE'], GOT:['Göteborg','SWE'],
  OSL:['Oslo','NOR'], HEL:['Helsinki','FIN'], TLL:['Tallinn','EST'],
  RIX:['Ryga','LVA'], VNO:['Wilno','LTU'], PRG:['Praga','CZE'],
  BUD:['Budapeszt','HUN'], OTP:['Bukareszt','ROU'], SOF:['Sofia','BGR'],
  FCO:['Rzym-Fiumicino','ITA'], CIA:['Rzym-Ciampino','ITA'], MXP:['Mediolan-Malpensa','ITA'],
  BGY:['Bergamo','ITA'], VCE:['Wenecja','ITA'], NAP:['Neapol','ITA'],
  MAD:['Madryt','ESP'], BCN:['Barcelona','ESP'], AGP:['Malaga','ESP'], ALC:['Alicante','ESP'],
  PMI:['Palma de Mallorca','ESP'], FUE:['Fuerteventura','ESP'], TFS:['Teneryfa','ESP'],
  LIS:['Lizbona','PRT'], OPO:['Porto','PRT'], ATH:['Ateny','GRC'],
  IST:['Stambuł','TUR'], SAW:['Stambuł-Sabiha Gökçen','TUR'],
  DXB:['Dubaj','ARE'], DOH:['Doha','QAT'], JFK:['Nowy Jork-JFK','USA'],
  EWR:['Newark','USA'], ORD:['Chicago-O’Hare','USA'], YYZ:['Toronto','CAN'],
});

const response = (data, status=200) => new Response(JSON.stringify(data), {status, headers:HEADERS});
const norm = v => typeof v === 'string' ? v.trim().toUpperCase() : '';

function sanitizeAircraft(raw) {
  const callsign = norm(raw?.callsign);
  const hex = norm(raw?.hex).replace(/^~/,'');
  const registration = norm(raw?.registration).replace(/\s/g,'');
  if (!/^[A-Z0-9]{3,10}$/.test(callsign)) return null;
  return {
    callsign,
    hex:/^[A-F0-9]{6}$/.test(hex) ? hex : '',
    registration:/^[A-Z0-9-]{3,15}$/.test(registration) ? registration : ''
  };
}
function airport(iata, icao) {
  const i = norm(iata), o = norm(icao);
  const code = /^[A-Z]{3}$/.test(i) ? i : /^[A-Z]{4}$/.test(o) ? o : '';
  if (!code) return null;
  const [name,country_iso3] = AIRPORTS[code] || [null,null];
  return {code, name, country_iso3};
}
function flightTimestamp(v) {
  if (!v) return NaN;
  const s = String(v).trim().replace(' ','T');
  return Date.parse(/Z$|[+-]\d\d:\d\d$/.test(s) ? s : s+'Z');
}
function matchesLive(row, a, now) {
  if (norm(row.callsign) !== a.callsign) return false;
  const hex = norm(row.hex).replace(/^~/,'');
  const reg = norm(row.reg).replace(/\s/g,'');
  if (a.hex && hex && hex !== a.hex) return false;
  if (a.registration && reg && reg !== a.registration) return false;
  // Endpoint jest live; weryfikacja znacznika czasu, jeśli serwer go podaje.
  const stamp = flightTimestamp(row.timestamp);
  if (Number.isFinite(stamp) && Math.abs(now-stamp) > 45*60*1000) return false;
  return true;
}
function fromFlight(row) {
  const from = airport(row.orig_iata, row.orig_icao || row.origin_icao);
  const to = airport(row.dest_iata, row.dest_icao || row.destination_icao);
  // FR24 czasem zna tylko lotnisko startowe (np. EPBC/Babice).
  // Zachowujemy każdą znaną stronę trasy, zamiast kasować cały rekord.
  if (!from && !to) return null;
  return { from, to, flight_number: norm(row.flight) || null,
    route_source:'Flightradar24 API',
    route_status: from && to ? 'bieżący rejs (FR24)' : 'bieżący rejs (FR24) – trasa niepełna' };
}
function cacheRequest(a, ctx) {
  const key = [a.callsign,a.hex||'nohex',a.registration||'noreg'].join('/');
  return new Request(new URL('/__fr24_routes_live_v14/'+key,ctx.request.url));
}
async function getCache(a,ctx) {
  try {
    if (typeof caches === 'undefined' || !caches.default) return null;
    const r = await caches.default.match(cacheRequest(a,ctx));
    return r ? await r.json() : null;
  } catch { return null; }
}
function putCache(a,ctx,result) {
  try {
    if (typeof caches === 'undefined' || !caches.default || !ctx.waitUntil) return;
    const ttl = result ? CACHE_TTL_OK : CACHE_TTL_NONE;
    ctx.waitUntil(caches.default.put(cacheRequest(a,ctx), new Response(
      JSON.stringify({result}),
      {headers:{'content-type':'application/json','cache-control':`public,max-age=${ttl}`}}
    )).catch(()=>{}));
  } catch { /* Cloudflare Cache API jest opcjonalne */ }
}
async function getLiveRows(callsigns,token) {
  const u = new URL(LIVE_URL);
  u.searchParams.set('callsigns',callsigns.join(','));
  u.searchParams.set('limit','30'); // ograniczenie liczby płatnych wyników
  const r = await fetch(u.toString(), {
    headers: {Authorization:`Bearer ${token}`, 'Accept-Version':'v1', Accept:'application/json'},
    signal:AbortSignal.timeout(12000)
  });
  if (!r.ok) {
    if (r.status===401 || r.status===403) throw new Error('FR24 odrzucił token produkcyjny (401/403).');
    if (r.status===429) throw new Error('FR24: limit zapytań (429).');
    throw new Error(`FR24: HTTP ${r.status}`);
  }
  const json=await r.json();
  if (!Array.isArray(json?.data)) throw new Error('Nieznany format odpowiedzi FR24.');
  return json.data;
}
export async function onRequestPost(ctx) {
  const env = ctx.env || {};
  if (env.FR24_HYBRID_PERMISSION_GRANTED !== 'yes')
    return response({error:'FR24 nieaktywne: wymagana zgoda dostawcy na łączenie źródeł.'},503);
  if (!env.FR24_API_TOKEN || !env.FR24_ROUTE_PIN || String(env.FR24_ROUTE_PIN).length<8)
    return response({error:'Skonfiguruj FR24_API_TOKEN i FR24_ROUTE_PIN w Cloudflare Production.'},503);
  let body;
  try {body=await ctx.request.json();} catch {return response({error:'Błędny JSON.'},400);}
  if (String(body?.pin||'') !== String(env.FR24_ROUTE_PIN))
    return response({error:'Nieprawidłowy kod dostępu.'},403);
  if (!Array.isArray(body?.aircraft) || body.aircraft.length>MAX_AIRCRAFT)
    return response({error:`Podaj od 0 do ${MAX_AIRCRAFT} samolotów.`},400);
  const aircraft = [...new Map(body.aircraft.map(sanitizeAircraft).filter(Boolean)
    .map(a=>[`${a.callsign}|${a.hex}|${a.registration}`,a])).values()];
  if (!aircraft.length) return response({routes:{}, looked_up:0, source:'Flightradar24 API'});
  const routes={}, pending=[];
  for (const a of aircraft) {
    const cached = await getCache(a,ctx);
    if (cached && Object.hasOwn(cached,'result')) routes[a.callsign]=cached.result;
    else pending.push(a);
  }
  if (pending.length) {
    let rows;
    try {rows=await getLiveRows([...new Set(pending.map(a=>a.callsign))], String(env.FR24_API_TOKEN));}
    catch(e) {return response({error:e.message||'Błąd FR24'},502);}
    for (const a of pending) {
      const matching=rows.filter(r=>matchesLive(r,a,Date.now()));
      const chosen=matching.map(fromFlight).find(Boolean)||null;
      routes[a.callsign]=chosen;
      putCache(a,ctx,chosen);
    }
  }
  return response({source:'Flightradar24 API',looked_up:pending.length, routes});
}
