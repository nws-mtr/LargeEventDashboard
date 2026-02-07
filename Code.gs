// ============================================================================
// Code.gs — Large Event Weather Dashboard (Google Apps Script)
// Super Bowl LX at Levi's Stadium
// ============================================================================

// ── Configuration ───────────────────────────────────────────────────────────
var EVENT_CONFIG = {
  name: "Super Bowl LX",
  location: "Levi's Stadium",
  latitude: 37.403147,
  longitude: -121.969814,
  timezone: "America/Los_Angeles",
  startDate: "2026-02-08T15:30:00",
  endDate: "2026-02-08T22:00:00"
};

var SYNOPTIC_API_KEY = "e0fb17ad65504848934b1f1ece0c78f8";
var NEAREST_STATION = "462PG"; // Milpitas IDSM
var RADAR_STATION = "KMUX";   // San Francisco Bay Area

var NWS_USER_AGENT = "LargeEventDashboard/2.0 (Google Apps Script)";

// Cache durations in seconds
var CACHE_WEATHER = 300;    // 5 minutes
var CACHE_RADAR = 120;      // 2 minutes
var CACHE_SATELLITE = 300;  // 5 minutes
var CACHE_FORECAST = 900;   // 15 minutes
var CACHE_ALERTS = 60;      // 1 minute

// ── Web App Entry Point ─────────────────────────────────────────────────────
function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('Super Bowl LX — Weather Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// Include helper for templated HTML (<?!= include('Stylesheet') ?>)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Unit Conversion Utilities ───────────────────────────────────────────────
function celsiusToFahrenheit(c) {
  if (c === null || c === undefined) return null;
  return (c * 9 / 5) + 32;
}

function msToMph(ms) {
  if (ms === null || ms === undefined) return null;
  return ms * 2.237;
}

function mmToInches(mm) {
  if (mm === null || mm === undefined) return null;
  return mm / 25.4;
}

function pascalsToInHg(pa) {
  if (pa === null || pa === undefined) return null;
  return pa / 3386.39;
}

function degToCompass(deg) {
  if (deg === null || deg === undefined) return 'N';
  var val = Math.floor((deg / 22.5) + 0.5);
  var arr = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
             'S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return arr[val % 16];
}

function round1(v) { return v !== null && v !== undefined ? Math.round(v * 10) / 10 : null; }
function round2(v) { return v !== null && v !== undefined ? Math.round(v * 100) / 100 : null; }

// ── Cache Helpers ───────────────────────────────────────────────────────────
function cacheGet(key) {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(key);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  return null;
}

function cachePut(key, obj, ttl) {
  var cache = CacheService.getScriptCache();
  var str = JSON.stringify(obj);
  // CacheService max value size is 100KB
  if (str.length < 100000) {
    cache.put(key, str, ttl);
  }
}

// ── HTTP Fetch Helper ───────────────────────────────────────────────────────
function fetchJSON(url, headers) {
  var options = {
    muteHttpExceptions: true,
    headers: headers || {}
  };
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    return JSON.parse(response.getContentText());
  }
  throw new Error('HTTP ' + code + ' from ' + url);
}

// ── NWS Grid Point (cached to avoid repeated /points/ calls) ────────────────
function getNWSGridPoint_() {
  var cached = cacheGet('nws_gridpoint');
  if (cached) return cached;

  var lat = EVENT_CONFIG.latitude;
  var lon = EVENT_CONFIG.longitude;
  var headers = { 'User-Agent': NWS_USER_AGENT };
  var points = fetchJSON('https://api.weather.gov/points/' + lat + ',' + lon, headers);
  var result = {
    forecastHourly: points.properties.forecastHourly,
    forecast: points.properties.forecast,
    observationStations: points.properties.observationStations,
    gridId: points.properties.gridId,
    gridX: points.properties.gridX,
    gridY: points.properties.gridY
  };
  cachePut('nws_gridpoint', result, 3600); // 1 hour — grid points don't change
  return result;
}

// ── Get Configuration (called from client) ──────────────────────────────────
function getConfig() {
  return EVENT_CONFIG;
}

