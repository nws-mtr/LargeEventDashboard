// ============================================================================
// js/api.js — All async API fetch functions (replaces Code.gs server logic)
// ============================================================================

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

// ── Unit converters ──────────────────────────────────────────────────────────

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
  if (deg === null || deg === undefined) return "N";
  const val = Math.floor((deg / 22.5) + 0.5);
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
               "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[val % 16];
}

function round1(v) { return v !== null && v !== undefined ? Math.round(v * 10) / 10 : null; }
function round2(v) { return v !== null && v !== undefined ? Math.round(v * 100) / 100 : null; }

// ── NWS Gridpoint ────────────────────────────────────────────────────────────

async function getNWSGridPoint_() {
  const cached = cacheGet("nws_gridpoint");
  if (cached) return cached;
  const config = await getConfig();
  const points = await fetchJSON(
    `https://api.weather.gov/points/${config.latitude},${config.longitude}`,
    { headers: { "Accept": "application/geo+json" } }
  );
  const result = {
    forecastHourly:       points.properties.forecastHourly,
    forecast:             points.properties.forecast,
    observationStations:  points.properties.observationStations,
    gridId:               points.properties.gridId,
    gridX:                points.properties.gridX,
    gridY:                points.properties.gridY
  };
  cachePut("nws_gridpoint", result, 3600);
  return result;
}

// ── Current Weather ──────────────────────────────────────────────────────────

async function getCurrentWeather() {
  const cached = cacheGet("weather_current");
  if (cached) return cached;
  try {
    return await fetchSynopticWeather_();
  } catch {
    try {
      return await fetchNOAAWeather_();
    } catch {
      return { error: "Unable to fetch weather data", timestamp: new Date().toISOString() };
    }
  }
}

async function fetchSynopticWeather_() {
  const config = await getConfig();
  const url = "https://api.synopticdata.com/v2/stations/nearesttime"
    + `?token=${SYNOPTIC_API_KEY}`
    + `&radius=${config.latitude},${config.longitude},50`
    + "&limit=1&within=120"
    + "&vars=air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility,cloud_layer_1_code,cloud_layer_2_code,cloud_layer_3_code,precip_accum_one_hour,sea_level_pressure,altimeter"
    + "&network=1,2"
    + "&obtimezone=UTC&output=json";
  const data = await fetchJSON(url);
  if (!data.STATION || data.STATION.length === 0) {
    throw new Error("No stations found near location");
  }
  const station = data.STATION[0];
  const obs = station.OBSERVATIONS;

  function getVal(...fields) {
    for (const field of fields) {
      if (obs[field] && typeof obs[field].value !== "undefined") return obs[field].value;
    }
    return null;
  }
  function getTimestamp(...fields) {
    for (const field of fields) {
      if (obs[field] && obs[field].date_time) return obs[field].date_time;
    }
    return null;
  }

  const tempC       = getVal("air_temp_value_1", "air_temp_set_1");
  const dewpointC   = getVal("dew_point_temperature_value_1d", "dew_point_temperature_set_1d");
  const windSpeedMs = getVal("wind_speed_value_1", "wind_speed_set_1");
  const windGustMs  = getVal("wind_gust_value_1", "wind_gust_set_1");
  const windDir     = getVal("wind_direction_value_1", "wind_direction_set_1");
  const pressurePa  = getVal("altimeter_value_1", "altimeter_set_1");
  const precipMm    = getVal("precip_accum_one_hour_value_1", "precip_accum_one_hour_set_1");
  const visib       = getVal("visibility_value_1", "visibility_set_1");
  const rh          = getVal("relative_humidity_value_1", "relative_humidity_set_1");
  const slp         = getVal("sea_level_pressure_value_1d", "sea_level_pressure_set_1d");
  const cloud1      = getVal("cloud_layer_1_code_value_1", "cloud_layer_1_code_set_1");
  const cloud2      = getVal("cloud_layer_2_code_value_1", "cloud_layer_2_code_set_1");
  const cloud3      = getVal("cloud_layer_3_code_value_1", "cloud_layer_3_code_set_1");

  function parseCloudLayer(raw) {
    if (!raw) return null;
    const match = String(raw).match(/(CLR|SKC|FEW|SCT|BKN|OVC|VV)(\d{3})?/i);
    if (!match) return String(raw);
    const cover = match[1].toUpperCase();
    const ht    = match[2] ? parseInt(match[2], 10) * 100 : null;
    const names = { CLR: "Clear", SKC: "Clear", FEW: "Few", SCT: "Scattered", BKN: "Broken", OVC: "Overcast", VV: "Vert Vis" };
    return ht ? `${names[cover] || cover} @ ${ht.toLocaleString()} ft` : (names[cover] || cover);
  }

  const cloudLayers = [parseCloudLayer(cloud1), parseCloudLayer(cloud2), parseCloudLayer(cloud3)].filter(Boolean);

  const result = {
    timestamp:       new Date().toISOString(),
    observationTime: getTimestamp("air_temp_value_1", "air_temp_set_1"),
    source:          "Synoptic Data API",
    station: {
      id:        station.STID,
      name:      station.NAME,
      latitude:  station.LATITUDE,
      longitude: station.LONGITUDE,
      distance:  station.DISTANCE
    },
    observations: {
      temperature:      { value: round1(celsiusToFahrenheit(tempC)), unit: "F" },
      dewpoint:         { value: round1(celsiusToFahrenheit(dewpointC)), unit: "F" },
      relativeHumidity: { value: round1(rh), unit: "%" },
      wind: {
        speed:    { value: round1(msToMph(windSpeedMs)), unit: "mph" },
        direction:{ value: round1(windDir), unit: "degrees" },
        cardinal: degToCompass(windDir),
        gust:     { value: round1(msToMph(windGustMs)), unit: "mph" }
      },
      visibility:   { value: round1(visib), unit: "miles" },
      pressure: {
        seaLevel:  { value: round1(slp), unit: "mb" },
        altimeter: { value: round2(pascalsToInHg(pressurePa)), unit: "inHg" }
      },
      precipitation: { oneHour: { value: round2(mmToInches(precipMm)), unit: "inches" } },
      clouds: cloudLayers
    },
    location: config
  };
  cachePut("weather_current", result, CACHE_WEATHER);
  return result;
}

