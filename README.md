# Large Event Weather Dashboard

A real-time weather situational awareness dashboard for large events. Configure any location and get live conditions, forecasts, radar, satellite imagery, and wind analysis — all in a single browser tab.

## Features

| Panel | Description | Source | Refresh |
|-------|-------------|--------|---------|
| **Current Conditions** | Temperature, wind, humidity, dewpoint, precipitation | Synoptic Data API (NWS/FAA/RAWS stations) | 5 min |
| **Wind Rose** | 24-hour wind direction/speed frequency chart (SVG polar plot) | Synoptic Data API time series | 5 min |
| **Hourly Forecast** | 3 user-selectable variables with tooltips and event time annotations | NWS Gridpoint Forecast API | 60 min |
| **Radar** | Animated MRMS reflectivity loop on interactive Leaflet map | NCEP WMS | 5 min |
| **Satellite** | Animated GOES loop with auto VIS/IR switching by time of day | SSEC RealEarth | 10 min |

## Quick Start

```bash
# Clone the repo
git clone <repo-url> && cd LargeEventDashboard

# Serve locally
python3 -m http.server 8080

# Open http://localhost:8080
```

No build step, no dependencies to install. Just a static file server.

## Configuration

Click the **Config** button in the dashboard footer to set:

- **Event Name** — label for your event
- **Latitude / Longitude** — dashboard auto-centers maps, finds nearest station, and determines timezone
- **Forecast Variables** — choose 3 NWS forecast variables to chart (temperature, precipitation probability, sky cover, wind speed, etc.)
- **Event Times** — add named time markers (e.g., "Gates Open", "Kickoff") that appear as vertical annotations on forecast charts

Configuration is stored in `localStorage` and persists across page reloads.

### API Key

The dashboard uses the [Synoptic Data API](https://synopticdata.com/) for current observations and wind data. Create `js/keys.js` (gitignored) with your API key:

```js
const SYNOPTIC_API_KEY = "your_key_here";
```

## Architecture

```
index.html              ← entry point (no build step)
css/styles.css          ← dark theme, CSS grid layout
js/config.js            ← forecast variable registry, defaults, API keys
js/cache.js             ← in-memory TTL cache
js/api.js               ← data fetching (Synoptic, NWS, NCEP, SSEC)
js/charts.js            ← SVG line graphs with tooltips and event annotations
js/windrose.js          ← SVG polar wind rose chart
js/maps.js              ← Leaflet radar/satellite map initialization
js/dashboard.js         ← orchestration, auto-refresh, config modal
```

### Data Flow

```
Browser
  ├── Synoptic API ─── current obs (nearest NWS/FAA/RAWS station)
  │                └── 24h wind time series → wind rose
  ├── NWS API ──────── gridpoint hourly forecast → charts
  ├── NCEP WMS ─────── MRMS radar tiles → Leaflet map loop
  └── SSEC RealEarth ─ GOES satellite tiles → Leaflet map loop
```

All API calls are made directly from the browser. No backend server required.

### Auto-Refresh Intervals

| Data | Interval |
|------|----------|
| Current conditions + wind rose | 5 minutes |
| Radar frames | 5 minutes |
| Satellite frames | 10 minutes |
| Hourly forecast | 60 minutes |

### Timezone Handling

The dashboard automatically determines the display timezone from the configured longitude. All times (clock, observation timestamps, chart axes, event annotations) render in the venue's local time.

## Data Sources

- **Current Weather**: [Synoptic Data API](https://synopticdata.com/) — nearest NWS/FAA (ASOS/AWOS) or RAWS station within 50 mi
- **Forecast**: [NOAA National Weather Service API](https://api.weather.gov/) — gridpoint hourly forecast
- **Radar**: [NCEP GeoServer WMS](https://opengeo.ncep.noaa.gov/) — MRMS base reflectivity, animated loop
- **Satellite**: [SSEC RealEarth](https://realearth.ssec.wisc.edu/) — GOES-East/West, auto VIS (daytime) / IR (nighttime)

## Client-Side Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Interactive maps with WMS/tile layers |

## License

MIT
