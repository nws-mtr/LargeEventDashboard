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

// WMS configuration for MRMS radar
var RADAR_WMS_URL = "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows";

// Satellite imagery via SSEC RealEarth (GOES-18 ABI, tile API with time dimension)
var SATELLITE_TILE_URL = "https://realearth.ssec.wisc.edu/api/image";
var SATELLITE_TIMES_URL = "https://realearth.ssec.wisc.edu/api/times";
var SATELLITE_CHANNELS = {
  "G18-ABI-CONUS-BAND02": "Visible (0.64µm)",
  "G18-ABI-CONUS-BAND09": "Water Vapor (6.9µm)",
  "G18-ABI-CONUS-BAND13": "Clean IR (10.3µm)"
};
var SATELLITE_LOOP_MINUTES = 30;  // how many minutes of satellite to loop

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

// ── Hourly Forecast (NWS API — text-based periods) ──────────────────────────
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

// ── Gridpoint Forecast Time Series (NWS raw grid data) ─────────────────────
// Returns hourly arrays for the next 24h: temp, dewpoint, RH, wind, PoP, sky
function getGridpointForecast() {
  var cached = cacheGet('gridpoint_forecast');
  if (cached) return cached;

  var headers = { 'User-Agent': NWS_USER_AGENT };

  try {
    var grid = getNWSGridPoint_();
    var url = 'https://api.weather.gov/gridpoints/' + grid.gridId + '/' + grid.gridX + ',' + grid.gridY;
    var data = fetchJSON(url, headers);
    var props = data.properties;

    // Build hourly time slots for the next 24 hours (top of each hour)
    var now = new Date();
    // Round up to the next full hour
    var startHour = new Date(now);
    startHour.setMinutes(0, 0, 0);
    if (startHour <= now) {
      startHour = new Date(startHour.getTime() + 3600000);
    }

    var hours = [];
    for (var i = 0; i < 24; i++) {
      hours.push(new Date(startHour.getTime() + i * 3600000).toISOString());
    }

    // Expand NWS interval-based values into hourly values
    // NWS format: { validTime: "2026-02-07T19:00:00+00:00/PT1H", value: 15 }
    // The duration after / means the value is valid for that period
    function expandToHourly(fieldData) {
      if (!fieldData || !fieldData.values) return {};
      var map = {};
      for (var i = 0; i < fieldData.values.length; i++) {
        var entry = fieldData.values[i];
        var parts = entry.validTime.split('/');
        var start = new Date(parts[0]);
        var durationMs = parseDuration_(parts[1]);
        var end = new Date(start.getTime() + durationMs);

        // Fill every hour within this interval
        var t = new Date(start);
        while (t < end) {
          map[t.toISOString()] = entry.value;
          t = new Date(t.getTime() + 3600000);
        }
      }
      return map;
    }

    var tempMap   = expandToHourly(props.temperature);
    var dewMap    = expandToHourly(props.dewpoint);
    var rhMap     = expandToHourly(props.relativeHumidity);
    var wsMap     = expandToHourly(props.windSpeed);
    var wdMap     = expandToHourly(props.windDirection);
    var wgMap     = expandToHourly(props.windGust);
    var popMap    = expandToHourly(props.probabilityOfPrecipitation);
    var skyMap    = expandToHourly(props.skyCover);
    var qpfMap    = expandToHourly(props.quantitativePrecipitation);

    // Assemble the hourly time series
    var series = [];
    for (var h = 0; h < hours.length; h++) {
      var iso = hours[h];
      var tempC = tempMap[iso];
      var dewC  = dewMap[iso];
      var wsKmh = wsMap[iso];
      var wgKmh = wgMap[iso];

      series.push({
        time: iso,
        temperature:  tempC !== undefined ? round1(celsiusToFahrenheit(tempC)) : null,
        dewpoint:     dewC !== undefined ? round1(celsiusToFahrenheit(dewC)) : null,
        relativeHumidity: rhMap[iso] !== undefined ? Math.round(rhMap[iso]) : null,
        windSpeed:    wsKmh !== undefined ? round1(wsKmh * 0.621371) : null,  // km/h → mph
        windDirection: wdMap[iso] !== undefined ? Math.round(wdMap[iso]) : null,
        windCardinal: degToCompass(wdMap[iso]),
        windGust:     wgKmh !== undefined ? round1(wgKmh * 0.621371) : null,
        probabilityOfPrecipitation: popMap[iso] !== undefined ? Math.round(popMap[iso]) : null,
        skyCover:     skyMap[iso] !== undefined ? Math.round(skyMap[iso]) : null,
        qpf:          qpfMap[iso] !== undefined ? round2(qpfMap[iso] / 25.4) : null  // mm → inches
      });
    }

    var result = {
      timestamp: new Date().toISOString(),
      source: 'NWS Gridpoint Forecast (MTR ' + grid.gridX + ',' + grid.gridY + ')',
      hours: series
    };

    cachePut('gridpoint_forecast', result, CACHE_FORECAST);
    return result;
  } catch (e) {
    Logger.log('Error fetching gridpoint forecast: ' + e.message);
    return { error: 'Unable to fetch gridpoint forecast: ' + e.message, timestamp: new Date().toISOString(), hours: [] };
  }
}