// ── Current Weather (Synoptic API → NOAA NWS fallback) ─────────────────────
function getCurrentWeather() {
  // Check cache first
  var cached = cacheGet('weather_current');
  if (cached) return cached;

  try {
    return fetchSynopticWeather_();
  } catch (e) {
    Logger.log('Synoptic failed: ' + e.message + '. Trying NOAA fallback...');
    try {
      return fetchNOAAWeather_();
    } catch (e2) {
      Logger.log('NOAA fallback also failed: ' + e2.message);
      return { error: 'Unable to fetch weather data', timestamp: new Date().toISOString() };
    }
  }
}

function fetchSynopticWeather_() {
  var lat = EVENT_CONFIG.latitude;
  var lon = EVENT_CONFIG.longitude;

  var url = 'https://api.synopticdata.com/v2/stations/nearesttime'
    + '?token=' + SYNOPTIC_API_KEY
    + '&radius=' + lat + ',' + lon + ',50'
    + '&limit=1'
    + '&within=120'
    + '&vars=air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility,cloud_layer_1_code,cloud_layer_2_code,cloud_layer_3_code,precip_accum_one_hour,sea_level_pressure,altimeter'
    + '&obtimezone=UTC'
    + '&output=json';

  var data = fetchJSON(url);

  if (!data.STATION || data.STATION.length === 0) {
    throw new Error('No stations found near location');
  }

  var station = data.STATION[0];
  var obs = station.OBSERVATIONS;

  // Helper: try multiple possible field names
  function getVal() {
    for (var i = 0; i < arguments.length; i++) {
      var field = arguments[i];
      if (obs[field] && typeof obs[field].value !== 'undefined') return obs[field].value;
    }
    return null;
  }

  function getTimestamp() {
    for (var i = 0; i < arguments.length; i++) {
      var field = arguments[i];
      if (obs[field] && obs[field].date_time) return obs[field].date_time;
    }
    return null;
  }

  var tempC        = getVal('air_temp_value_1', 'air_temp_set_1');
  var dewpointC    = getVal('dew_point_temperature_value_1d', 'dew_point_temperature_set_1d');
  var windSpeedMs  = getVal('wind_speed_value_1', 'wind_speed_set_1');
  var windGustMs   = getVal('wind_gust_value_1', 'wind_gust_set_1');
  var windDir      = getVal('wind_direction_value_1', 'wind_direction_set_1');
  var pressurePa   = getVal('altimeter_value_1', 'altimeter_set_1');
  var precipMm     = getVal('precip_accum_one_hour_value_1', 'precip_accum_one_hour_set_1');
  var visib        = getVal('visibility_value_1', 'visibility_set_1');
  var rh           = getVal('relative_humidity_value_1', 'relative_humidity_set_1');
  var slp          = getVal('sea_level_pressure_value_1d', 'sea_level_pressure_set_1d');

  var result = {
    timestamp: new Date().toISOString(),
    observationTime: getTimestamp('air_temp_value_1', 'air_temp_set_1'),
    source: 'Synoptic Data API',
    station: {
      id: station.STID,
      name: station.NAME,
      latitude: station.LATITUDE,
      longitude: station.LONGITUDE,
      distance: station.DISTANCE
    },
    observations: {
      temperature:      { value: round1(celsiusToFahrenheit(tempC)), unit: 'F' },
      dewpoint:         { value: round1(celsiusToFahrenheit(dewpointC)), unit: 'F' },
      relativeHumidity: { value: round1(rh), unit: '%' },
      wind: {
        speed:    { value: round1(msToMph(windSpeedMs)), unit: 'mph' },
        direction:{ value: round1(windDir), unit: 'degrees' },
        cardinal: degToCompass(windDir),
        gust:     { value: round1(msToMph(windGustMs)), unit: 'mph' }
      },
      visibility: { value: round1(visib), unit: 'miles' },
      pressure: {
        seaLevel:  { value: round1(slp), unit: 'mb' },
        altimeter: { value: round2(pascalsToInHg(pressurePa)), unit: 'inHg' }
      },
      precipitation: {
        oneHour: { value: round2(mmToInches(precipMm)), unit: 'inches' }
      }
    },
    location: EVENT_CONFIG
  };

  cachePut('weather_current', result, CACHE_WEATHER);
  return result;
}

