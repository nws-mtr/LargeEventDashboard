# 🏈 Super Bowl LX — Large Event Weather Dashboard

Real-time weather dashboard for **Super Bowl LX** at **Levi's Stadium** (Santa Clara, CA), deployed as a Google Apps Script web app with interactive Leaflet radar map.

## Dashboard Features

| Panel | Source | Refresh |
|-------|--------|---------|
| **Current Conditions** | Synoptic API → NWS fallback | 5 min |
| **Weather Alerts** | NWS Alerts API | 1 min |
| **Radar (MRMS)** | NCEP WMS — Leaflet map with time-dimension loop | 2 min |
| **Satellite (GOES-18)** | Iowa State Mesonet WMS — Leaflet map with VIS/WV/IR channels | 5 min |
| **Hourly Forecast** | NWS Hourly Forecast API | 15 min |
| **Forecast Summary** | NWS Detailed Forecast | 15 min |

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Google Apps Script Web App                       │
│                                                   │
│  Code.gs          ─ Server-side functions         │
│  index.html       ─ Dashboard HTML + Leaflet CDN  │
│  Stylesheet.html  ─ CSS (dark theme)              │
│  JavaScript.html  ─ Client JS, LoopPlayer,        │
│                     Leaflet WMS radar + satellite  │
│  appsscript.json  ─ Manifest                      │
└──────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
  UrlFetchApp.fetch()     google.script.run
  (server→external)       (client→server RPC)
         │
         ▼                              ▲ (WMS tiles direct from browser)
  ┌─────────────┐  ┌──────────┐  ┌─────────────────────────┐
  │ Synoptic API │  │ NWS API  │  │ NCEP GeoServer (WMS)    │
  │ (weather)    │  │(forecast,│  │ conus_bref_qcd layer    │
  │              │  │ alerts)  │  │ + Iowa State Mesonet    │
  │              │  │          │  │ GOES-West WMS (satellite) │
  └─────────────┘  └──────────┘  └─────────────────────────┘
```

### Radar Architecture

The radar panel uses a **Leaflet.js** interactive map with **WMS time-dimension looping**:

1. `Code.gs` → `getRadarTimes()` fetches the NCEP WMS `GetCapabilities` XML and parses the `<Dimension name="time">` element to extract available ISO 8601 timestamps
2. `JavaScript.html` receives the timestamp array and feeds the last 10 to the `LoopPlayer`
3. Each frame is a `L.tileLayer.wms()` pointed at `conus_bref_qcd` with a `time=` parameter — tiles are fetched directly by the browser from NCEP GeoServer (no CORS issues, no proxy needed)
4. Dark basemap (CartoDB Dark Matter), venue marker with pulse animation, 10 NM range ring
5. Play/pause, step forward/back, scrubber bar, frame counter

### Satellite Architecture

The satellite panel uses the same **Leaflet WMS** pattern as radar, powered by the **Iowa State Mesonet GOES-West WMS**:

1. `Code.gs` → `getSatelliteTimes(channel)` fetches the Iowa State WMS `GetCapabilities` XML and parses the `<Extent name="time">` element for the requested GOES-18 channel
2. Supports ISO 8601 time intervals (`start/end/PT10M`) and comma-separated time lists
3. Three channel options switchable via VIS/WV/IR buttons:
   - `conus_ch02` — Visible (0.64µm) — best for daytime cloud features
   - `conus_ch09` — Water Vapor (6.9µm) — shows mid-level moisture, works day/night
   - `conus_ch13` — Clean IR (10.3µm) — cloud-top temps, works day/night
4. Each frame is a `L.tileLayer.wms()` with `time=` parameter, tiles loaded directly from Iowa State (no proxy)
5. Dark basemap with labels overlay on top of satellite imagery, 50 NM range ring
6. Same loop player controls as radar (play/pause, scrubber, frame counter)

## Deployment

### Option A: Manual (Apps Script Editor)

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Create the following files and paste in their contents:
   - `Code.gs` (replace default `Code.gs`)
   - `index.html` (File → New → HTML file → name it `Index`)
   - `Stylesheet.html` (File → New → HTML file → name it `Stylesheet`)
   - `JavaScript.html` (File → New → HTML file → name it `JavaScript`)
3. Replace the contents of `appsscript.json` (View → Show manifest file)
4. Click **Deploy → New deployment**
5. Select type **Web app**
6. Set "Execute as" to **Me** and "Who has access" to **Anyone**
7. Click **Deploy** and authorize when prompted
8. Open the provided URL — your dashboard is live!

### Option B: clasp CLI (Recommended)

```bash
# 1. Install clasp globally
npm install -g @google/clasp