async function fetchNOAAWeather_() {
  const config = await getConfig();
  const grid = await getNWSGridPoint_();
  const stations = await fetchJSON(grid.observationStations, {
    headers: { "Accept": "application/geo+json" }
  });
  const stationUrl = stations.features[0].id;
  const obsData = await fetchJSON(`${stationUrl}/observations/latest`, {
    headers: { "Accept": "application/geo+json" }
  });

  const props = obsData.properties;
  const tempC  = props.temperature && props.temperature.value;
  const dewC   = props.dewpoint && props.dewpoint.value;
  const rh     = props.relativeHumidity && props.relativeHumidity.value;
  const wsMs   = props.windSpeed && props.windSpeed.value;
  const wDir   = props.windDirection && props.windDirection.value;
  const wgMs   = props.windGust && props.windGust.value;
  const vis    = props.visibility && props.visibility.value;
  const slp    = props.seaLevelPressure && props.seaLevelPressure.value;

  const nwsClouds = [];
  if (props.cloudLayers && props.cloudLayers.length > 0) {
    const clNames = { CLR: "Clear", SKC: "Clear", FEW: "Few", SCT: "Scattered", BKN: "Broken", OVC: "Overcast", VV: "Vert Vis" };
    for (const cl of props.cloudLayers) {
      const amt  = cl.amount || "";
      const base = cl.base && cl.base.value ? Math.round(cl.base.value * 3.28084) : null;
      nwsClouds.push(base ? `${clNames[amt] || amt} @ ${base.toLocaleString()} ft` : (clNames[amt] || amt));
    }
  }

  const result = {
    timestamp:       new Date().toISOString(),
    observationTime: props.timestamp,
    source:          "NOAA NWS (fallback)",
    station: {
      id:   stationUrl.split("/").pop(),
      name: "NWS Station"
    },
    observations: {
      temperature:      { value: round1(celsiusToFahrenheit(tempC)), unit: "F" },
      dewpoint:         { value: round1(celsiusToFahrenheit(dewC)), unit: "F" },
      relativeHumidity: { value: round1(rh), unit: "%" },
      wind: {
        speed:     { value: round1(msToMph(wsMs)), unit: "mph" },
        direction: { value: round1(wDir), unit: "degrees" },
        cardinal:  degToCompass(wDir),
        gust:      { value: round1(msToMph(wgMs)), unit: "mph" }
      },
      visibility:   { value: vis !== null ? round1(vis / 1609.34) : null, unit: "miles" },
      pressure: {
        seaLevel:  { value: slp !== null ? round1(slp / 100) : null, unit: "mb" },
        altimeter: { value: slp !== null ? round2(slp / 3386.39) : null, unit: "inHg" }
      },
      precipitation: { oneHour: { value: null, unit: "inches" } },
      clouds: nwsClouds
    },
    location: config
  };
  cachePut("weather_current", result, CACHE_WEATHER);
  return result;
}