function fetchNOAAWeather_() {
  var headers = { 'User-Agent': NWS_USER_AGENT };
  var grid = getNWSGridPoint_();
  var stations = fetchJSON(grid.observationStations, headers);
  var stationUrl = stations.features[0].id;
  var obsData = fetchJSON(stationUrl + '/observations/latest', headers);
  var props = obsData.properties;

  var tempC = props.temperature && props.temperature.value;
  var dewC  = props.dewpoint && props.dewpoint.value;
  var rh    = props.relativeHumidity && props.relativeHumidity.value;
  var wsMs  = props.windSpeed && props.windSpeed.value;
  var wDir  = props.windDirection && props.windDirection.value;
  var wgMs  = props.windGust && props.windGust.value;
  var vis   = props.visibility && props.visibility.value;
  var slp   = props.seaLevelPressure && props.seaLevelPressure.value;

  var result = {
    timestamp: new Date().toISOString(),
    observationTime: props.timestamp,
    source: 'NOAA NWS (fallback)',
    station: {
      id: stationUrl.split('/').pop(),
      name: 'NWS Station'
    },
    observations: {
      temperature:      { value: round1(celsiusToFahrenheit(tempC)), unit: 'F' },
      dewpoint:         { value: round1(celsiusToFahrenheit(dewC)), unit: 'F' },
      relativeHumidity: { value: round1(rh), unit: '%' },
      wind: {
        speed:    { value: round1(msToMph(wsMs !== null ? wsMs : null)), unit: 'mph' },
        direction:{ value: round1(wDir), unit: 'degrees' },
        cardinal: degToCompass(wDir),
        gust:     { value: round1(msToMph(wgMs !== null ? wgMs : null)), unit: 'mph' }
      },
      visibility: { value: vis !== null ? round1(vis / 1609.34) : null, unit: 'miles' },
      pressure: {
        seaLevel:  { value: slp !== null ? round1(slp / 100) : null, unit: 'mb' },
        altimeter: { value: slp !== null ? round2(slp / 3386.39) : null, unit: 'inHg' }
      },
      precipitation: { oneHour: { value: null, unit: 'inches' } }
    },
    location: EVENT_CONFIG
  };

  cachePut('weather_current', result, CACHE_WEATHER);
  return result;
}

// ── Hourly Forecast (NWS API) ───────────────────────────────────────────────
function getHourlyForecast() {
  var cached = cacheGet('forecast_hourly');
  if (cached) return cached;

  var headers = { 'User-Agent': NWS_USER_AGENT };

  try {
    var grid = getNWSGridPoint_();
    var forecast = fetchJSON(grid.forecastHourly, headers);

    // Trim to 24 periods to stay under CacheService 100KB limit
    var periods = forecast.properties.periods.slice(0, 24);

    var result = {
      timestamp: new Date().toISOString(),
      forecast: periods,
      location: EVENT_CONFIG
    };

    cachePut('forecast_hourly', result, CACHE_FORECAST);
    return result;
  } catch (e) {
    Logger.log('Error fetching hourly forecast: ' + e.message);
    return { error: 'Unable to fetch forecast', timestamp: new Date().toISOString() };
  }
}

// ── Weather Alerts (NWS API) ────────────────────────────────────────────────
function getWeatherAlerts() {
  var cached = cacheGet('weather_alerts');
  if (cached) return cached;

  var lat = EVENT_CONFIG.latitude;
  var lon = EVENT_CONFIG.longitude;
  var headers = { 'User-Agent': NWS_USER_AGENT };

  try {
    var url = 'https://api.weather.gov/alerts/active?point=' + lat + ',' + lon;
    var data = fetchJSON(url, headers);

    var result = {
      timestamp: new Date().toISOString(),
      alerts: data.features || [],
      count: (data.features || []).length
    };

    cachePut('weather_alerts', result, CACHE_ALERTS);
    return result;
  } catch (e) {
    Logger.log('Error fetching alerts: ' + e.message);
    return { error: 'Unable to fetch alerts', alerts: [], count: 0, timestamp: new Date().toISOString() };
  }
}