# 2. Log in to your Google account
clasp login

# 3. Create a new Apps Script project
clasp create --title "Super Bowl LX Weather Dashboard" --type webapp

# 4. The above command creates .clasp.json with your scriptId.
#    Push all files to Google Apps Script:
clasp push

# 5. Open in browser to verify
clasp open

# 6. Deploy as web app
clasp deploy --description "v1.0 — Initial deployment"

# 7. Open the deployed web app
clasp open --webapp
```

### Post-Deployment: Install Cache Warming Trigger

In the Apps Script editor (or via `clasp run`):

1. Open the script editor
2. Select `installTrigger` from the function dropdown
3. Click **Run**
4. Authorize when prompted

This creates a time-driven trigger that pre-warms the cache every 5 minutes, so the dashboard loads faster.

## Configuration

All configuration is in `Code.gs` constants:

| Constant | Value | Description |
|----------|-------|-------------|
| `EVENT_CONFIG.latitude` | `37.403147` | Levi's Stadium latitude |
| `EVENT_CONFIG.longitude` | `-121.969814` | Levi's Stadium longitude |
| `SYNOPTIC_API_KEY` | `e0fb17ad...` | Synoptic Data API token |
| `NEAREST_STATION` | `462PG` | Milpitas IDSM weather station |
| `RADAR_STATION` | `KMUX` | Bay Area NEXRAD site |
| `RADAR_WMS_URL` | `https://opengeo.ncep.noaa.gov/...` | NCEP WMS endpoint for MRMS reflectivity |

### Moving API Key to PropertiesService (Recommended for Production)

```javascript
// In Apps Script editor: File → Project properties → Script properties
// Add: SYNOPTIC_API_KEY = your_key_here

// Then in Code.gs, replace the constant with:
var SYNOPTIC_API_KEY = PropertiesService.getScriptProperties().getProperty('SYNOPTIC_API_KEY');
```

## Data Sources

- **Current Weather**: [Synoptic Data API](https://synopticdata.com/) (station 462PG, Milpitas IDSM, ~3.1 km from venue)
- **Forecast & Alerts**: [NOAA National Weather Service API](https://api.weather.gov/)
- **Radar**: [NCEP GeoServer WMS](https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows) — MRMS quality-controlled base reflectivity, 1 km resolution, ~2 min updates, rendered on a Leaflet map via `L.tileLayer.wms()` with time-dimension looping
- **Satellite**: [Iowa State Mesonet GOES-West WMS](https://mesonet.agron.iastate.edu/cgi-bin/wms/goes_west.cgi) — GOES-18 ABI channels (Visible ch02, Water Vapor ch09, Clean IR ch13), rendered on Leaflet map with time-dimension looping

## Client-Side Libraries

| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| **Leaflet.js** | 1.9.4 | unpkg | Interactive radar + satellite maps with WMS tile layers |

## File Structure

```
LargeEventDashboard/
├── appsscript.json      # GAS manifest (timezone, runtime, webapp config)
├── Code.gs              # Server-side: API calls, WMS time parsing, caching
├── index.html           # Dashboard HTML template + Leaflet CDN
├── Stylesheet.html      # CSS (dark theme, 4×3 grid, Leaflet overrides)
├── JavaScript.html      # Client JS: LoopPlayer, Leaflet WMS radar, satellite
├── .clasp.json          # clasp CLI config (script ID)
├── .gitignore           # Git ignore rules
├── .env.example         # Reference env vars
└── README.md            # This file
```

## Key Differences from Node.js Version

| Feature | Node.js/Express | Google Apps Script |
|---------|----------------|-------------------|
| HTTP client | `axios` | `UrlFetchApp.fetch()` |
| Client↔Server | `fetch('/api/...')` | `google.script.run` |
| Caching | File system (`data/cache/`) | `CacheService` (100KB/key, 6hr max) |
| Scheduled tasks | `node-cron` | `ScriptApp.newTrigger()` |
| Radar | GRIB2 via Python/pygrib | WMS tiles via Leaflet + NCEP GeoServer |
| Satellite | Download to local disk | WMS tiles via Leaflet + Iowa State Mesonet |
| Hosting | Express server (port 3000) | Google-managed web app |

## License

Internal use — Super Bowl LX event operations.
