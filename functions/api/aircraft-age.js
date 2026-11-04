// Radar Zaborów 17.1 — wiek pojedynczego samolotu.
// AirLabs Fleets (globalna baza, potrzebny AIRLABS_API_KEY),
// a bez klucza lub danych AirLabs: OpenAirframes/FAA dla części USA.
// Nie korzysta z FR24, nie zwraca klucza API do przeglądarki.
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
};
const currentYear = () => new Date().getUTCFullYear();
function validYear(value) {
  if (value == null || value === '') return null;
  const y = Number(value);
  return Number.isInteger(y) && y >= 1940 && y <= currentYear() ? y : null;
}
function validAge(value) {
  if (value == null || value === '') return null;
  const age = Number(value);
  return Number.isFinite(age) && age >= 0 && age <= 110 ? Math.floor(age) : null;
}
function responseJSON(data, status=200, ttl=3600) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{...JSON_HEADERS, 'cache-control':`public, max-age=${ttl}`},
  });
}
async function fetchJSON(url, timeout=5500) {
  const resp = await fetch(url, { headers:{accept:'application/json'}, signal:AbortSignal.timeout(timeout) });
  // Nie umieszczamy URL (z tajnym kluczem) w żadnym komunikacie błędu.
  if (!resp.ok) throw new Error(`Dostawca odpowiedział HTTP ${resp.status}`);
  return resp.json();
}
function normalizeRegistration(value) {
  const reg = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9-]{3,12}$/.test(reg) ? reg : '';
}
function airlabsRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.response)) return data.response;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}
async function lookupAirLabs(key, hex, registration) {
  // AirLabs may return no match when searching a recently reassigned registration.
  // Try the registration first, then the independent ICAO24 identifier.
  const attempts = registration
    ? [{field: 'reg_number', value: registration}, {field: 'hex', value: hex}]
    : [{field: 'hex', value: hex}];
  let wasLookupSuccessful = false;

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      api_key: key,
      _fields: 'hex,reg_number,built,age',
      limit: '5',
      [attempt.field]: attempt.value,
    });
    const data = await fetchJSON(`https://airlabs.co/api/v9/fleets?${params}`, 6500);
    if (data?.error) {
      const code = String(data.error.code || '').toLowerCase();
      const message = String(data.error.message || data.error.description || '').toLowerCase();
      const errorText = `${code} ${message}`;
      const limited = /limit|quota|balance|rate|credits/.test(errorText);
      const forbidden = /permission|plan|access|restrict|endpoint|denied|subscribe/.test(errorText);
      return {status: limited ? 'quota_exceeded' : forbidden ? 'access_denied' : 'airlabs_error',
        year_built: null, age_years: null, source: null};
    }
    wasLookupSuccessful = true;
    const row = airlabsRows(data).find(item => {
      const h = String(item?.hex || '').trim().toUpperCase().replace(/^0X/, '');
      const r = normalizeRegistration(item?.reg_number);
      // Accept only the same ICAO24 or exact registration without conflicting ICAO24.
      return (h && h === hex) || (registration && r === registration && (!h || h === hex));
    });
    if (row) {
      const year_built = validYear(row.built ?? row.year_built ?? row.year);
      const age_years = year_built !== null ? currentYear() - year_built : validAge(row.age);
      return {year_built, age_years, source:'AirLabs Fleets',
        status: year_built !== null || age_years !== null ? 'ok' : 'fields_unavailable'};
    }
  }
  return {status: wasLookupSuccessful ? 'not_found' : 'airlabs_error',
    year_built: null, age_years: null, source: null};
}
async function lookupFAA(hex) {
  try {
    const obj = await fetchJSON(`https://api.pigeite.com/aircraft/${hex.toLowerCase()}`,4500);
    if (String(obj?.icao_hex||'').toUpperCase()!==hex) return null;
    const year_built=validYear(obj.year_manufactured ?? obj.year_built);
    if (year_built!==null) return {year_built,age_years:currentYear()-year_built,source:'OpenAirframes / FAA',status:'ok'};
  } catch {}
  return null;
}
export async function onRequestGet(context) {
  const {request,env={}}=context;
  const url=new URL(request.url);
  const hex=String(url.searchParams.get('hex')||'').toUpperCase().trim().replace(/^~/,'');
  const registration=normalizeRegistration(url.searchParams.get('registration'));
  if (url.searchParams.get('check')==='1')
    return responseJSON({airlabs_configured:!!(env.AIRLABS_API_KEY||env.AIRLABS_KEY),version:'17.1'},200,0);
  if (!/^[A-F0-9]{6}$/.test(hex)) return responseJSON({error:'Nieprawidłowy identyfikator ICAO24'},400,0);
  const cacheKey=new Request(new URL(`/__radar_age_cache_v17_1/${hex}`,url));
  try {const hit=await caches?.default?.match(cacheKey);if(hit) return hit;} catch {}
  const key=String(env.AIRLABS_API_KEY||env.AIRLABS_KEY||'').trim();
  let result={status:'configuration_required',year_built:null,age_years:null,source:null};
  if (key) {
    try {result=await lookupAirLabs(key,hex,registration);}
    catch {result={status:'airlabs_error',year_built:null,age_years:null,source:null};}
  }
  if (result.year_built==null && result.age_years==null) {
    const fallback=await lookupFAA(hex);
    if (fallback) result=fallback;
  }
  // Sukces buforujemy długo, niedostępność planu/limitu — krótko.
  const ttl=result.status==='ok'?30*86400:
    result.status==='configuration_required'?300:
    ['airlabs_error','quota_exceeded'].includes(result.status)?120:
    result.status==='not_found' || result.status==='fields_unavailable'?600:3600;
  const payload={hex,year_built:result.year_built,age_years:result.age_years,
    status:result.status,source:result.source,
    note:'Wiek przybliżony; rok produkcji to nie data pierwszego lotu.'};
  const response=responseJSON(payload,200,ttl);
  try {if(typeof context.waitUntil==='function'&&typeof caches!=='undefined'&&caches.default)
    context.waitUntil(caches.default.put(cacheKey,response.clone()).catch(()=>{}));} catch {}
  return response;
}
