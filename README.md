# 🏈 Super Bowl LX — Large Event Weather Dashboard

Real-time weather dashboard for **Super Bowl LX** at **Levi's Stadium** (Santa Clara, CA), deployed as a Google Apps Script web app.

## Dashboard Features

| Panel | Source | Refresh |
|-------|--------|---------|
| **Current Conditions** | Synoptic API → NWS fallback | 5 min |
| **Weather Alerts** | NWS Alerts API | 1 min |
| **Radar (KMUX)** | NOAA RIDGE pre-rendered imagery | 2 min |
| **Satellite (GOES-18)** | NOAA CDN (GeoColor, Visible, IR, WV) | 5 min |
| **Hourly Forecast** | NWS Hourly Forecast API | 15 min |
| **Forecast Summary** | NWS Detailed Forecast | 15 min |

## Architecture

```
┌─────────────────────────────────────────────┐
│  Google Apps Script Web App                  │
│                                              │
│  Code.gs          ─ Server-side functions    │
│  Index.html       ─ Dashboard HTML shell     │
│  Stylesheet.html  ─ CSS (dark theme)         │
│  JavaScript.html  ─ Client-side JS           │
│  appsscript.json  ─ Manifest                 │
└─────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
  UrlFetchApp.fetch()     google.script.run
         │                   (client→server RPC)
         ▼
  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐
  │ Synoptic API │  │ NWS API      │  │ NOAA CDN/RIDGE  │
  │ (weather)    │  │ (forecast,   │  │ (radar,         │
  │              │  │  alerts)     │  │  satellite)     │
  └─────────────┘  └──────────────┘  └─────────────────┘
```

## Deployment

### Option A: Manual (Apps Script Editor)

1. Go to [script.google.com](https://script.google.com) and create a new project
2. Create the following files and paste in their contents:
   - `Code.gs` (replace default `Code.gs`)
   - `Index.html` (File → New → HTML file → name it `Index`)
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
- **Radar**: [NOAA RIDGE](https://radar.weather.gov/) (KMUX — Mt. Umunhum, Bay Area)
- **Satellite**: [GOES-18 ABI](https://cdn.star.nesdis.noaa.gov/) (Pacific Southwest sector)

## File Structure

```
LargeEventDashboard/
├── appsscript.json      # GAS manifest (timezone, runtime, webapp config)
├── Code.gs              # Server-side: API calls, caching, unit conversion
├── Index.html           # Dashboard HTML template
├── Stylesheet.html      # CSS (dark theme, 4×3 grid layout)
├── JavaScript.html      # Client-side JS (google.script.run RPC)
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
| Radar processing | GRIB2 via Python/pygrib | Pre-rendered NOAA RIDGE images |
| Satellite | Download to local disk | Direct CDN URLs |
| Hosting | Express server (port 3000) | Google-managed web app |

## License

Internal use — Super Bowl LX event operations.