// ── Gridpoint Forecast ───────────────────────────────────────────────────────

async function getGridpointForecast() {
  const cached = cacheGet("gridpoint_forecast");
  if (cached) return cached;
  const config = await getConfig();

  try {
    const grid = await getNWSGridPoint_();
    const url  = `https://api.weather.gov/gridpoints/${grid.gridId}/${grid.gridX},${grid.gridY}`;
    const data = await fetchJSON(url, { headers: { "Accept": "application/geo+json" } });
    const props = data.properties;

    const now = new Date();
    let startHour = new Date(now);
    startHour.setMinutes(0, 0, 0);
    if (startHour <= now) startHour = new Date(startHour.getTime() + 3600000);

    const hours = [];
    for (let i = 0; i < 48; i++) {
      hours.push(new Date(startHour.getTime() + i * 3600000).toISOString());
    }

    function expandToHourly(fieldData) {
      if (!fieldData || !fieldData.values) return {};
      const map = {};
      for (const entry of fieldData.values) {
        const parts = entry.validTime.split("/");
        const start = new Date(parts[0]);
        const durationMs = parseDuration_(parts[1]);
        const end = new Date(start.getTime() + durationMs);
        let t = new Date(start);
        while (t < end) {
          map[t.toISOString()] = entry.value;
          t = new Date(t.getTime() + 3600000);
        }
      }
      return map;
    }

    const tempMap = expandToHourly(props.temperature);
    const dewMap  = expandToHourly(props.dewpoint);
    const rhMap   = expandToHourly(props.relativeHumidity);
    const wsMap   = expandToHourly(props.windSpeed);
    const wdMap   = expandToHourly(props.windDirection);
    const wgMap   = expandToHourly(props.windGust);
    const popMap  = expandToHourly(props.probabilityOfPrecipitation);
    const skyMap  = expandToHourly(props.skyCover);
    const qpfMap  = expandToHourly(props.quantitativePrecipitation);

    const series = hours.map((iso) => ({
      time:                    iso,
      temperature:             tempMap[iso] !== undefined ? round1(celsiusToFahrenheit(tempMap[iso])) : null,
      dewpoint:                dewMap[iso]  !== undefined ? round1(celsiusToFahrenheit(dewMap[iso]))  : null,
      relativeHumidity:        rhMap[iso]   !== undefined ? Math.round(rhMap[iso])   : null,
      windSpeed:               wsMap[iso]   !== undefined ? round1(wsMap[iso] * 0.621371) : null,
      windDirection:           wdMap[iso]   !== undefined ? Math.round(wdMap[iso])   : null,
      windCardinal:            degToCompass(wdMap[iso]),
      windGust:                wgMap[iso]   !== undefined ? round1(wgMap[iso] * 0.621371) : null,
      probabilityOfPrecipitation: popMap[iso] !== undefined ? Math.round(popMap[iso]) : null,
      skyCover:                skyMap[iso]  !== undefined ? Math.round(skyMap[iso])  : null,
      qpf:                     qpfMap[iso]  !== undefined ? round2(qpfMap[iso] / 25.4) : null
    }));

    const result = {
      timestamp:        new Date().toISOString(),
      source:           `NWS Gridpoint Forecast (${grid.gridId} ${grid.gridX},${grid.gridY})`,
      hours:            series,
    };
    cachePut("gridpoint_forecast", result, CACHE_FORECAST);
    return result;
  } catch (err) {
    return { error: `Unable to fetch gridpoint forecast: ${err.message}`, timestamp: new Date().toISOString(), hours: [] };
  }
}

