


const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));


const state = {
  units: localStorage.getItem("units") || "metric", // metric | imperial
  place: JSON.parse(localStorage.getItem("place") || "null") || {
    name: "Berlin",
    country: "DE",
    latitude: 52.52,
    longitude: 13.41,
  },
  data: null,
  selectedDayIndex: 0,
};


const API = {
  geocode: (q) =>
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
  reverse: (lat, lon) =>
    `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`,
  forecast(lat, lon) {
    const u = state.units === "metric"
      ? { temperature_unit: "celsius", wind_speed_unit: "kmh", precipitation_unit: "mm" }
      : { temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch" };

    const params = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: "auto",
      current: [
        "temperature_2m","apparent_temperature","relative_humidity_2m",
        "precipitation","weather_code","wind_speed_10m"
      ].join(","),
      hourly: [
        "temperature_2m","apparent_temperature","precipitation",
        "weather_code","wind_speed_10m"
      ].join(","),
      daily: [
        "weather_code","temperature_2m_max","temperature_2m_min",
        "precipitation_sum","wind_speed_10m_max"
      ].join(","),
      ...u
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  },
};


const debounce = (fn, delay=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), delay);} };
const getJSON = async (url) => { const r = await fetch(url); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };


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

function setStatus(msg){ 
  $("#status").textContent = msg || ""; 
}
function setUnitsUI(){
  $("#tempUnit").textContent   = state.units === "metric" ? "°C" : "°F";
  $("#feelsUnit").textContent  = state.units === "metric" ? "°C" : "°F";
  $("#windUnit").textContent   = state.units === "metric" ? "km/h" : "mph";
  $("#precipUnit").textContent = state.units === "metric" ? "mm" : "in";
  $("#unitToggle").value = state.units;
}


function renderCurrent(){
  const { current } = state.data;
  $("#place").textContent = `${state.place.name}${state.place.country ? ", " + state.place.country : ""}`;
  $("#date").textContent = fmtDate(new Date().toISOString());
  $("#currentIcon").textContent = iconFor(current.weather_code);
  $("#temp").textContent      = Math.round(current.temperature_2m);
  $("#feelsLike").textContent = Math.round(current.apparent_temperature);
  $("#humidity").textContent  = Math.round(current.relative_humidity_2m);
  $("#wind").textContent      = Math.round(current.wind_speed_10m);
  $("#precip").textContent    = (current.precipitation ?? 0).toFixed(1).replace(/\.0$/, "");
}

function renderDaily(){
  const ul = $("#dailyList");
  const d  = state.data.daily;
  ul.innerHTML = "";
  d.time.forEach((date, i) => {
    const li = document.createElement("li");
    li.className = "daily__item";
    li.innerHTML = `
      <div class="daily__day">${fmtDay(date)}</div>
      <div class="daily__icon" aria-hidden="true">${iconFor(d.weather_code[i])}</div>
      <div class="daily__temps"><span>${Math.round(d.temperature_2m_max[i])}°</span> <small>${Math.round(d.temperature_2m_min[i])}°</small></div>
    `;
    ul.appendChild(li);
  });

  
  const sel = $("#dayPicker");
  sel.innerHTML = d.time.map((t, i)=>`<option value="${i}">${fmtDay(t)}</option>`).join("");
  sel.value = state.selectedDayIndex;
}

function renderHourly(){
  const list = $("#hourlyList");
  const { hourly, daily } = state.data;
  const dayISO = daily.time[state.selectedDayIndex]; 
  list.innerHTML = "";

  // Filter hourly by selected day
  hourly.time.forEach((ts, idx) => {
    if (ts.startsWith(dayISO)) {
      const li = document.createElement("li");
      li.className = "hourly__item";
      li.innerHTML = `
        <span class="hourly__time">${fmtTime(ts)}</span>
        <span class="hourly__icon" aria-hidden="true">${iconFor(hourly.weather_code[idx])}</span>
        <span class="hourly__temp">${Math.round(hourly.temperature_2m[idx])}°</span>
      `;
      list.appendChild(li);
    }
  });
}

function renderAll(){
  setUnitsUI();
  renderCurrent();
  renderDaily();
  renderHourly();
}


async function loadForecast(place){
  setStatus("Loading…");
  try{
    const url = API.forecast(place.latitude, place.longitude);
    const data = await getJSON(url);
    state.data = data;
    state.place = place;
    localStorage.setItem("place", JSON.stringify(place));
    renderAll();
    setStatus("");
  }catch(err){
    console.error(err);
    setStatus("Could not load forecast. Please try again.");
  }
}


const suggest = debounce(async (q) => {
  const menu = $("#suggestions");
  if(!q.trim()){ menu.style.display = "none"; menu.innerHTML = ""; return; }
  try{
    const res = await getJSON(API.geocode(q));
    const results = (res.results || []).slice(0,5);
    if(!results.length){ menu.style.display = "none"; menu.innerHTML = ""; return; }
    menu.innerHTML = results.map(r => {
      const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(", ");
      return `<li data-lat="${r.latitude}" data-lon="${r.longitude}" data-name="${r.name}" data-country="${r.country_code||""}">${label}</li>`;
    }).join("");
    menu.style.display = "block";
  }catch{
    menu.style.display = "none"; menu.innerHTML = "";
  }
}, 350);


$("#searchInput").addEventListener("input", (e)=> suggest(e.target.value));
$("#suggestions").addEventListener("click", (e)=>{
  const li = e.target.closest("li"); if(!li) return;
  const place = {
    name: li.dataset.name,
    country: li.dataset.country,
    latitude: Number(li.dataset.lat),
    longitude: Number(li.dataset.lon),
  };
  $("#searchInput").value = `${place.name}${place.country ? ", "+place.country : ""}`;
  $("#suggestions").style.display = "none";
  loadForecast(place);
});

$("#searchForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  if(!q) return;
  setStatus("Searching…");
  try{
    const res = await getJSON(API.geocode(q));
    const r = (res.results && res.results[0]);
    if(!r){ setStatus("Place not found."); return; }
    await loadForecast({ name:r.name, country:r.country_code, latitude:r.latitude, longitude:r.longitude });
  }catch{
    setStatus("Search failed. Try again.");
  }
});

$("#unitToggle").addEventListener("change", async (e)=>{
  state.units = e.target.value;
  localStorage.setItem("units", state.units);
  if(state.place) await loadForecast(state.place);
});

$("#dayPicker").addEventListener("change", (e)=>{
  state.selectedDayIndex = Number(e.target.value) || 0;
  renderHourly();
});

$("#geoBtn").addEventListener("click", ()=>{
  if(!navigator.geolocation){ setStatus("Geolocation not supported."); return; }
  setStatus("Locating…");
  navigator.geolocation.getCurrentPosition(async ({coords})=>{
    try{
      
      let name = "My location", country = "";
      try{
        const rev = await getJSON(API.reverse(coords.latitude, coords.longitude));
        const r = rev?.results?.[0];
        if(r){ name = r.name; country = r.country_code || ""; }
      }catch{/* ignore */}
      loadForecast({ name, country, latitude: coords.latitude, longitude: coords.longitude });
    }catch{ setStatus("Couldn't get your location."); }
  }, ()=> setStatus("Permission denied for location."));
});


document.addEventListener("DOMContentLoaded", ()=>{
  setUnitsUI();
  $("#searchInput").value = "";
  loadForecast(state.place);
});