// ── Radar Image URL (NOAA RIDGE / Iowa State Mesonet) ───────────────────────
// No GRIB2 processing in GAS — return pre-rendered radar imagery URLs
function getRadarImageUrl() {
  var cached = cacheGet('radar_url');
  if (cached) return cached;

  // NOAA RIDGE Radar — KMUX (Bay Area)
  // Use Iowa State Mesonet for reliable timestamped radar composites
  var ts = new Date().getTime();

  var result = {
    timestamp: new Date().toISOString(),
    station: RADAR_STATION,
    urls: {
      // NOAA RIDGE II radar (single site reflectivity)
      ridge: 'https://radar.weather.gov/ridge/standard/KMUX_0.gif',
      // Iowa State Mesonet N0Q composite for the region  
      mesonet: 'https://mesonet.agron.iastate.edu/GIS/ridge.phtml?sector=CA&prod=N0Q&ts=' + ts,
      // RainViewer — free global radar tiles (good fallback)
      rainviewer: 'https://tilecache.rainviewer.com/v2/radar/nowcast/256/6/' 
        + Math.floor(EVENT_CONFIG.latitude) + '/' + Math.floor(EVENT_CONFIG.longitude) + '/1/1_1.png',
      // NOAA RIDGE standard for KMUX
      standard: 'https://radar.weather.gov/ridge/standard/KMUX_loop.gif'
    },
    // Primary URL to display
    url: 'https://radar.weather.gov/ridge/standard/KMUX_0.gif'
  };

  cachePut('radar_url', result, CACHE_RADAR);
  return result;
}

// ── Satellite Image URL (GOES-18 CDN) ──────────────────────────────────────
function getSatelliteImageUrl(product) {
  product = product || 'GEOCOLOR';

  var cacheKey = 'satellite_' + product;
  var cached = cacheGet(cacheKey);
  if (cached) return cached;

  // GOES-18 (GOES-West) ABI imagery from NOAA CDN
  // MESO sector M1 covers Western US including Bay Area
  var productMap = {
    'GEOCOLOR':    'GEOCOLOR',
    'visible':     '02',        // Band 02 — Red visible
    'infrared':    '13',        // Band 13 — Clean longwave IR
    'watervapor':  '09'         // Band 09 — Mid-level water vapor
  };

  var band = productMap[product] || 'GEOCOLOR';
  var baseUrl = 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/psw/';
  var ts = new Date().getTime();

  var result = {
    timestamp: new Date().toISOString(),
    product: product,
    satellite: 'GOES-18',
    url: baseUrl + band + '/latest.jpg?t=' + ts,
    urls: {
      geocolor:    baseUrl + 'GEOCOLOR/latest.jpg?t=' + ts,
      visible:     baseUrl + '02/latest.jpg?t=' + ts,
      infrared:    baseUrl + '13/latest.jpg?t=' + ts,
      watervapor:  baseUrl + '09/latest.jpg?t=' + ts
    }
  };

  cachePut(cacheKey, result, CACHE_SATELLITE);
  return result;
}

// ── Optional: Time-driven trigger for warming cache ─────────────────────────
function warmCache() {
  getCurrentWeather();
  getHourlyForecast();
  getWeatherAlerts();
  getRadarImageUrl();
  getSatelliteImageUrl('GEOCOLOR');
  Logger.log('Cache warmed at ' + new Date().toISOString());
}

// Run this once to install the periodic cache-warming trigger
function installTrigger() {
  // Remove existing triggers first
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'warmCache') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Create new trigger: every 5 minutes
  ScriptApp.newTrigger('warmCache')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('Trigger installed: warmCache every 5 minutes');
}
