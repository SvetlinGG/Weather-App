

// ---------- DOM helpers ----------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- State ----------
const state = {
  units: localStorage.getItem("units") || "metric",
  place: JSON.parse(localStorage.getItem("place") || "null") || {
    name: "Berlin",
    country: "DE",
    latitude: 52.52,
    longitude: 13.41,
  },
  data: null
};

// ---------- API builders ----------
const API = {
  geocode: (q) =>
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
  reverse: (lat, lon) =>
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`,
  forecast(lat, lon) {
    const units = state.units === "metric"
      ? { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }
      : { temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch" };

    const params = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: "auto",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      hourly:  "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      daily:   "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      ...units
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }
};

// ---------- Utilities ----------
const debounce = (fn, delay=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), delay); }; };
const getJSON  = (url) => fetch(url).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });

function iconFor(code){
  if ([0].includes(code)) return "☀️";
  if ([1].includes(code)) return "🌤️";
  if ([2].includes(code)) return "⛅";
  if ([3].includes(code)) return "☁️";
  if ([45,48].includes(code)) return "🌫️";
  if ([51,53,55,56,57].includes(code)) return "🌦️";
  if ([61,63,65,80,81,82].includes(code)) return "🌧️";
  if ([66,67].includes(code)) return "🌧️";
  if ([71,73,75,77,85,86].includes(code)) return "❄️";
  if ([95,96,99].includes(code)) return "⛈️";
  return "🌡️";
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
const fmtDay  = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday:"short" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour:"numeric" });

function setStatus(msg){ const el = $("#status"); if (el) el.textContent = msg || ""; }
function setUnitsUI(){
  const u = state.units === "metric";
  const elTemp   = $("#tempUnit");
  const elFeels  = $("#feelsUnit");
  const elWind   = $("#windUnit");
  const elPrecip = $("#precipUnit");
  if (elTemp)   elTemp.textContent   = u ? "°C" : "°F";
  if (elFeels)  elFeels.textContent  = u ? "°C" : "°F";
  if (elWind)   elWind.textContent   = u ? "km/h" : "mph";
  if (elPrecip) elPrecip.textContent = u ? "mm"  : "in";
  const sel = $("#unitToggle");
  if (sel) sel.value = state.units;
}

// ---------- Renderers ----------
function renderCurrent(){
  if (!state?.data?.current) return;
  const { current } = state.data;
  const elPlace = $("#place");
  if (elPlace) elPlace.textContent = `${state.place.name}${state.place.country ? ", " + state.place.country : ""}`;
  const elDate = $("#date");
  if (elDate) elDate.textContent = fmtDate(new Date().toISOString());
  const elIcon = $("#currentIcon");
  if (elIcon) elIcon.textContent = iconFor(current.weather_code);
  const elTemp = $("#temp"); if (elTemp) elTemp.textContent = Math.round(current.temperature_2m);
  const elFeels = $("#feelsLike"); if (elFeels) elFeels.textContent = Math.round(current.apparent_temperature);
  const elHum = $("#humidity"); if (elHum) elHum.textContent = Math.round(current.relative_humidity_2m);
  const elWind = $("#wind"); if (elWind) elWind.textContent = Math.round(current.wind_speed_10m);
  const elPrec = $("#precip"); if (elPrec) elPrec.textContent = (current.precipitation ?? 0).toFixed(1).replace(/\.0$/, "");
}

function renderDaily(){
  const wrap = $("#dailyList");
  if (!wrap || !state?.data?.daily) return;
  const d  = state.data.daily;
  wrap.innerHTML = "";
  d.time.forEach((date, i) => {
    const li = document.createElement("li");
    li.className = "daily__item";
    li.innerHTML = `
      <div class="daily__day">${fmtDay(date)}</div>
      <div class="daily__icon" aria-hidden="true">${iconFor(d.weather_code[i])}</div>
      <div class="daily__temps"><span>${Math.round(d.temperature_2m_max[i])}°</span> <small>${Math.round(d.temperature_2m_min[i])}°</small></div>
    `;
    wrap.appendChild(li);
  });
}

// NEXT 12 HOURS (rolling from now)
function renderHourly(){
  const list = $("#hourlyList");
  if (!list || !state?.data?.hourly?.time) return;

  const h = state.data.hourly;
  const now = Date.now();
  const picked = [];

  for (let i = 0; i < h.time.length && picked.length < 12; i++) {
    const ts = new Date(h.time[i]).getTime();
    if (ts >= now) {
      picked.push({ time: h.time[i], code: h.weather_code[i], temp: h.temperature_2m[i] });
    }
  }
  // Fallback: if no future slots exist, show the last 12 records
  if (picked.length === 0) {
    const n = h.time.length;
    for (let i = Math.max(0, n - 12); i < n; i++) {
      picked.push({ time: h.time[i], code: h.weather_code[i], temp: h.temperature_2m[i] });
    }
  }

  list.innerHTML = picked.map(it => `
    <li class="hourly__item">
      <span class="hourly__time">${fmtTime(it.time)}</span>
      <span class="hourly__icon" aria-hidden="true">${iconFor(it.code)}</span>
      <span class="hourly__temp">${Math.round(it.temp)}°</span>
    </li>
  `).join("");
}

function renderAll(){
  setUnitsUI();
  renderCurrent();
  renderDaily();
  renderHourly();
}

// -----City Background -----//

// Build a nice query string for photos
function cityQuery(place){
  return [place?.name, place?.country].filter(Boolean).join(" ");
}

// Try Unsplash Source first (no API key). Returns Promise<string URL>
function getUnsplashURL(query){
  // 'featured' дава по-качествени кадри, 'sig' избягва кеширане
  const src = `https://source.unsplash.com/featured/1600x900/?${encodeURIComponent(query + ",city,skyline,landmark")}&sig=${Date.now()}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img.src);
    img.onerror = reject;
    img.src = src;
  });
}

