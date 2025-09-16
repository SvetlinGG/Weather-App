# Weather-App

A clean, responsive weather application built with **HTML + CSS + vanilla JavaScript**, powered by the **Open‑Meteo API** (no API key required). It supports search with suggestions, geolocation, metric/imperial units, a rich current conditions card, a 7‑day forecast, and an **hourly view for the next 12 hours from “now.”**


link: https://weather-app-sgg.netlify.app/
---

## Table of Contents

1. [Features](#features)  
2. [Tech Stack](#tech-stack)  
3. [UI Overview](#ui-overview)  
4. [Project Structure](#project-structure)  
5. [Quick Start](#quick-start)  
6. [How It Works (Step-by-Step)](#how-it-works-step-by-step)  
7. [APIs & Data Contracts](#apis--data-contracts)  
8. [JavaScript Organization](#javascript-organization)  
9. [CSS Architecture](#css-architecture)  
10. [Accessibility](#accessibility)  
11. [Performance Notes](#performance-notes)  
12. [Error Handling & Edge Cases](#error-handling--edge-cases)  
13. [Manual QA Checklist](#manual-qa-checklist)  
14. [Deployment](#deployment)  
15. [Customization & Extensions](#customization--extensions)  
16. [Troubleshooting](#troubleshooting)  
17. [License](#license)

---

## Features

- 🔎 **Search with suggestions** (Open‑Meteo Geocoding).  
- 📍 **Use my location** (browser geolocation + reverse geocoding).  
- 🌡️ **Current conditions**: temp, feels like, humidity, wind, precipitation, icon.  
- 📅 **7‑day daily forecast** with max/min temps and weather icon.  
- 🕛 **Hourly forecast**: **next 12 hours from now** (rolling window).  
- 🔁 **Units toggle**: Metric ↔ Imperial (°C/°F, km/h ↔ mph, mm ↔ in).  
- 📱 **Responsive layout**, keyboard‑friendly, ARIA labels.  


---

## Tech Stack

- **Frontend:** HTML5, CSS3, vanilla JavaScript  
- **Data:** Open‑Meteo Geocoding + Forecast APIs  
- **Fonts (optional):** Bricolage Grotesque (headings), DM Sans (body)

```html
<!-- Optional fonts -->
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=DM+Sans:ital,wght@0,300;0,500;0,600;0,700;1,600&display=swap" rel="stylesheet">
```

---

## UI Overview

- **Header:** brand, units select, “Use my location” button.  
- **Main title & search:** query field + debounced suggestions.  
- **Current card:** city + date + icon + large temperature.  
- **Stats tiles:** feels like, humidity, wind, precipitation.  
- **Daily section:** seven compact day tiles.  
- **Hourly section:** list of the **next 24 future hours** with time, icon, temp.

---

## Project Structure

Single‑page, static app:

```
weather-app/
├─ index.html        # semantic markup & UI hooks
├─ css               # tokens, layout, components, responsive
└─ app.js            # logic (state, fetch, render, events, helpers)
```

> Prefer multiple CSS files? See **CSS Architecture** to split by sections with `@layer`.

---

## Quick Start

1. **Download/clone** this folder.  
2. Open `index.html` directly in a browser
   
3. Visit https://weather-app-sgg.netlify.app/



---

## How It Works (Step-by-Step)

### 1) Initialization

- Read `units` from `localStorage` (`metric` default).  
- Read `place` (last location) from `localStorage`, fallback to **Berlin, DE**.  
- Set unit labels (°C/°F, km/h/mph, mm/in).

### 2) Forecast Fetch

- Build a Forecast URL with:
  - `latitude`, `longitude`
  - `timezone=auto`
  - `current`, `hourly`, `daily` variable sets
  - Unit settings from `state.units`
- `fetch` JSON → store in `state.data`.

### 3) Render Current Card

- City + country, today’s date.  
- Weather icon (WMO → emoji).  
- Temperature, feels like, humidity, wind, precipitation.

### 4) Render Daily (7 Days)

- Iterate `daily.time` → day name (Mon/Tue…), icon, max/min.

### 5) Render Hourly (Next 24 Hours)

- From `hourly.time`, take the **first 24 timestamps in the future** (≥ now).  
- Render time, icon, temperature.

### 6) Interactions

- **Search input:** debounced call to Geocoding → suggestions list.  
- **Click a suggestion:** load forecast for that place, persist to `localStorage`.  
- **Units select:** persist to `localStorage`, re‑fetch forecast + re‑render.  
- **Use my location:** `navigator.geolocation` → reverse geocode → fetch → render.

---

## APIs & Data Contracts

### Geocoding (search)

```
GET https://geocoding-api.open-meteo.com/v1/search
  ?name=<query>
  &count=5
  &language=en
  &format=json
```

**Response (excerpt):**
```json
{
  "results": [
    {
      "name": "Berlin",
      "country_code": "DE",
      "latitude": 52.52,
      "longitude": 13.41,
      "admin1": "Berlin"
    }
  ]
}
```

### Reverse Geocoding

```
GET https://geocoding-api.open-meteo.com/v1/reverse
  ?latitude=<lat>&longitude=<lon>&language=en&format=json
```

### Forecast

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=<lat>&longitude=<lon>&timezone=auto
  &current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m
  &hourly=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m
  &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max
  &temperature_unit=celsius|fahrenheit
  &wind_speed_unit=kmh|mph
  &precipitation_unit=mm|inch
```

**Response (shape excerpt):**
```json
{
  "current": {
    "temperature_2m": 18.3,
    "apparent_temperature": 17.2,
    "relative_humidity_2m": 64,
    "precipitation": 0.0,
    "weather_code": 3,
    "wind_speed_10m": 12.1,
    "time": "2025-09-16T20:00"
  },
  "hourly": {
    "time": ["2025-09-16T20:00", "..."],
    "temperature_2m": [18.3, "..."],
    "weather_code": [3, "..."]
  },
  "daily": {
    "time": ["2025-09-16", "..."],
    "weather_code": [3, "..."],
    "temperature_2m_max": [21.0, "..."],
    "temperature_2m_min": [12.0, "..."]
  }
}
```

---

## JavaScript Organization

### DOM Helpers

```js
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
```

### State

```js
const state = {
  units: localStorage.getItem("units") || "metric",
  place: JSON.parse(localStorage.getItem("place") || "null") || {
    name: "Berlin", country: "DE", latitude: 52.52, longitude: 13.41
  },
  data: null
};
```

### API Builders

```js
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
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
      hourly:  "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      daily:   "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      ...u
    });
    return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  }
};
```

### Formatting & Icons

```js
function iconFor(code){
  if([0].includes(code)) return "☀️";
  if([1].includes(code)) return "🌤️";
  if([2].includes(code)) return "⛅";
  if([3].includes(code)) return "☁️";
  if([45,48].includes(code)) return "🌫️";
  if([51,53,55,56,57].includes(code)) return "🌦️";
  if([61,63,65,80,81,82].includes(code)) return "🌧️";
  if([66,67].includes(code)) return "🌧️";
  if([71,73,75,77,85,86].includes(code)) return "❄️";
  if([95,96,99].includes(code)) return "⛈️";
  return "🌡️";
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour:"numeric" });
function setStatus(msg){ $("#status").textContent = msg || ""; }
function setUnitsUI(){
  $("#tempUnit").textContent   = state.units === "metric" ? "°C" : "°F";
  $("#feelsUnit").textContent  = state.units === "metric" ? "°C" : "°F";
  $("#windUnit").textContent   = state.units === "metric" ? "km/h" : "mph";
  $("#precipUnit").textContent = state.units === "metric" ? "mm" : "in";
  $("#unitToggle").value = state.units;
}
```

### Rendering

```js
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



## CSS Architecture

You can keep a **single `css-folder`** or split by sections with `@layer`. Example split:

```
/css
  index.css          # imports and layer order
  tokens.css         # CSS variables (colors, spacing, fonts)
  base.css           # reset, typography, buttons, cards
  layout.css         # grid (left/right), responsive
  header.css         # header section
  main.css           # title + search
  current.css        # current card + stats tiles
  daily.css          # daily section
  hourly.css         # hourly section
  utilities.css      # status, footer, helpers
```

`index.css` controls cascade:
```css
@layer reset, tokens, base, layout, components, sections, utilities;
@import url("./tokens.css") layer(tokens);
@import url("./base.css") layer(base);
@import url("./layout.css") layer(layout);
@import url("./header.css") layer(components);
@import url("./main.css") layer(components);
@import url("./current.css") layer(sections);
@import url("./daily.css") layer(sections);
@import url("./hourly.css") layer(sections);
@import url("./utilities.css") layer(utilities);
```
---

## Accessibility

- Landmark roles: `role="banner"`, `role="main"`, `role="contentinfo"`.  
- Search form has `role="search"` and a hidden label.  
- Live regions: `aria-live="polite"` for status and current card.  
- Suggestions list: clear click targets; keyboard navigation can be added later.  
- Color contrast targets WCAG AA on dark theme.

---

## Performance Notes

- No libraries; tiny bundle.  
- `rel="preconnect"` to API domains.  
- Debounce search requests (350 ms).  
- Reuse `state.place`; only re‑fetch on unit toggles.  
- Emoji icons (no external images).  
- CSS variables; minimal shadows/filters.

---

## Error Handling & Edge Cases

- **Network errors:** “Could not load forecast. Please try again.”  
- **Empty search:** “Place not found.”  
- **Geolocation denied:** “Permission denied for location.”  
- **No future hourly points (rare):** fallback to last 12 hourly entries.  
- **Offline:** fetch fails → status shows error; UI stays mounted.

---

## Manual QA Checklist

- **Search**
  - Typing shows suggestions; clicking updates all sections.
  - Unknown city → “Place not found.”
- **Units**
  - Toggle updates labels (°C/°F, km/h↔mph, mm↔in) and re‑fetches data.
- **Geolocation**
  - Permission prompt; success fetches & renders; denial shows message.
- **Current & stats**
  - Values update when switching units/location.
- **Daily**
  - 7 tiles; min/max plausible.
- **Hourly**
  - Exactly 24 rows, starting from a time ≥ now.
- **Responsive**
  - Desktop: two columns; Mobile: single column, readable.
- **Accessibility**
  - Focus rings visible; Enter to submit search; suggestions clickable.

---

## Deployment

### GitHub Pages
1. Create a repo and push `index.html`, `css`, `app.js`.  
2. Settings → Pages → Deploy from `main`, folder `css`.  
3. Open the provided URL.

### Netlify
1. Connect the repo.  
2. Netlify detects a static site automatically.  
3. Deploy URL appears immediately.



---

## Customization & Extensions

- **Icons:** replace emoji with an SVG set.  
- **Loading states:** skeletons/shimmer while fetching.  
- **I18N:** pass `language=<code>` to geocoding; adapt date/time locale.  
- **Favorites:** store multiple cities; switch via tabs.  
- **PWA:** manifest + service worker for offline last‑known data.

---

## Troubleshooting

- **Nothing loads when opening `index.html` directly?**  
  Some browsers restrict `fetch` from `file://` origins → use a local server.
- **CORS error?**  
  Open‑Meteo supports CORS for GET; ensure you use `https` in production.
- **Geolocation blocked?**  
  Check site permissions; some browsers require HTTPS.
- **Timezone formatting looks off?**  
  We pass `timezone=auto`; system clock/timezone affects formatting.

---

## License

MIT — Feel free to use, modify, and distribute.  
Weather data by **Open‑Meteo** (free; attribution appreciated).
