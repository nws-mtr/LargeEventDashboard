// ============================================================================
// js/config.js — Event configuration and constants
// ============================================================================

function getDefaultEventConfig() {
  return {
    name: "Super Bowl LX",
    location: "Levi's Stadium",
    latitude: 37.403147,
    longitude: -121.969814,
    startDate: "2026-02-08T15:30:00",
    endDate: "2026-02-08T22:00:00",
    adverseConditions: {
      maxTemp: 80,
      minRainChance: 15,
      minSkyCover: 50
    }
  };
}

// API keys — read from localStorage, fall back to defaults
const SYNOPTIC_API_KEY = localStorage.getItem("SYNOPTIC_API_KEY") || "e0fb17ad65504848934b1f1ece0c78f8";
const OPENAI_API_KEY   = localStorage.getItem("OPENAI_API_KEY") || "";

const NEAREST_STATION = "462PG";
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
const CACHE_KEYPOINTS = 3600;

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
  return Promise.resolve(def);
}