function parseDuration_(dur) {
  if (!dur) return 3600000;
  let ms = 0;
  const dayMatch  = dur.match(/(\d+)D/);
  const hourMatch = dur.match(/(\d+)H/);
  const minMatch  = dur.match(/(\d+)M/);
  if (dayMatch)  ms += parseInt(dayMatch[1],  10) * 86400000;
  if (hourMatch) ms += parseInt(hourMatch[1], 10) * 3600000;
  if (minMatch)  ms += parseInt(minMatch[1],  10) * 60000;
  return ms || 3600000;
}

// ── Radar Times ──────────────────────────────────────────────────────────────

async function getRadarTimes() {
  const cached = cacheGet("radar_times");
  if (cached) return cached;
  try {
    const capsUrl = `${RADAR_WMS_URL}?service=wms&version=1.3.0&request=GetCapabilities`;
    const response = await fetch(capsUrl);
    if (!response.ok) throw new Error(`WMS GetCapabilities HTTP ${response.status}`);
    const xml = await response.text();
    const timeMatch = xml.match(/<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i);
    if (!timeMatch) throw new Error("No time dimension in WMS capabilities");

    const allTimes = timeMatch[1].split(",").map((t) => t.trim());
    const cutoff   = new Date(Date.now() - 30 * 60 * 1000);
    let times      = allTimes.filter((t) => new Date(t) >= cutoff);
    if (times.length < 3 && allTimes.length > 0) times = allTimes.slice(-15);

    const result = {
      timestamp:      new Date().toISOString(),
      source:         "MRMS CONUS Base Reflectivity (QCD)",
      wmsUrl:         RADAR_WMS_URL,
      layer:          "conus_bref_qcd",
      style:          "radar_reflectivity",
      times,
      totalAvailable: allTimes.length,
      timeCount:      times.length
    };
    cachePut("radar_times", result, CACHE_RADAR);
    return result;
  } catch {
    // Fallback: return current time so radar layer still loads
    return { timestamp: new Date().toISOString(), times: [new Date().toISOString()], timeCount: 1 };
  }
}

// ── Satellite Times ──────────────────────────────────────────────────────────

async function getSatelliteTimes(channel) {
  const selectedChannel = channel || "G18-ABI-CONUS-BAND02";
  const cacheKey = `satellite_times_${selectedChannel}`;
  const cached   = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const data     = await fetchJSON(`${SATELLITE_TIMES_URL}?products=${selectedChannel}`);
    const allTimes = data[selectedChannel] || [];
    const cutoffMs = Date.now() - SATELLITE_LOOP_MINUTES * 60 * 1000;

    let times = allTimes.filter((t) => {
      const iso = `${t.substring(0,4)}-${t.substring(4,6)}-${t.substring(6,8)}T${t.substring(9,11)}:${t.substring(11,13)}:${t.substring(13,15)}Z`;
      return new Date(iso).getTime() >= cutoffMs;
    });
    if (times.length < 2 && allTimes.length > 0) times = allTimes.slice(-6);

    const result = {
      timestamp:      new Date().toISOString(),
      source:         "GOES-18 (SSEC RealEarth)",
      tileUrl:        SATELLITE_TILE_URL,
      channel:        selectedChannel,
      channelName:    SATELLITE_CHANNELS[selectedChannel] || selectedChannel,
      times,
      totalAvailable: allTimes.length,
      timeCount:      times.length
    };
    cachePut(cacheKey, result, CACHE_SATELLITE);
    return result;
  } catch (err) {
    return { error: `Unable to fetch satellite times: ${err.message}`, timestamp: new Date().toISOString(), times: [], channel: selectedChannel };
  }
}

// ── Wind Rose Data (Synoptic Time Series) ────────────────────────────────────

const WIND_ROSE_DIRECTIONS = [
  "N","NNE","NE","ENE","E","ESE","SE","SSE",
  "S","SSW","SW","WSW","W","WNW","NW","NNW"
];

const WIND_SPEED_BINS = [
  { min: 0,  max: 5,      label: "0-5",  color: "#90caf9" },
  { min: 5,  max: 10,     label: "5-10", color: "#66bb6a" },
  { min: 10, max: 15,     label: "10-15",color: "#fdd835" },
  { min: 15, max: 20,     label: "15-20",color: "#ff9800" },
  { min: 20, max: Infinity,label: "20+", color: "#f44336" }
];

