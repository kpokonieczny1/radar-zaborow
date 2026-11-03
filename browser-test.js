
'use strict';
const CENTERS = Object.freeze({
  Zaborów: Object.freeze({lat:52.2629444444, lon:20.6860833333}),
  Mieszkanie: Object.freeze({lat:52.2803, lon:20.9214805556}),
  Praca: Object.freeze({lat:52.2534111111, lon:20.90465}),
});
const DEFAULT_CENTER = CENTERS.Zaborów;
function centerLabel(c) {
  return Object.keys(CENTERS).find(name =>
    Math.abs(c.lat - CENTERS[name].lat) < 0.0000001 &&
    Math.abs(c.lon - CENTERS[name].lon) < 0.0000001) || 'Własny środek';
}
const DEG = Math.PI / 180;
const IDLE_MS = 30000;
const METADATA_MS = 90000;      // zdjęcia i trasy najwyżej raz na 90 s
const NEW_PLANE_METADATA_MS = 15000;
const el = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const textOrDash = value => value == null || value === '' ? 'Brak danych' : String(value);
const goodRadius = n => Number.isFinite(n) && n >= 1 && n <= 200;
const goodInterval = n => Number.isInteger(n) && n >= 3 && n <= 300;
const formatCoord = n => n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
// Współrzędne: 52.26294444 lub 52 15 46,6; opcjonalnie N/S/E/W.
function parseCoord(value, limit) {
  let input = String(value).trim().toUpperCase();
  const hemisphere = (input.match(/[NSEW]$/) || [])[0];
  if (hemisphere) input = input.slice(0, -1).trim();
  const parts = input.replace(/[°º′'″"\s]+/g, ' ').trim().split(' ');
  if (parts.length < 1 || parts.length > 3 || !parts.every(p => /^[+-]?\d+(?:[.,]\d+)?$/.test(p))) return null;
  const numbers = parts.map(p => Number(p.replace(',', '.')));
  if (parts.length > 1 && (!Number.isInteger(numbers[0]) || !Number.isInteger(numbers[1])
      || numbers[1] >= 60 || numbers[1] < 0 || (parts.length === 3 && (numbers[2] >= 60 || numbers[2] < 0)))) return null;
  const sign = numbers[0] < 0 || hemisphere === 'S' || hemisphere === 'W' ? -1 : 1;
  const valueDeg = sign * (Math.abs(numbers[0]) + (numbers[1] || 0)/60 + (numbers[2] || 0)/3600);
  if (!Number.isFinite(valueDeg) || Math.abs(valueDeg) > limit) return null;
  if ((limit === 90 && (hemisphere === 'E' || hemisphere === 'W'))
      || (limit === 180 && (hemisphere === 'N' || hemisphere === 'S'))) return null;
  return valueDeg;
}
const AIRLINES = Object.freeze({
  LOT: ['LOT Polish Airlines','LO'], RYR: ['Ryanair','FR'], WZZ: ['Wizz Air','W6'],
  DLH: ['Lufthansa','LH'], BAW: ['British Airways','BA'], KLM: ['KLM','KL'],
  AFR: ['Air France','AF'], UAE: ['Emirates','EK'], THY: ['Turkish Airlines','TK'],
  SAS: ['Scandinavian Airlines','SK'], EZY: ['easyJet','U2'], ENT: ['Enter Air','E4']
});
// Fotografia podana przez użytkownika. Nie kopiujemy pliku zdjęcia na hosting;
// wymagane jest upewnienie się, że publiczne osadzanie jest dozwolone.
const USER_PHOTOS = Object.freeze({
  'SP-LYI': {
    thumbnail:'https://cdn.jetphotos.com/full/6/403071_1788942970.jpg',
    link:'https://www.jetphotos.com/photo/12226928',
    photographer:'Paweł Cieplak', source:'JetPhotos'
  }
});
function k(plane) { return String(plane.hex || plane.flight || plane.registration || '').toUpperCase(); }
function field(label, value, role = '') {
  return `<div><span class="label">${escapeHtml(label)}</span><div class="value"${role ? ` data-role="${role}"` : ''}>${escapeHtml(textOrDash(value))}</div></div>`;
}
function routeAirportHTML(airport, direction) {
  const departure = direction === 'origin';
  const details = airportLookup(airport);
  const code = details.code;
  const country = /^[A-Z]{3}$/.test(details.country_iso3 || '') ? details.country_iso3 : '';
  const label = departure ? 'Wylot' : 'Przylot';
  const name = details.name || 'Nazwa lotniska nieznana';
  return `<div class="routeAirport ${departure ? 'origin' : 'destination'}">
    <span class="routeCaption">${label}</span>
    <div class="routePrimary"><strong class="routeCode">${escapeHtml(code)}</strong>
      ${country ? `<span class="routeCountry" title="Kod kraju ISO 3166-1 alpha-3">${escapeHtml(country)}</span>` : ''}
    </div>
    <div class="routeAirportName">${escapeHtml(name)}</div></div>`;
}
function routeHTML(f) {
  if (!f.from || !f.to) return `<div class="routeUnavailable">${fr24Active ? 'FR24: trwa wyszukiwanie lub brak potwierdzonej trasy' : 'Trasa nieustalona'}</div>`;
  return `<div class="routeStrip" aria-label="Trasa lotu">
    ${routeAirportHTML(f.from, 'origin')}
    <span class="routeArrow" aria-hidden="true">➜</span>
    ${routeAirportHTML(f.to, 'destination')}
  </div>`;
}
function flightDetails(f) {
  const ident = String(f.flight || '').slice(0, 3).toUpperCase();
  const airline = AIRLINES[ident];
  return {
    name: airline?.[0] || f.operator || 'Nieznany przewoźnik',
    iata: /^[A-Z0-9]{2}$/.test(f.airline_iata || '') ? f.airline_iata : airline?.[1] || '',
  };
}
function logoHTML(f) {
  const airline = flightDetails(f);
  if (!airline.iata) return '<div class="logoPlaceholder" aria-hidden="true">✈</div>';
  const code = encodeURIComponent(airline.iata);
  return `<div class="logoWrap"><img src="https://pics.avs.io/100/45/${code}.png" alt="Logo ${escapeHtml(airline.name)}" loading="lazy"><span class="logoPlaceholder" hidden>✈</span></div>`;
}
function photoHTML(f) {
  const manual = USER_PHOTOS[String(f.registration || '').toUpperCase()];
  const photo = manual || f.photo;
  if (!photo?.thumbnail) return '<div class="photoPlaceholder" aria-label="Zdjęcie niedostępne"><span>✈</span>Brak zdjęcia</div>';
  const fallback = manual ? f.photo : f.photo_fallback;
  // Link jest wyłącznie na miniaturze (atrybucja licencyjna), bez przycisków w karcie.
  const href = photo.link && /^https:\/\//.test(photo.link) ? photo.link : '';
  return `<figure class="aircraftPhoto">
    <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" tabindex="-1">
      <img src="${escapeHtml(photo.thumbnail)}" alt="${escapeHtml(f.registration || f.model || 'Samolot')}"
        loading="lazy" referrerpolicy="no-referrer"
        data-alt-src="${escapeHtml(fallback?.thumbnail || '')}"
        data-alt-link="${escapeHtml(fallback?.link || '')}"
        data-alt-source="${escapeHtml(fallback?.source || '')}"
        data-alt-author="${escapeHtml(fallback?.photographer || '')}"></a>
    <figcaption>${escapeHtml(photo.photographer ? '© ' + photo.photographer : 'Fotografia')}
      · ${escapeHtml(photo.source || 'Źródło zdjęcia')}</figcaption></figure>`;
}
function flightCard(f) {
  const near = f.km <= 10, company = flightDetails(f);
  const distance = `${escapeHtml(f.km)} km${near ? ' · strefa 10 km' : ''}`;
  const hasRoute = f.from && f.to;
  return `<article class="flight" data-flight-key="${escapeHtml(k(f))}">
    <div class="flightTop"><div class="flightIdentity">${logoHTML(f)}<div>
      <strong>${escapeHtml(f.flight || f.registration || f.hex || 'Samolot')}</strong>
      <div class="company">${escapeHtml(company.name)}</div></div></div>
      <span class="dist ${near ? 'near' : ''}" data-role="dist">${distance}</span></div>
    <div class="flightMain"><div>${photoHTML(f)}</div><div class="flightData">
      <div class="fields">
        ${field('Samolot', f.model)}${field('Rejestracja', f.registration)}
        ${f.flight_number ? field('Numer rejsu', f.flight_number) : ''}
        ${field('Wysokość', f.altitude_m == null ? null : f.altitude_m.toLocaleString('pl-PL') + ' m', 'alt')}
        ${field('Prędkość', f.speed_kmh == null ? null : f.speed_kmh + ' km/h', 'speed')}
      </div>
      ${routeHTML(f)}
    </div></div>${hasRoute ? `<div class="routeNote">Źródło trasy: ${escapeHtml(f.route_source || 'baza lotnicza')} · ${f.route_source === 'Flightradar24 API' ? 'bieżący rejs FR24' : 'dane niezweryfikowane'}</div>` : ''}</article>`;
}

let radius = 10;
let center = { ...DEFAULT_CENTER };
let activeMs = 3000;
try {
  const savedRadius = Number(localStorage.getItem('radar-zaborow-radius'));
  const savedLat = Number(localStorage.getItem('radar-zaborow-lat'));
  const savedLon = Number(localStorage.getItem('radar-zaborow-lon'));
  const savedInterval = Number(localStorage.getItem('radar-zaborow-active-seconds'));
  if (goodRadius(savedRadius)) radius = savedRadius;
  if (localStorage.getItem('radar-zaborow-lat') !== null && localStorage.getItem('radar-zaborow-lon') !== null
    && Number.isFinite(savedLat) && Number.isFinite(savedLon)
    && Math.abs(savedLat) <= 90 && Math.abs(savedLon) <= 180) center = {lat:savedLat, lon:savedLon};
  if (goodInterval(savedInterval)) activeMs = savedInterval * 1000;
} catch { /* pamięć opcjonalna */ }
el('radiusInput').value = String(radius);
el('latitudeInput').value = formatCoord(center.lat);
el('longitudeInput').value = formatCoord(center.lon);
el('activeIntervalInput').value = String(activeMs / 1000);
function renderCenter() {
  const label = centerLabel(center);
  const display = `${formatCoord(center.lat)}°, ${formatCoord(center.lon)}°`;
  el('centerSubtitle').textContent = `Samoloty · ${label} · ${display}`;
  el('radarCenterName').textContent = label === 'Własny środek' ? 'Środek' : label;
  el('radar').setAttribute('aria-label', `Pozycje samolotów względem punktu ${display}`);
}
renderCenter();

let current = [];
let meta = new Map();
let timer = null;
let positionAbort = null;
let detailAbort = null;
let detailInFlight = false;
let lastDetailAttempt = 0;
let requestEpoch = 0;
let pollSerial = 0;
let cardKeys = '';
// Trasy FR24 nie są odpytywane podczas pobierania pozycji (3 s).
// Kod dostępu istnieje wyłącznie w pamięci tej karty przeglądarki.
// PIN nigdy nie jest w HTML. Sesyjne przechowanie pozwala uniknąć
// ponownego pytania podczas przeładowania strony w tej samej karcie.
let fr24Pin = '';
try { fr24Pin = sessionStorage.getItem('radar-fr24-session-pin') || ''; } catch {}
let fr24Active = Boolean(fr24Pin);
let fr24Busy = false;
let fr24Abort = null;
let fr24Routes = new Map();
const airportDirectory = new Map();
const airportLookupAt = new Map();
let airportLookupBusy = false;
try {
  const saved = JSON.parse(localStorage.getItem('radar-airport-directory-v1') || '{}');
  for (const [code, entry] of Object.entries(saved)) {
    if (/^[A-Z]{3,4}$/.test(code) && entry && typeof entry.name === 'string')
      airportDirectory.set(code, entry);
  }
} catch {}
function airportLookup(airport) {
  const code = String(airport?.code || '').trim().toUpperCase();
  const found = airportDirectory.get(code);
  return {
    code:code || '—',
    name: airport?.name || found?.name || null,
    country_iso3:airport?.country_iso3 || found?.country_iso3 || null,
  };
}
let fr24Attempts = new Map();
const FR24_SUCCESS_MS = 30 * 60 * 1000;
const FR24_MISS_MS = 5 * 60 * 1000;
let fr24LastBatch = 0;
const FR24_BATCH_INTERVAL_MS = 15000;

function merged(plane) {
  const base = {
    ...plane, ...(meta.get(k(plane)) || {}),
    lat:plane.lat, lon:plane.lon, km:plane.km,
    altitude_m:plane.altitude_m, speed_kmh:plane.speed_kmh, track:plane.track,
  };
  // FR24 zmienia TYLKO dane trasy i numer rejsu — nie dotyka zdjęć,
  // modeli, wysokości, logo, prędkości ani pozycji ADS-B.
  if (!fr24Active) return base;
  const route = fr24Routes.get(`${k(plane)}|${String(plane.flight || '').toUpperCase()}`);
  // W trybie FR24 nie pokazujemy starej, potencjalnie błędnej trasy z baz ADS-B.
  return route ? {...base, ...route} : {
    ...base, from: null, to: null, route_source: null,
    route_status: 'FR24: oczekiwanie na trasę lub brak dopasowania',
    flight_number: null,
  };
}
function radarPoints() {
  el('zone10').setAttribute('r', String(178 * Math.min(1, 10 / radius)));
  el('rangeLabel').textContent = radius.toLocaleString('pl-PL') + ' km';
  let svg = '';
  for (const f of current) {
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue;
    const dx = (f.lon - center.lon) * Math.cos(center.lat * DEG) * 111.2;
    const dy = (f.lat - center.lat) * 111.2;
    const x = 200 + dx / radius * 178, y = 200 - dy / radius * 178;
    if (Math.hypot(x - 200, y - 200) > 178) continue;
    svg += `<g><circle class="dot ${f.km <= 10 ? 'near' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>
      <text class="planeLabel" x="${(x+8).toFixed(1)}" y="${(y-7).toFixed(1)}">${escapeHtml(f.flight || f.registration || '✈')}</text></g>`;
  }
  el('dots').innerHTML = svg;
}
function attachMediaErrors() {
  for (const logo of el('flights').querySelectorAll('.logoWrap img')) {
    logo.addEventListener('error', () => {
      logo.hidden = true;
      const next = logo.nextElementSibling;
      if (next) next.hidden = false;
    }, { once:true });
  }
  for (const img of el('flights').querySelectorAll('.aircraftPhoto img')) {
    img.addEventListener('error', () => {
      if (img.dataset.altSrc) {
        const { altSrc, altLink, altSource, altAuthor } = img.dataset;
        img.dataset.altSrc = '';
        img.src = altSrc;
        const a = img.closest('a');
        if (a && altLink) a.href = altLink;
        const caption = img.closest('figure')?.querySelector('figcaption');
        if (caption) caption.textContent = `${altAuthor ? '© ' + altAuthor : 'Fotografia'} · ${altSource || 'Źródło zdjęcia'}`;
      } else {
        const figure = img.closest('figure');
        if (figure) figure.outerHTML = '<div class="photoPlaceholder"><span>✈</span>Brak zdjęcia</div>';
      }
    });
  }
}
function paintCards(force = false) {
  const keys = current.map(k).join('|');
  if (!force && keys === cardKeys) {
    for (const article of el('flights').querySelectorAll('[data-flight-key]')) {
      const f = current.find(p => k(p) === article.dataset.flightKey);
      if (!f) continue;
      const dist = article.querySelector('[data-role="dist"]');
      const alt = article.querySelector('[data-role="alt"]');
      const speed = article.querySelector('[data-role="speed"]');
      if (dist) {
        dist.textContent = f.km + ' km' + (f.km <= 10 ? ' · strefa 10 km' : '');
        dist.classList.toggle('near', f.km <= 10);
      }
      if (alt) alt.textContent = f.altitude_m == null ? 'Brak danych' : f.altitude_m.toLocaleString('pl-PL') + ' m';
      if (speed) speed.textContent = f.speed_kmh == null ? 'Brak danych' : f.speed_kmh + ' km/h';
    }
    return;
  }
  cardKeys = keys;
  el('flights').innerHTML = current.length
    ? current.map(p => flightCard(merged(p))).join('')
    : `<div class="empty">Brak samolotów w promieniu ${radius.toLocaleString('pl-PL')} km.</div>`;
  attachMediaErrors();
}
function updateVisuals(data) {
  current = Array.isArray(data.flights) ? data.flights : [];
  el('count').textContent = current.length + ' samolotów';
  el('nearCount').textContent = String(data.inside_10km ?? current.filter(f => f.km <= 10).length);
  el('allCount').textContent = String(current.length);
  el('radiusInfo').textContent = `Promień: ${radius.toLocaleString('pl-PL')} km (poziomo)`;
  const dt = new Date(data.updated);
  el('time').textContent = 'Stan: ' + (Number.isFinite(dt.getTime()) ? dt.toLocaleTimeString('pl-PL') : '—');
  const fast = current.length > 0;
  el('refreshInfo').textContent = fast
    ? `Co ${activeMs / 1000} s · wykryto samolot` : 'Co 30 s · brak samolotów';
  el('refreshInfo').className = fast ? 'speed fast' : 'speed';
  radarPoints();
  paintCards();
}
function schedule(ms) {
  clearTimeout(timer);
  if (!document.hidden) timer = setTimeout(pollPositions, ms);
}
function apiUrl(mode) {
  const params = new URLSearchParams({
    radius: String(radius), lat: String(center.lat), lon: String(center.lon), mode,
  });
  return `/api/flights?${params}`;
}
async function enrichIfNeeded(epoch) {
  if (!current.length || detailInFlight || document.hidden) return;
  const now = Date.now();
  const newPlane = current.some(f => !meta.has(k(f)));
  if (now - lastDetailAttempt < (newPlane ? NEW_PLANE_METADATA_MS : METADATA_MS)) return;
  lastDetailAttempt = now;
  detailInFlight = true;
  detailAbort = new AbortController();
  try {
    const response = await fetch(apiUrl('full'),
      { cache:'no-store', signal:detailAbort.signal });
    if (!response.ok) return;
    const data = await response.json();
    if (epoch !== requestEpoch) return;
    for (const f of data.flights || []) {
      meta.set(k(f), {
        registration:f.registration, model:f.model, operator:f.operator,
        airline_iata:f.airline_iata, from:f.from, to:f.to,
        route_status:f.route_status, route_source:f.route_source, route_plausible:f.route_plausible, photo:f.photo, photo_fallback:f.photo_fallback,
      });
    }
    // Ograniczamy pamięć tabletu po wielu godzinach pracy.
    if (meta.size > 250) meta = new Map([...meta].slice(-150));
    paintCards(true);
    void enrichAirports();
    void enrichRoutesIfNeeded(epoch);
  } catch { /* dane pozycyjne będą działać niezależnie od metadanych */ }
  finally { detailInFlight = false; }
}
function fr24Key(f) {
  return `${k(f)}|${String(f.flight || '').toUpperCase()}`;
}
function setFr24Info(message, active=false) {
  el('fr24Info').textContent = message;
  el('fr24Info').className = 'fr24Info' + (active ? ' active' : '');
}
async function enrichAirports() {
  if (airportLookupBusy || document.hidden) return;
  const codes = new Set();
  for (const plane of current) {
    const f = merged(plane);
    for (const a of [f.from, f.to]) {
      const code = String(a?.code || '').trim().toUpperCase();
      if (!/^[A-Z]{3,4}$/.test(code)) continue;
      const existing = airportDirectory.get(code);
      // Pobierz nazwę i kod kraju, gdy nie są znane w żadnej bazie.
      if ((!a.name || !a.country_iso3) && (!existing?.name || !existing?.country_iso3) &&
          (!airportLookupAt.has(code) || Date.now() - airportLookupAt.get(code) > 3600000)) codes.add(code);
    }
  }
  const batch = [...codes].slice(0, 12);
  if (!batch.length) return;
  airportLookupBusy = true;
  for (const code of batch) airportLookupAt.set(code, Date.now());
  try {
    const r = await fetch('/api/airports?codes='+encodeURIComponent(batch.join(',')), {cache:'no-store'});
    if (!r.ok) return;
    const json = await r.json();
    let updated = false;
    for (const [code, entry] of Object.entries(json.airports || {})) {
      if (entry?.name && /^[A-Z]{3,4}$/.test(code)) {
        airportDirectory.set(code, {name:entry.name, country_iso3:entry.country_iso3 || null});
        updated = true;
      }
    }
    if (updated) {
      try {localStorage.setItem('radar-airport-directory-v1',JSON.stringify(Object.fromEntries(airportDirectory)));} catch {}
      paintCards(true);
    }
  } catch { /* Niewykryte lotnisko pozostaje z kodem, bez zgadywania nazwy. */ }
  finally { airportLookupBusy = false; }
}

async function enrichRoutesIfNeeded(epoch) {
  if (!fr24Active || fr24Busy || document.hidden) return;
  const now = Date.now();
  if (now - fr24LastBatch < FR24_BATCH_INTERVAL_MS) return;
  const candidates = current.filter(f => /^[A-Z0-9]{3,10}$/.test(f.flight || '')
    && (!fr24Attempts.has(fr24Key(f)) || now - fr24Attempts.get(fr24Key(f)).time >
       (fr24Attempts.get(fr24Key(f)).hit ? FR24_SUCCESS_MS : FR24_MISS_MS))).slice(0,10);
  if (!candidates.length) return;
  fr24Busy = true;
  fr24LastBatch = now;
  fr24Abort = new AbortController();
  // Zaznacz próbę przed rozpoczęciem pobierania, aby szybkie odświeżanie
  // co 3 s nie uruchomiło drugiego zapytania równolegle.
  for (const plane of candidates) fr24Attempts.set(fr24Key(plane), {time:now, hit:false});
  setFr24Info('Sprawdzanie tras w FR24…', true);
  try {
    const response = await fetch('/api/fr24-routes', {
      method:'POST', cache:'no-store', signal:fr24Abort.signal,
      headers:{'content-type':'application/json'},
      body:JSON.stringify({pin:fr24Pin, aircraft:candidates.map(f => ({
        callsign:f.flight,hex:f.hex,registration:f.registration,
      }))}),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || `FR24 HTTP ${response.status}`);
    if (epoch !== requestEpoch || !fr24Active) return;
    let found = 0;
    for (const plane of candidates) {
      const key = fr24Key(plane);
      const route = json.routes?.[String(plane.flight).toUpperCase()];
      if (route?.from?.code && route?.to?.code) {
        fr24Routes.set(key, route);
        fr24Attempts.set(key, {time:Date.now(), hit:true});
        found++;
      }
    }
    if (fr24Routes.size > 150) fr24Routes = new Map([...fr24Routes].slice(-100));
    if (fr24Attempts.size > 200) fr24Attempts = new Map([...fr24Attempts].slice(-150));
    setFr24Info(`FR24 aktywne · ${found} nowych tras · pozycje z ADS-B`, true);
    if (found) { paintCards(true); void enrichAirports(); }
  } catch (error) {
    if (error.name === 'AbortError') return;
    setFr24Info(`FR24: ${error.message}. Pozycje ADS-B nadal działają.`);
    // Nie ponawiamy co 3 s po błędzie autoryzacji lub brakującej zgody.
    if (/nieaktywna|Brak konfiguracji|kod dostępu|uprawnień/i.test(error.message)) {
      fr24Active = false;
      el('fr24Toggle').textContent = 'Włącz trasy FR24';
      fr24Pin = '';
      try {sessionStorage.removeItem('radar-fr24-session-pin');} catch {}
    }
  } finally { fr24Busy = false; fr24Abort = null; }
}

function toggleFR24() {
  if (fr24Active) {
    fr24Active = false;
    fr24Pin = '';
    try {sessionStorage.removeItem('radar-fr24-session-pin');} catch {}
    el('fr24Toggle').textContent = 'Włącz trasy FR24';
    if (fr24Abort) fr24Abort.abort();
    fr24Routes.clear(); fr24Attempts.clear();
    setFr24Info('FR24 wyłączone · dostępne są trasy orientacyjne z innych baz.');
    paintCards(true);
    void enrichAirports();
    return;
  }
  const pin = window.prompt('Prywatny kod FR24 z Cloudflare (wpisujesz raz na kartę):');
  if (pin === null) return;
  if (pin.trim().length < 8) {
    setFr24Info('Kod musi mieć co najmniej 8 znaków.'); return;
  }
  fr24Pin = pin.trim();
  try {sessionStorage.setItem('radar-fr24-session-pin',fr24Pin);} catch {}
  fr24Active = true;
  paintCards(true);
  el('fr24Toggle').textContent = 'Wyłącz trasy FR24';
  setFr24Info('FR24: szukam tras aktualnie śledzonych samolotów…', true);
  void enrichRoutesIfNeeded(requestEpoch);
}
el('fr24Toggle').addEventListener('click',toggleFR24);
if (fr24Active) {
  el('fr24Toggle').textContent = 'Wyłącz trasy FR24';
  setFr24Info('Trasy FR24 aktywne · dostęp sesyjny', true);
}

async function pollPositions() {
  clearTimeout(timer);
  if (document.hidden) return;
  const epoch = requestEpoch;
  const serial = ++pollSerial;
  if (positionAbort) positionAbort.abort();
  positionAbort = new AbortController();
  let next = current.length ? activeMs : IDLE_MS;
  el('status').textContent = 'Aktualizacja…';
  try {
    const res = await fetch(apiUrl('positions'),
      { cache:'no-store', signal:positionAbort.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    if (epoch !== requestEpoch || serial !== pollSerial) return;
    updateVisuals(data);
    next = current.length ? activeMs : IDLE_MS;
    el('status').textContent = `● Radar działa · ${data.source || 'ADS-B'}`;
    el('status').className = 'pill';
    void enrichIfNeeded(epoch);
    void enrichRoutesIfNeeded(epoch);
    void enrichAirports();
  } catch (error) {
    if (epoch !== requestEpoch || serial !== pollSerial || error.name === 'AbortError') return;
    el('status').textContent = '⚠ Brak połączenia';
    el('status').className = 'pill bad';
    el('refreshInfo').textContent = 'Ponowna próba za 30 s';
    el('refreshInfo').className = 'speed';
    // Spowolnij próby po błędach lub limitach API.
    next = IDLE_MS;
    if (!current.length) el('flights').innerHTML = `<div class="empty">Błąd pobierania danych: ${escapeHtml(error.message)}</div>`;
  } finally {
    if (epoch === requestEpoch && serial === pollSerial) schedule(next);
  }
}
function applySettings(newRadius, newCenter, newMs) {
  const changedArea = radius !== newRadius || center.lat !== newCenter.lat || center.lon !== newCenter.lon;
  radius = newRadius;
  center = newCenter;
  activeMs = newMs;
  el('settingsError').textContent = '';
  el('radiusInput').value = String(radius);
  el('latitudeInput').value = formatCoord(center.lat);
  el('longitudeInput').value = formatCoord(center.lon);
  el('activeIntervalInput').value = String(activeMs / 1000);
  renderCenter();
  try {
    localStorage.setItem('radar-zaborow-radius', String(radius));
    localStorage.setItem('radar-zaborow-lat', String(center.lat));
    localStorage.setItem('radar-zaborow-lon', String(center.lon));
    localStorage.setItem('radar-zaborow-active-seconds', String(activeMs / 1000));
  } catch {}
  if (!changedArea) {
    el('refreshInfo').textContent = current.length
      ? `Co ${activeMs / 1000} s · wykryto samolot` : 'Co 30 s · brak samolotów';
    schedule(current.length ? activeMs : IDLE_MS);
    return;
  }
  requestEpoch++;
  cardKeys = '';
  current = [];
  meta.clear();
  fr24Routes.clear(); fr24Attempts.clear();
  lastDetailAttempt = 0;
  if (positionAbort) positionAbort.abort();
  if (detailAbort) detailAbort.abort();
  if (fr24Abort) fr24Abort.abort();
  el('flights').innerHTML = '<div class="empty">Pobieranie danych dla nowego środka radaru…</div>';
  el('count').textContent = '—';
  el('nearCount').textContent = '—';
  el('allCount').textContent = '—';
  el('radiusInfo').textContent = `Promień: ${radius.toLocaleString('pl-PL')} km (poziomo)`;
  radarPoints();
  void pollPositions();
}
el('settingsForm').addEventListener('submit', event => {
  event.preventDefault();
  const rawRadius = el('radiusInput').value.trim().replace(',', '.');
  const newRadius = Number(rawRadius);
  const lat = parseCoord(el('latitudeInput').value, 90);
  const lon = parseCoord(el('longitudeInput').value, 180);
  const rawInterval = el('activeIntervalInput').value.trim();
  const interval = Number(rawInterval);
  if (!/^\d+(?:\.\d{1,2})?$/.test(rawRadius) || !goodRadius(newRadius)) {
    el('settingsError').textContent = 'Podaj promień 1–200 km (np. 12,5).';
  } else if (lat === null || lon === null) {
    el('settingsError').textContent = 'Nieprawidłowe współrzędne. Podaj stopnie dziesiętne lub stopnie, minuty i sekundy.';
  } else if (!/^\d+$/.test(rawInterval) || !goodInterval(interval)) {
    el('settingsError').textContent = 'Częstotliwość przy wykryciu samolotu: od 3 do 300 sekund (liczba całkowita).';
  } else {
    applySettings(newRadius, {lat, lon}, interval * 1000);
  }
});
function selectCenter(c) {
  el('latitudeInput').value = formatCoord(c.lat);
  el('longitudeInput').value = formatCoord(c.lon);
  el('settingsForm').requestSubmit();
}
el('restoreCenter').addEventListener('click', () => selectCenter(CENTERS.Zaborów));
el('centerApartment').addEventListener('click', () => selectCenter(CENTERS.Mieszkanie));
el('centerWork').addEventListener('click', () => selectCenter(CENTERS.Praca));
el('refresh').addEventListener('click', () => {
  clearTimeout(timer);
  void pollPositions();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(timer);
    if (positionAbort) positionAbort.abort();
    if (detailAbort) detailAbort.abort();
    if (fr24Abort) fr24Abort.abort();
  } else {
    void pollPositions();
  }
});
void pollPositions();