// Parse ISO 8601 duration string (e.g. PT1H, PT6H, P1DT12H) to milliseconds
function parseDuration_(dur) {
  if (!dur) return 3600000; // default 1 hour
  var ms = 0;
  var dayMatch = dur.match(/(\d+)D/);
  var hourMatch = dur.match(/(\d+)H/);
  var minMatch = dur.match(/(\d+)M/);
  if (dayMatch) ms += parseInt(dayMatch[1]) * 86400000;
  if (hourMatch) ms += parseInt(hourMatch[1]) * 3600000;
  if (minMatch) ms += parseInt(minMatch[1]) * 60000;
  return ms || 3600000;
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

// ── Radar WMS Time Dimension (parsed from GetCapabilities) ──────────────────
// Returns only the last 30 minutes of frames for the client-side loop.
function getRadarTimes() {
  var cached = cacheGet('radar_times');
  if (cached) return cached;

  try {
    var capsUrl = RADAR_WMS_URL
      + '?service=wms&version=1.3.0&request=GetCapabilities';

    var response = UrlFetchApp.fetch(capsUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error('WMS GetCapabilities HTTP ' + response.getResponseCode());
    }

    var xml = response.getContentText();

    // Parse time dimension value from the XML
    // <Dimension name="time" ...>time1,time2,time3,...</Dimension>
    var timeMatch = xml.match(/<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i);
    if (!timeMatch || !timeMatch[1]) {
      throw new Error('No time dimension found in WMS capabilities');
    }

    var allTimes = timeMatch[1].split(',').map(function(t) { return t.trim(); });

    // Filter to last 30 minutes
    var cutoff = new Date(Date.now() - 30 * 60 * 1000);
    var times = allTimes.filter(function(t) {
      return new Date(t) >= cutoff;
    });

    // Fallback: if filter leaves too few, take last 15 frames (~30 min at 2-min cadence)
    if (times.length < 3 && allTimes.length > 0) {
      times = allTimes.slice(-15);
    }

    var result = {
      timestamp: new Date().toISOString(),
      source: 'MRMS CONUS Base Reflectivity (QCD)',
      wmsUrl: RADAR_WMS_URL,
      layer: 'conus_bref_qcd',
      style: 'radar_reflectivity',
      times: times,
      totalAvailable: allTimes.length,
      timeCount: times.length
    };

    cachePut('radar_times', result, CACHE_RADAR);
    return result;
  } catch (e) {
    Logger.log('Error fetching radar WMS times: ' + e.message);
    return {
      error: 'Unable to fetch radar times',
      timestamp: new Date().toISOString(),
      times: []
    };
  }
}

// ── Satellite Times (GOES-18 via SSEC RealEarth tile API) ───────────────────
// Fetches available timestamps for a given channel and returns the last 30 min.
// SSEC times format: "20260208.020117" (YYYYMMdd.HHmmss)
function getSatelliteTimes(channel) {
  channel = channel || 'G18-ABI-CONUS-BAND02';
  var cacheKey = 'satellite_times_' + channel;

  var cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    var url = SATELLITE_TIMES_URL + '?products=' + channel;
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      throw new Error('SSEC times API HTTP ' + response.getResponseCode());
    }

    var data = JSON.parse(response.getContentText());
    var allTimes = data[channel] || [];

    // Filter to last SATELLITE_LOOP_MINUTES
    // Parse SSEC format "YYYYMMdd.HHmmss" to Date for comparison
    var cutoffMs = Date.now() - SATELLITE_LOOP_MINUTES * 60 * 1000;

    var times = allTimes.filter(function(t) {
      // "20260208.020117" → "2026-02-08T02:01:17Z"
      var iso = t.substring(0,4) + '-' + t.substring(4,6) + '-' + t.substring(6,8) +
                'T' + t.substring(9,11) + ':' + t.substring(11,13) + ':' + t.substring(13,15) + 'Z';
      return new Date(iso).getTime() >= cutoffMs;
    });

    // Fallback: if filter leaves too few, take last 6 frames (~30 min at 5-min cadence)
    if (times.length < 2 && allTimes.length > 0) {
      times = allTimes.slice(-6);
    }

    var result = {
      timestamp: new Date().toISOString(),
      source: 'GOES-18 (SSEC RealEarth)',
      tileUrl: SATELLITE_TILE_URL,
      channel: channel,
      channelName: SATELLITE_CHANNELS[channel] || channel,
      times: times,
      totalAvailable: allTimes.length,
      timeCount: times.length
    };

    cachePut(cacheKey, result, CACHE_SATELLITE);
    return result;
  } catch (e) {
    Logger.log('Error fetching satellite times: ' + e.message);
    return {
      error: 'Unable to fetch satellite times: ' + e.message,
      timestamp: new Date().toISOString(),
      times: [],
      channel: channel
    };
  }
}

// Return available satellite channels
function getSatelliteChannels() {
  return SATELLITE_CHANNELS;
}

// ── Optional: Time-driven trigger for warming cache ─────────────────────────
function warmCache() {
  getCurrentWeather();
  getHourlyForecast();
  getGridpointForecast();
  getWeatherAlerts();
  getRadarTimes();
  getSatelliteTimes();  // warm default VIS channel
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
