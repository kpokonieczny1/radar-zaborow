// Radar Zaborów 20.0: statystyki zużycia FR24 z ostatnich 30 dni (NIE stan okresu rozliczeniowego).
const header={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const output=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:header});
function night(){const h=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',hour:'2-digit',hourCycle:'h23'}).format(new Date()));return h<6;}
export async function onRequestGet(ctx){
  if(night())return output({paused:true,message:'Przerwa nocna. Bez zapytań FR24.'},200);
  const token=ctx.env?.FR24_API_TOKEN;
  if(!token)return output({error:'Brak FR24_API_TOKEN'},503);
  const req=new Request(new URL('/__fr24_usage_20_30d',ctx.request.url));
  try{
    let cache=null;try{cache=caches.default;}catch{}
    if(cache){const hit=await cache.match(req);if(hit)return new Response(await hit.text(),{headers:header});}
    const r=await fetch('https://fr24api.flightradar24.com/api/usage?period=30d',{headers:{Authorization:`Bearer ${token}`,'Accept-Version':'v1',Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!r.ok)return output({error:`FR24 usage HTTP ${r.status}`},r.status===429?429:502);
    const data=await r.json();
    if(!Array.isArray(data?.data))return output({error:'FR24 zwrócił nieznany format raportu.'},502);
    const entries=data.data.filter(x=>typeof x?.endpoint==='string').map(x=>({endpoint:x.endpoint,calls:Number(x.request_count)||0,credits:Number(x.credits)||0}));
    const credits=entries.reduce((s,r)=>s+r.credits,0), calls=entries.reduce((s,r)=>s+r.calls,0);
    const snapshot=JSON.stringify({period:'30d',credits_30d:credits,calls_30d:calls,updated:new Date().toISOString()});
    if(cache&&ctx.waitUntil)ctx.waitUntil(cache.put(req,new Response(snapshot,{headers:{'content-type':'application/json','cache-control':'public, max-age=600'}})).catch(()=>{}));
    return new Response(snapshot,{headers:header});
  }catch(e){return output({error:String(e.message||e)},502);}
}
