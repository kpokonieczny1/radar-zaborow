// Radar Zaborów 13: uzupełnianie nazw lotnisk, BEZ zużywania kredytów FR24.
// AirPortMiles Open API (CC0): https://airportmiles.com/api
// Zwraca mapę IATA/ICAO -> nazwa, ISO-3 kraju. Dla najczęstszych lotnisk
// wykorzystuje dane zapasowe, aby działać także podczas awarii API.
const FALLBACK = {"EPBC":{"name":"Warszawa-Babice","country_iso3":"POL"},"WAW":{"name":"Warszawa-Chopin","country_iso3":"POL"},"WMI":{"name":"Warszawa-Modlin","country_iso3":"POL"},"KRK":{"name":"Kraków-Balice","country_iso3":"POL"},"SZZ":{"name":"Szczecin-Goleniów","country_iso3":"POL"},"GDN":{"name":"Gdańsk","country_iso3":"POL"},"WRO":{"name":"Wrocław","country_iso3":"POL"},"KTW":{"name":"Katowice","country_iso3":"POL"},"POZ":{"name":"Poznań-Ławica","country_iso3":"POL"},"RZE":{"name":"Rzeszów","country_iso3":"POL"},"FRA":{"name":"Frankfurt nad Menem","country_iso3":"DEU"},"MUC":{"name":"Monachium","country_iso3":"DEU"},"BER":{"name":"Berlin-Brandenburg","country_iso3":"DEU"},"DUS":{"name":"Düsseldorf","country_iso3":"DEU"},"HAM":{"name":"Hamburg","country_iso3":"DEU"},"STR":{"name":"Stuttgart","country_iso3":"DEU"},"LHR":{"name":"Londyn-Heathrow","country_iso3":"GBR"},"LGW":{"name":"Londyn-Gatwick","country_iso3":"GBR"},"STN":{"name":"Londyn-Stansted","country_iso3":"GBR"},"LTN":{"name":"Londyn-Luton","country_iso3":"GBR"},"MAN":{"name":"Manchester","country_iso3":"GBR"},"LPL":{"name":"Liverpool","country_iso3":"GBR"},"EDI":{"name":"Edynburg","country_iso3":"GBR"},"DUB":{"name":"Dublin","country_iso3":"IRL"},"SNN":{"name":"Shannon","country_iso3":"IRL"},"CDG":{"name":"Paryż-CDG","country_iso3":"FRA"},"ORY":{"name":"Paryż-Orly","country_iso3":"FRA"},"BVA":{"name":"Paryż-Beauvais","country_iso3":"FRA"},"AMS":{"name":"Amsterdam-Schiphol","country_iso3":"NLD"},"BRU":{"name":"Bruksela","country_iso3":"BEL"},"CRL":{"name":"Charleroi","country_iso3":"BEL"},"VIE":{"name":"Wiedeń","country_iso3":"AUT"},"ZRH":{"name":"Zurych","country_iso3":"CHE"},"GVA":{"name":"Genewa","country_iso3":"CHE"},"CPH":{"name":"Kopenhaga","country_iso3":"DNK"},"ARN":{"name":"Sztokholm-Arlanda","country_iso3":"SWE"},"GOT":{"name":"Göteborg","country_iso3":"SWE"},"OSL":{"name":"Oslo","country_iso3":"NOR"},"HEL":{"name":"Helsinki","country_iso3":"FIN"},"TLL":{"name":"Tallinn","country_iso3":"EST"},"RIX":{"name":"Ryga","country_iso3":"LVA"},"VNO":{"name":"Wilno","country_iso3":"LTU"},"PRG":{"name":"Praga","country_iso3":"CZE"},"BUD":{"name":"Budapeszt","country_iso3":"HUN"},"OTP":{"name":"Bukareszt","country_iso3":"ROU"},"SOF":{"name":"Sofia","country_iso3":"BGR"},"FCO":{"name":"Rzym-Fiumicino","country_iso3":"ITA"},"CIA":{"name":"Rzym-Ciampino","country_iso3":"ITA"},"MXP":{"name":"Mediolan-Malpensa","country_iso3":"ITA"},"BGY":{"name":"Bergamo","country_iso3":"ITA"},"VCE":{"name":"Wenecja","country_iso3":"ITA"},"NAP":{"name":"Neapol","country_iso3":"ITA"},"MAD":{"name":"Madryt","country_iso3":"ESP"},"BCN":{"name":"Barcelona","country_iso3":"ESP"},"AGP":{"name":"Malaga","country_iso3":"ESP"},"ALC":{"name":"Alicante","country_iso3":"ESP"},"PMI":{"name":"Palma de Mallorca","country_iso3":"ESP"},"FUE":{"name":"Fuerteventura","country_iso3":"ESP"},"TFS":{"name":"Teneryfa","country_iso3":"ESP"},"LIS":{"name":"Lizbona","country_iso3":"PRT"},"OPO":{"name":"Porto","country_iso3":"PRT"},"ATH":{"name":"Ateny","country_iso3":"GRC"},"IST":{"name":"Stambuł","country_iso3":"TUR"},"SAW":{"name":"Stambuł-Sabiha Gökçen","country_iso3":"TUR"},"DXB":{"name":"Dubaj","country_iso3":"ARE"},"DOH":{"name":"Doha","country_iso3":"QAT"},"JFK":{"name":"Nowy Jork-JFK","country_iso3":"USA"},"EWR":{"name":"Newark","country_iso3":"USA"},"ORD":{"name":"Chicago-O’Hare","country_iso3":"USA"},"YYZ":{"name":"Toronto","country_iso3":"CAN"}};
const COUNTRIES = {"AW":"ABW","AF":"AFG","AO":"AGO","AI":"AIA","AX":"ALA","AL":"ALB","AD":"AND","AE":"ARE","AR":"ARG","AM":"ARM","AS":"ASM","AQ":"ATA","TF":"ATF","AG":"ATG","AU":"AUS","AT":"AUT","AZ":"AZE","BI":"BDI","BE":"BEL","BJ":"BEN","BQ":"BES","BF":"BFA","BD":"BGD","BG":"BGR","BH":"BHR","BS":"BHS","BA":"BIH","BL":"BLM","BY":"BLR","BZ":"BLZ","BM":"BMU","BO":"BOL","BR":"BRA","BB":"BRB","BN":"BRN","BT":"BTN","BV":"BVT","BW":"BWA","CF":"CAF","CA":"CAN","CC":"CCK","CH":"CHE","CL":"CHL","CN":"CHN","CI":"CIV","CM":"CMR","CD":"COD","CG":"COG","CK":"COK","CO":"COL","KM":"COM","CV":"CPV","CR":"CRI","CU":"CUB","CW":"CUW","CX":"CXR","KY":"CYM","CY":"CYP","CZ":"CZE","DE":"DEU","DJ":"DJI","DM":"DMA","DK":"DNK","DO":"DOM","DZ":"DZA","EC":"ECU","EG":"EGY","ER":"ERI","EH":"ESH","ES":"ESP","EE":"EST","ET":"ETH","FI":"FIN","FJ":"FJI","FK":"FLK","FR":"FRA","FO":"FRO","FM":"FSM","GA":"GAB","GB":"GBR","GE":"GEO","GG":"GGY","GH":"GHA","GI":"GIB","GN":"GIN","GP":"GLP","GM":"GMB","GW":"GNB","GQ":"GNQ","GR":"GRC","GD":"GRD","GL":"GRL","GT":"GTM","GF":"GUF","GU":"GUM","GY":"GUY","HK":"HKG","HM":"HMD","HN":"HND","HR":"HRV","HT":"HTI","HU":"HUN","ID":"IDN","IM":"IMN","IN":"IND","IO":"IOT","IE":"IRL","IR":"IRN","IQ":"IRQ","IS":"ISL","IL":"ISR","IT":"ITA","JM":"JAM","JE":"JEY","JO":"JOR","JP":"JPN","KZ":"KAZ","KE":"KEN","KG":"KGZ","KH":"KHM","KI":"KIR","KN":"KNA","KR":"KOR","KW":"KWT","LA":"LAO","LB":"LBN","LR":"LBR","LY":"LBY","LC":"LCA","LI":"LIE","LK":"LKA","LS":"LSO","LT":"LTU","LU":"LUX","LV":"LVA","MO":"MAC","MF":"MAF","MA":"MAR","MC":"MCO","MD":"MDA","MG":"MDG","MV":"MDV","MX":"MEX","MH":"MHL","MK":"MKD","ML":"MLI","MT":"MLT","MM":"MMR","ME":"MNE","MN":"MNG","MP":"MNP","MZ":"MOZ","MR":"MRT","MS":"MSR","MQ":"MTQ","MU":"MUS","MW":"MWI","MY":"MYS","YT":"MYT","NA":"NAM","NC":"NCL","NE":"NER","NF":"NFK","NG":"NGA","NI":"NIC","NU":"NIU","NL":"NLD","NO":"NOR","NP":"NPL","NR":"NRU","NZ":"NZL","OM":"OMN","PK":"PAK","PA":"PAN","PN":"PCN","PE":"PER","PH":"PHL","PW":"PLW","PG":"PNG","PL":"POL","PR":"PRI","KP":"PRK","PT":"PRT","PY":"PRY","PS":"PSE","PF":"PYF","QA":"QAT","RE":"REU","RO":"ROU","RU":"RUS","RW":"RWA","SA":"SAU","SD":"SDN","SN":"SEN","SG":"SGP","GS":"SGS","SH":"SHN","SJ":"SJM","SB":"SLB","SL":"SLE","SV":"SLV","SM":"SMR","SO":"SOM","PM":"SPM","RS":"SRB","SS":"SSD","ST":"STP","SR":"SUR","SK":"SVK","SI":"SVN","SE":"SWE","SZ":"SWZ","SX":"SXM","SC":"SYC","SY":"SYR","TC":"TCA","TD":"TCD","TG":"TGO","TH":"THA","TJ":"TJK","TK":"TKL","TM":"TKM","TL":"TLS","TO":"TON","TT":"TTO","TN":"TUN","TR":"TUR","TV":"TUV","TW":"TWN","TZ":"TZA","UG":"UGA","UA":"UKR","UM":"UMI","UY":"URY","US":"USA","UZ":"UZB","VA":"VAT","VC":"VCT","VE":"VEN","VG":"VGB","VI":"VIR","VN":"VNM","VU":"VUT","WF":"WLF","WS":"WSM","YE":"YEM","ZA":"ZAF","ZM":"ZMB","ZW":"ZWE","XK":"XKX"};
const H = {'content-type':'application/json; charset=utf-8','cache-control':'public,max-age=3600', 'x-content-type-options':'nosniff'};
const norm = x => String(x || '').trim().toUpperCase();
const isCode = x => /^[A-Z]{3,4}$/.test(x);
function json(body,status=200) {return new Response(JSON.stringify(body),{status,headers:H});}
function extract(rec,code) {
  const item=rec?.airport || rec;
  if (!item || typeof item !== 'object') return null;
  const iata=norm(item.iata || item.iata_code), icao=norm(item.icao || item.icao_code);
  if (code !== iata && code !== icao) return null;
  const name = String(item.name || '').trim();
  if (!name) return null;
  const rawCountry=item.country || item.iso_country || item.country_code;
  const c = typeof rawCountry === 'string' ? rawCountry :
    (rawCountry?.iso2 || rawCountry?.code || rawCountry?.iso_code || '');
  const country = norm(c);
  return {name, country_iso3: country.length===3 ? country : COUNTRIES[country] || null};
}
async function lookupAirport(code) {
  // Przy nietypowym kodzie ICAO źródła zewnętrzne mogą nie znać rekordu.
  const fallback = FALLBACK[code] || null;
  if (code.length === 3) {
    try {
      const url=`https://airportmiles.com/api/v1/airports/${code.toLowerCase()}.json`;
      const r=await fetch(url, {headers:{Accept:'application/json'},
        cf:{cacheTtl:604800,cacheEverything:true},signal:AbortSignal.timeout(6500)});
      if (r.ok) {
        const found=extract(await r.json(),code);
        if (found) return {...fallback,...found,country_iso3:found.country_iso3||fallback?.country_iso3||null};
      }
    } catch { /* Brak danych z API: spróbuj zapasowych */ }
  }
  // Drugie źródło: wyszukiwarka po kodzie ICAO/IATA
  try {
    const url=`https://api.freeairportdb.com/v1/airports?q=${encodeURIComponent(code)}&limit=10`;
    const r=await fetch(url,{headers:{Accept:'application/json'},
      cf:{cacheTtl:604800,cacheEverything:true},signal:AbortSignal.timeout(5000)});
    if (r.ok) {
      const data=await r.json();
      const list=Array.isArray(data)?data:
        Array.isArray(data.data)?data.data:Array.isArray(data.airports)?data.airports:
        Array.isArray(data.results)?data.results:[];
      const found=list.map(x=>extract(x,code)).find(Boolean);
      if (found) return {...fallback,...found,country_iso3:found.country_iso3||fallback?.country_iso3||null};
    }
  } catch { /* Awaria API nie blokuje śledzenia samolotów. */ }
  return fallback;
}
export async function onRequestGet({request}) {
  const u=new URL(request.url);
  const codes=[...new Set((u.searchParams.get('codes')||'').split(',').map(norm).filter(isCode))].slice(0,12);
  if (!codes.length) return json({airports:{}});
  const found=await Promise.all(codes.map(async code=>[code,await lookupAirport(code)]));
  const airports=Object.fromEntries(found.filter(([k,v])=>Boolean(v)));
  return json({airports,source:'AirportMiles / FreeAirportDB / fallback'});
}