// Fallback: Wikipedia (generator=search + pageimages). Returns Promise<string URL>
function getWikipediaImageURL(query){
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
              `&prop=pageimages&piprop=original|thumbnail&pithumbsize=1600` +
              `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1`;
  return getJSON(url).then(data => {
    const pages = data?.query?.pages;
    if(!pages) throw new Error("No wiki pages");
    const first = Object.values(pages)[0];
    const src = first?.original?.source || first?.thumbnail?.source;
    if(!src) throw new Error("No wiki image");
    return src;
  });
}

// Apply photo to the hero card background

function updateHeroBackground(place){
  const hero = $("#currentCard");
  if (!hero || !place) return;

  const q = cityQuery(place);
  
  getUnsplashURL(q)
    .catch(() => getWikipediaImageURL(q))
    .then(url => {
      hero.style.setProperty("--hero-image", `url("${url}")`);
    })
    .catch(() => {
      
      hero.style.removeProperty("--hero-image");
    });
}



// ---------- Data loading ----------
function loadForecast(place){
  setStatus("Loading…");
  return getJSON(API.forecast(place.latitude, place.longitude))
    .then(data => {
      state.data = data;
      state.place = place;
      localStorage.setItem("place", JSON.stringify(place));
      renderAll();
      updateHeroBackground(place);
      setStatus("");
    })
    .catch(err => {
      console.error(err);
      setStatus("Could not load forecast. Please try again.");
    });
}

// ---------- Search + suggestions ----------
const runSuggest = debounce((query) => {
  const menu = $("#suggestions");
  if(!menu) return;
  if(!query.trim()){
    menu.style.display = "none";
    menu.innerHTML = "";
    return;
  }
  getJSON(API.geocode(query))
    .then(res => {
      const results = (res.results || []).slice(0,5);
      if(!results.length){
        menu.style.display = "none";
        menu.innerHTML = "";
        return;
      }
      menu.innerHTML = results.map(r => {
        const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
        return `<li data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}" data-country="${r.country_code||""}">${label}</li>`;
      }).join("");
      menu.style.display = "block";
    })
    .catch(() => { menu.style.display = "none"; menu.innerHTML = ""; });
}, 350);

// ---------- Init & Events ----------
document.addEventListener("DOMContentLoaded", () => {
  // Update hourly title & hide day picker (12h mode)
  const title = document.querySelector(".right .section-title");
  if (title) title.textContent = "Next 12 hours";
  const picker = document.getElementById("dayPicker");
  if (picker) picker.style.display = "none";

  // Hook up events ONLY if elements exist
  const elSearchInput = $("#searchInput");
  const elSuggestions = $("#suggestions");
  const elSearchForm  = $("#searchForm");
  const elUnitToggle  = $("#unitToggle");
  const elGeoBtn      = $("#geoBtn");

  if (elSearchInput) {
    elSearchInput.addEventListener("input", (e)=> runSuggest(e.target.value));
  }

  if (elSuggestions) {
    elSuggestions.addEventListener("click", (e)=>{
      const li = e.target.closest("li"); if(!li) return;
      const place = {
        name: li.dataset.name,
        country: li.dataset.country,
        latitude: Number(li.dataset.lat),
        longitude: Number(li.dataset.lon),
      };
      if (elSearchInput) elSearchInput.value = `${place.name}${place.country ? ", "+place.country : ""}`;
      elSuggestions.style.display = "none";
      loadForecast(place);
    });
  }

  if (elSearchForm) {
    elSearchForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const q = (elSearchInput?.value || "").trim();
      if(!q) return;
      setStatus("Searching…");
      getJSON(API.geocode(q))
        .then(res => {
          const r = res.results && res.results[0];
          if(!r){ setStatus("Place not found."); throw "no-result"; }
          return loadForecast({ name:r.name, country:r.country_code, latitude:r.latitude, longitude:r.longitude });
        })
        .catch(err => { if (err !== "no-result") setStatus("Search failed. Try again."); });
    });
  }

  if (elUnitToggle) {
    elUnitToggle.addEventListener("change", (e)=>{
      state.units = e.target.value;
      localStorage.setItem("units", state.units);
      if(state.place) loadForecast(state.place);
    });
  }

  if (elGeoBtn) {
    elGeoBtn.addEventListener("click", ()=>{
      if(!navigator.geolocation){ setStatus("Geolocation not supported."); return; }
      setStatus("Locating…");
      navigator.geolocation.getCurrentPosition(
        (pos)=>{
          const { latitude, longitude } = pos.coords;
          getJSON(API.reverse(latitude, longitude))
            .then(rev => {
              const r = rev && rev.results && rev.results[0];
              const place = {
                name: r ? r.name : "My location",
                country: r ? (r.country_code || "") : "",
                latitude, longitude
              };
              return loadForecast(place);
            })
            .catch(() => loadForecast({ name: "My location", country: "", latitude, longitude }));
        },
        ()=> setStatus("Permission denied for location.")
      );
    });
  }

  // Initial UI + first load
  setUnitsUI();
  if (elSearchInput) elSearchInput.value = "";
  loadForecast(state.place);

  // ---Add Video ---//

  const v = document.getElementById("cloudsVideo");
  if (v) {
    v.playbackRate = 0.6; // 0.5–0.8 е приятен диапазон
    const tryPlay = v.play();
    if (tryPlay && typeof tryPlay.catch === "function") {
      tryPlay.catch(() => { /* някои браузъри изискват потребителско взаимодействие – игнорирай грешката */ });
    }
  }
});
