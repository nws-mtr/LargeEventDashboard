// ============================================================================
// js/config.js — Event configuration and constants
// ============================================================================

function getDefaultEventConfig() {
  return {
    name: "Test Event",
    latitude: 36.593,
    longitude: -121.855,
    startDate: "2026-02-08T15:30:00",
    endDate: "2026-02-08T22:00:00"
  };
}

// API keys — loaded from js/keys.js (not committed to repo)
// SYNOPTIC_API_KEY is defined in js/keys.js

const NEAREST_STATION = "KMRY";
const RADAR_STATION   = "KMUX";

const RADAR_WMS_URL      = "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows";
const SATELLITE_TILE_URL  = "https://realearth.ssec.wisc.edu/api/image";
const SATELLITE_TIMES_URL = "https://realearth.ssec.wisc.edu/api/times";

const SATELLITE_CHANNELS = {
  "G18-ABI-CONUS-BAND02": "Visible (0.64um)",
  "G18-ABI-CONUS-BAND09": "Water Vapor (6.9um)",
  "G18-ABI-CONUS-BAND13": "Clean IR (10.3um)"
};
const SATELLITE_LOOP_MINUTES = 30;

const CACHE_WEATHER   = 300;
const CACHE_RADAR     = 120;
const CACHE_SATELLITE = 300;
const CACHE_FORECAST  = 3600;
const CACHE_ALERTS    = 60;
const CACHE_WINDROSE  = 300;

// ── Forecast Variables Registry ─────────────────────────────────────────────
const FORECAST_VARIABLES = [
  { key: "temperature",                  label: "Temperature",  unit: "\u00B0F",  color: "#2196f3", mode: "value" },
  { key: "dewpoint",                     label: "Dewpoint",     unit: "\u00B0F",  color: "#66bb6a", mode: "value" },
  { key: "relativeHumidity",             label: "Humidity",     unit: "%",   color: "#ab47bc", mode: "pct"   },
  { key: "windSpeed",                    label: "Wind Speed",   unit: "mph", color: "#ff7043", mode: "value" },
  { key: "windDirection",                label: "Wind Dir",     unit: "\u00B0",   color: "#78909c", mode: "value" },
  { key: "windGust",                     label: "Wind Gust",    unit: "mph", color: "#ffa726", mode: "value" },
  { key: "probabilityOfPrecipitation",   label: "Rain Chance",  unit: "%",   color: "#4caf50", mode: "pct"   },
  { key: "skyCover",                     label: "Cloud Cover",  unit: "%",   color: "#9e9e9e", mode: "pct"   },
  { key: "qpf",                          label: "Precip Amt",   unit: "in",  color: "#29b6f6", mode: "value" }
];

const DEFAULT_SELECTED_VARIABLES = ["temperature", "probabilityOfPrecipitation", "skyCover"];

function getConfig() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem("dashboardConfig"));
  } catch {}
  const def = getDefaultEventConfig();
  if (stored) {
    if (stored.name)      def.name      = stored.name;
    if (stored.latitude)  def.latitude  = stored.latitude;
    if (stored.longitude) def.longitude = stored.longitude;
  }
  if (stored && stored.timezone) {
    def.timezone = stored.timezone;
  } else {
    delete def.timezone;
  }

  // Merge user-selected forecast variables (array of 3 keys)
  def.selectedVariables = (stored && Array.isArray(stored.selectedVariables) && stored.selectedVariables.length === 3)
    ? stored.selectedVariables
    : DEFAULT_SELECTED_VARIABLES.slice();

  // Merge user-configured event times (array of {name, time})
  def.eventTimes = (stored && Array.isArray(stored.eventTimes))
    ? stored.eventTimes
    : [];

  return Promise.resolve(def);
}
