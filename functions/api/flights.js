const LAT=52.2634,LON=20.6845,RADIUS_KM=10;
const source='https://opendata.adsb.fi/api/v3/lat/52.2634/lon/20.6845/dist/5.4';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=20'};
function km(lat,lon){const r=Math.PI/180,dLat=(lat-LAT)*r,dLon=(lon-LON)*r,a=Math.sin(dLat/2)**2+Math.cos(LAT*r)*Math.cos(lat*r)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(a)));}
async function jsonFetch(url){const res=await fetch(url,{headers:{'accept':'application/json'},signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error(`HTTP ${res.status}`);return res.json();}
async function enrich(a){const hex=String(a.hex||'').replace(/^~/,'').trim().toUpperCase(),flight=String(a.flight||'').trim().toUpperCase();let details={};if(/^[A-F0-9]{6}$/.test(hex)){
 const url=`https://api.adsbdb.com/v0/aircraft/${hex}`+(flight&&/^[A-Z0-9]{3,10}$/.test(flight)?`?callsign=${encodeURIComponent(flight)}`:'');
 try{const v=await jsonFetch(url);details=v?.response||{};}catch{}
}
if(!details.flightroute&&flight&&/^[A-Z0-9]{3,10}$/.test(flight)){try{const v=await jsonFetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(flight)}`);details.flightroute=v?.response?.flightroute||null;}catch{}}
const plane=details.aircraft||{},route=details.flightroute||{};
return {hex,flight:flight||null,registration:plane.registration||a.r||null,model:plane.type||a.t||null,operator:route.airline?.name||plane.registered_owner||a.ownOp||null,from:route.origin?{name:route.origin.name||route.origin.municipality||null,code:route.origin.iata_code||route.origin.icao_code||null}:null,to:route.destination?{name:route.destination.name||route.destination.municipality||null,code:route.destination.iata_code||route.destination.icao_code||null}:null,lat:a.lat,lon:a.lon,km:Math.round(km(a.lat,a.lon)*10)/10,altitude_m:typeof a.alt_baro==='number'?Math.round(a.alt_baro*0.3048):null,speed_kmh:typeof a.gs==='number'?Math.round(a.gs*1.852):null,track:typeof a.track==='number'?a.track:null};}
export async function onRequestGet(context){try{
 const raw=await jsonFetch(source);const ac=(Array.isArray(raw.ac)?raw.ac:[]).filter(a=>typeof a.lat==='number'&&typeof a.lon==='number'&&km(a.lat,a.lon)<=RADIUS_KM).sort((a,b)=>km(a.lat,a.lon)-km(b.lat,b.lon)).slice(0,25);
 const flights=await Promise.all(ac.map(enrich));return new Response(JSON.stringify({updated:new Date().toISOString(),center:{lat:LAT,lon:LON},radius_km:RADIUS_KM,count:flights.length,flights,notice:'Trasy z bazy rozkładowej mogą różnić się od rzeczywistego lotu.'}),{headers});
}catch(e){return new Response(JSON.stringify({error:'Nie udało się pobrać danych o samolotach.',detail:String(e.message||e)}),{status:502,headers:{...headers,'cache-control':'no-store'}});}}