async function fetchSynopticTimeSeries_(stationId) {
  const config = await getConfig();
  const end   = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago

  const fmt = (d) => d.toISOString().replace(/[-:T]/g, "").substring(0, 12);

  // Use specific station if provided, otherwise radius search
  const stationParam = stationId
    ? `&stid=${stationId}`
    : `&radius=${config.latitude},${config.longitude},50&limit=1`;

  const url = "https://api.synopticdata.com/v2/stations/timeseries"
    + `?token=${SYNOPTIC_API_KEY}`
    + stationParam
    + `&start=${fmt(start)}&end=${fmt(end)}`
    + "&vars=wind_speed,wind_direction"
    + "&network=1,2"
    + "&obtimezone=UTC&units=english&output=json";

  const data = await fetchJSON(url);
  if (!data.STATION || data.STATION.length === 0) {
    throw new Error("No stations found near location");
  }
  return data.STATION[0];
}

async function getWindRoseData(stationId) {
  const cacheKey = stationId ? `windrose_data_${stationId}` : "windrose_data";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const station = await fetchSynopticTimeSeries_(stationId);
    const obs     = station.OBSERVATIONS;

    const speeds     = obs.wind_speed_set_1     || [];
    const directions = obs.wind_direction_set_1  || [];
    const count      = Math.min(speeds.length, directions.length);

    // Initialize 16 direction bins, each with speed-range counts
    const bins = WIND_ROSE_DIRECTIONS.map((label) => ({
      label,
      speedCounts: WIND_SPEED_BINS.map(() => 0)
    }));

    let totalObs = 0;
    for (let i = 0; i < count; i++) {
      const spd = speeds[i];
      const dir = directions[i];
      if (spd === null || dir === null || spd === 0) continue;

      // Map direction (0-360) to one of 16 bins
      const binIdx = Math.round(dir / 22.5) % 16;
      // Map speed to speed-range bucket
      const spdIdx = WIND_SPEED_BINS.findIndex((b) => spd >= b.min && spd < b.max);
      if (spdIdx >= 0) {
        bins[binIdx].speedCounts[spdIdx]++;
        totalObs++;
      }
    }

    const result = {
      bins,
      totalObs,
      stationName: station.NAME || station.STID || "Unknown",
      stationId:   station.STID || "",
      timestamp:   new Date().toISOString()
    };
    cachePut(cacheKey, result, CACHE_WINDROSE);
    return result;
  } catch (err) {
    return { error: `Unable to fetch wind data: ${err.message}`, bins: [], totalObs: 0, timestamp: new Date().toISOString() };
  }
}

// ── Forecast Wind Rose ────────────────────────────────────────────────────────

async function getForecastWindRose(numHours) {
  numHours = numHours || 24;
  const cacheKey = "forecast_windrose_" + numHours;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const forecast = await getGridpointForecast();
    if (forecast.error) return { error: forecast.error, bins: [], totalObs: 0, timestamp: new Date().toISOString() };

    const hours = (forecast.hours || []).slice(0, numHours);
    const DIR_LABELS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    const bins = DIR_LABELS.map((label) => ({
      label,
      speedCounts: WIND_SPEED_BINS.map(() => 0)
    }));

    let totalObs = 0;
    for (const hr of hours) {
      const spd = hr.windSpeed;
      const dir = hr.windDirection;
      if (spd == null || dir == null || spd === 0) continue;

      const binIdx = Math.round(dir / 22.5) % 16;
      const spdIdx = WIND_SPEED_BINS.findIndex((b) => spd >= b.min && spd < b.max);
      if (spdIdx >= 0) {
        bins[binIdx].speedCounts[spdIdx]++;
        totalObs++;
      }
    }

    const result = {
      bins,
      totalObs,
      stationName: "NWS Forecast",
      stationId:   "",
      timestamp:   new Date().toISOString()
    };
    cachePut(cacheKey, result, CACHE_FORECAST);
    return result;
  } catch (err) {
    return { error: `Unable to build forecast wind rose: ${err.message}`, bins: [], totalObs: 0, timestamp: new Date().toISOString() };
  }
}
