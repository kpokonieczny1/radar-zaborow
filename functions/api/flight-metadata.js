// Radar Zaborów 20.0: wyłącznie darmowe zdjęcia. Zero żądań do FR24.
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const upper=x=>typeof x==='string'?x.trim().toUpperCase():'';
const allowed=(s)=>{try{const u=new URL(s);return u.protocol==='https:'&&['planespotters.net','plnspttrs.net'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))?u.href:null;}catch{return null;}};
async function photo(p,ctx){
  const hex=upper(p.hex).replace(/^~/,''),reg=upper(p.registration);
  if(!/^[A-F0-9]{6}$/.test(hex)&&!/^[A-Z0-9-]{3,15}$/.test(reg))return null;
  const req=new Request(new URL('/__photo_meta_v20/'+encodeURIComponent(hex||reg),ctx.request.url));
  let c;try{c=caches.default;const saved=await c.match(req);if(saved)return saved.json();}catch{c=null;}
  let result=null;
  for(const url of [
    /^[A-F0-9]{6}$/.test(hex)?`https://api.planespotters.net/pub/photos/hex/${hex}`:null,
    /^[A-Z0-9-]{3,15}$/.test(reg)?`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`:null,
  ].filter(Boolean)) {
    try {
      const r=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(4800)});
      if(!r.ok)continue;
      const data=await r.json(),row=data.photos?.[0];
      const thumb=allowed(row?.thumbnail_large?.src||row?.thumbnail?.src),link=allowed(row?.link);
      if(thumb&&link){result={thumbnail:thumb,link,source:'Planespotters.net',photographer:typeof row.photographer==='object'?row.photographer?.name||'Autor':row.photographer||'Autor'};break;}
    }catch{}
  }
  if(c&&ctx.waitUntil)try{ctx.waitUntil(c.put(req,new Response(JSON.stringify(result),{headers:{'content-type':'application/json','cache-control':'public,max-age=21600'}})).catch(()=>{}));}catch{}
  return result;
}
export async function onRequestPost(ctx){
  let data;try{data=await ctx.request.json();}catch{return response({error:'Niepoprawny JSON'},400);}
  if(!Array.isArray(data?.aircraft)||data.aircraft.length>12)return response({error:'Do 12 statków powietrznych'},400);
  const flights=await Promise.all(data.aircraft.map(async p=>{
    const meta={hex:upper(p.hex),flight:upper(p.flight),registration:upper(p.registration),model:upper(p.model)};
    return {...meta,photo:await photo(p,ctx),photo_fallback:null};
  }));
  return response({flights});
}
