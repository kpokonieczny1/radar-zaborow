// Radar Zaborów 20.2 – FR24 adaptacyjnie 60/30 s; cache 25 s.
// Cloudflare Pages Function. Wymagany Secret Production: FR24_API_TOKEN.
// Kafelki, zdjęcia oraz wiek z bezpłatnych źródeł nie pobierają kredytów FR24.
const FR24_URL = 'https://fr24api.flightradar24.com/api/live/flight-positions/full';
const CACHE_SECONDS = 25; // poniżej minimum 30 s; nowe pozycje przy każdym planowym odczycie
const DEFAULT = {lat:52.2629444444, lon:20.6860833333};
const RESPONSE_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const AIRLINES = {LOT:['LOT Polish Airlines','LO'],RYR:['Ryanair','FR'],WZZ:['Wizz Air','W6'],DLH:['Lufthansa','LH'],BAW:['British Airways','BA'],KLM:['KLM','KL'],AFR:['Air France','AF'],SAS:['Scandinavian Airlines','SK'],ENT:['Enter Air','E4'],EZY:['easyJet','U2'],UAE:['Emirates','EK'],THY:['Turkish Airlines','TK']};
const LOCALAIRPORTS={EPBC:['Warszawa-Babice','POL'],QPB:['Warszawa-Babice','POL'],EPWA:['Warszawa-Chopin','POL'],WAW:['Warszawa-Chopin','POL']};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:RESPONSE_HEADERS});
const clean=v=>typeof v==='string'?v.trim():'';
const number=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const upper=v=>clean(v).toUpperCase();
const isoDate=()=>new Date().toISOString();
function polishHour(){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',hourCycle:'h23'}).format(new Date()));}
function isNight(){return polishHour() < 6;}
function distKm(lat1,lon1,lat2,lon2){let p=Math.PI/180,a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(a)));}
function checkParams(params){
  const lat=Number(params.get('lat')??DEFAULT.lat),lon=Number(params.get('lon')??DEFAULT.lon),radius=Number(params.get('radius')??10);
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(radius)||radius<1||radius>200)throw new Error('Współrzędne lub promień poza zakresem.');
  return {lat,lon,radius};
}
function bounding(lat,lon,radius){
  const dlat=(radius+1)/111.195, dlon=(radius+1)/(111.195*Math.max(0.05,Math.cos(lat*Math.PI/180)));
  return [Math.min(90,lat+dlat),Math.max(-90,lat-dlat),Math.max(-180,lon-dlon),Math.min(180,lon+dlon)].map(n=>n.toFixed(5)).join(',');
}
function airport(code,icao){
  const i=upper(code),o=upper(icao); const key=/^[A-Z]{3}$/.test(i)?i:/^[A-Z]{4}$/.test(o)?o:'';
  if(!key)return null;
  const d=LOCALAIRPORTS[key]||[null,null];
  return {code:key,name:d[0],country_iso3:d[1]};
}
function kindFrom(row){
  const type=upper(row.type || row.aircraft_type || row.aircraft), cat=upper(row.category);
  if(/^(H|R22|R44|R66|EC|AS35|B06|B47|UH|MI8|HELI)/.test(type)||cat==='H')return 'helicopter';
  if(/^(GLID|ASK|DG|LS[468]|ASW)/.test(type)||cat==='G')return 'glider';
  if(/^(C1[5-9][012]|C17[012]|C20[678]|C21[012]|PA|DA|P28|BE[0-9]|SR2|PC12|DR40|TB[0-9]|B38|B39)/.test(type) && !/^B3[6789]/.test(type))return 'small';
  return 'airliner';
}
function normalize(row,center){
  const lat=number(row.lat??row.latitude),lon=number(row.lon??row.longitude);
  if(lat===null||lon===null)return null;
  const cat=upper(row.category||row.aircraft_category||'');
  const type=upper(row.type||'');
  // Bez wózków i pojazdów lotniskowych; nie wyłączaj maszyn tylko dlatego, że lecą nisko.
  if(cat==='V'||cat==='VEHICLE'||row.on_ground===true||type==='GRND')return null;
  const hex=upper(row.hex||row.icao24||'').replace(/^~/,'');
  const flight=upper(row.callsign||row.call_sign||'');
  const reg=upper(row.reg||row.registration||'');
  const airline=AIRLINES[flight.slice(0,3)];
  const speed=number(row.gspeed??row.gs??row.ground_speed);
  const alt=number(row.alt??row.altitude??row.alt_baro);
  const track=number(row.track??row.heading??row.course);
  const rawIata=upper(row.operating_as_iata||row.airline_iata||'');
  return {
    hex,flight:flight||null,registration:reg||null, model:type||null,
    operator:airline?.[0]||upper(row.operating_as||row.painted_as)||null,
    airline_iata:airline?.[1]||(/^[A-Z0-9]{2}$/.test(rawIata)?rawIata:null),
    flight_number:upper(row.flight||row.flight_number)||null,
    lat,lon,km:Math.round(distKm(center.lat,center.lon,lat,lon)*10)/10,
    altitude_m:alt===null?null:Math.round(alt*0.3048),
    speed_kmh:speed===null?null:Math.round(speed*1.852),
    track,kind:kindFrom(row),year_built:null,
    from:airport(row.orig_iata,row.orig_icao||row.origin_icao),
    to:airport(row.dest_iata,row.dest_icao||row.destination_icao),
    route_source:'Flightradar24 API'
  };
}
// Cache API jest regionalne, a nie globalnym bezwzględnym limitem budżetu.
// Warto ochronić publiczną stronę Cloudflare Access.
async function loadPositions(ctx,area){
  const cacheKey=`v20:${area.lat.toFixed(4)}:${area.lon.toFixed(4)}:${area.radius.toFixed(1)}`;
  const cacheRequest=new Request(new URL('/__fr24_snapshot_v20_2/'+encodeURIComponent(cacheKey),ctx.request.url));
  let cache=null;
  try {if(typeof caches!=='undefined')cache=caches.default;}catch{}
  if(cache){try {const existing=await cache.match(cacheRequest);if(existing)return {...await existing.json(),cache_hit:true};}catch{}}
  const token=ctx.env?.FR24_API_TOKEN;
  if(!token)throw new Error('Brak sekretu FR24_API_TOKEN w Production Cloudflare.');
  const u=new URL(FR24_URL);
  u.searchParams.set('bounds',bounding(area.lat,area.lon,area.radius));
  u.searchParams.set('limit','12'); // maksymalnie 12 płatnych wyników w jednej odpowiedzi
  const res=await fetch(u,{headers:{Authorization:`Bearer ${token}`,'Accept-Version':'v1',Accept:'application/json'},signal:AbortSignal.timeout(11000)});
  if(!res.ok)throw new Error(`FR24 HTTP ${res.status}`);
  const body=await res.json();
  if(!Array.isArray(body?.data))throw new Error('FR24: brak tablicy data w odpowiedzi.');
  const snapshot={updated:isoDate(),rows:body.data,credits_estimate:Math.max(1,body.data.length*8)};
  if(cache&&ctx.waitUntil)try{ctx.waitUntil(cache.put(cacheRequest,new Response(JSON.stringify(snapshot),{headers:{'content-type':'application/json','cache-control':`public, max-age=${CACHE_SECONDS}`}})).catch(()=>{}));}catch{}
  return {...snapshot,cache_hit:false};
}
function allowedUrl(value,domains){try{const u=new URL(value);return u.protocol==='https:'&&domains.some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:null;}catch{return null;}}
async function fetchJSON(url){const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(5500)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
async function photoFor(f,ctx){
  const hex=upper(f.hex).replace(/^~/,''),reg=upper(f.registration);
  let cache=null,req=null;
  try{cache=caches.default;req=new Request(new URL('/__photo_v20/'+encodeURIComponent(hex||reg),ctx.request.url));
    const hit=await cache.match(req);if(hit)return hit.json();}catch{cache=null;}
  let photo=null;
  for(const url of [
    /^[A-F0-9]{6}$/.test(hex)?`https://api.planespotters.net/pub/photos/hex/${hex}`:null,
    /^[A-Z0-9-]{3,15}$/.test(reg)?`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`:null,
  ].filter(Boolean)){
    try{const data=await fetchJSON(url);const row=data.photos?.[0];
      const thumb=allowedUrl(row?.thumbnail_large?.src||row?.thumbnail?.src,['planespotters.net','plnspttrs.net']);
      const link=allowedUrl(row?.link,['planespotters.net']);
      if(thumb&&link){photo={thumbnail:thumb,link,photographer:clean(row.photographer?.name||row.photographer)||'Autor',source:'Planespotters.net'};break;}
    }catch{}
  }
  const result={photo};
  if(cache&&req&&ctx.waitUntil)try{ctx.waitUntil(cache.put(req,new Response(JSON.stringify(result),{headers:{'cache-control':'public, max-age=21600','content-type':'application/json'}})).catch(()=>{}));}catch{}
  return result;
}
async function photoMeta(f,ctx){const r=await photoFor(f,ctx);return {...f,photo:r.photo||null,photo_fallback:null};}
export async function onRequestGet(ctx){
  // Nocnej blokady nie można obejść przez ręczne wywołanie endpointu.
  if(isNight())return json({paused:true,reason:'Przerwa nocna FR24 00:00–06:00 Europe/Warsaw',flights:[],count:0,updated:isoDate()},200);
  let area;
  try{area=checkParams(new URL(ctx.request.url).searchParams);}catch(e){return json({error:String(e.message)},400);}
  const mode='positions';
  try{
    const state=await loadPositions(ctx,area);
    const processed=state.rows.map(r=>normalize(r,area)).filter(Boolean)
      .filter(r=>r.km<=area.radius).sort((a,b)=>a.km-b.km);
    const flights=processed;
    return json({source:'Flightradar24',mode,center:{lat:area.lat,lon:area.lon},radius_km:area.radius,
      count:processed.length,inside_10km:processed.filter(x=>x.km<=10).length,
      updated:state.updated,flights,
      cache_hit:state.cache_hit,
      credits_estimate:state.cache_hit?0:state.credits_estimate,
      note:'Kredyty szacowane na podstawie liczby wyników FR24; saldo konta sprawdzaj w portalu FR24.'});
  }catch(e){return json({error:'Nie udało się pobrać danych FR24',detail:String(e.message||e)},502);}
}
