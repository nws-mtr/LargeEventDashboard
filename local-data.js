const EVENT_CONFIG = {
  name: "Super Bowl LX",
  location: "Levi's Stadium",
  latitude: 37.403147,
  longitude: -121.969814,
  timezone: "America/Los_Angeles",
  startDate: "2026-02-08T15:30:00",
  endDate: "2026-02-08T22:00:00",
  adverseConditions: {
    maxTemp: 80,
    minRainChance: 15,
    minSkyCover: 50
  }
};

const SYNOPTIC_API_KEY = "e0fb17ad65504848934b1f1ece0c78f8";
const NEAREST_STATION = "462PG";
const RADAR_STATION = "KMUX";

const RADAR_WMS_URL = "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows";
const SATELLITE_TILE_URL = "https://realearth.ssec.wisc.edu/api/image";
const SATELLITE_TIMES_URL = "https://realearth.ssec.wisc.edu/api/times";
const SATELLITE_CHANNELS = {
  "G18-ABI-CONUS-BAND02": "Visible (0.64um)",
  "G18-ABI-CONUS-BAND09": "Water Vapor (6.9um)",
  "G18-ABI-CONUS-BAND13": "Clean IR (10.3um)"
};
const SATELLITE_LOOP_MINUTES = 30;

const CACHE_WEATHER = 300;
const CACHE_RADAR = 120;
const CACHE_SATELLITE = 300;
const CACHE_FORECAST = 3600;
const CACHE_ALERTS = 60;
const CACHE_KEYPOINTS = 3600;

const OPENAI_API_KEY = "";

const memoryCache = new Map();

function cacheGet(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function cachePut(key, value, ttlSeconds) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

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

async function getNWSGridPoint_() {
  const cached = cacheGet("nws_gridpoint");
  if (cached) return cached;

  const lat = EVENT_CONFIG.latitude;
  const lon = EVENT_CONFIG.longitude;
  const points = await fetchJSON(`https://api.weather.gov/points/${lat},${lon}`, {
    headers: { "Accept": "application/geo+json" }
  });

  const result = {
    forecastHourly: points.properties.forecastHourly,
    forecast: points.properties.forecast,
    observationStations: points.properties.observationStations,
    gridId: points.properties.gridId,
    gridX: points.properties.gridX,
    gridY: points.properties.gridY
  };

  cachePut("nws_gridpoint", result, 3600);
  return result;
}

function getConfig() {
  return Promise.resolve(EVENT_CONFIG);
}

async function getCurrentWeather() {
  const cached = cacheGet("weather_current");
  if (cached) return cached;

  try {
    return await fetchSynopticWeather_();
  } catch (err) {
    try {
      return await fetchNOAAWeather_();
    } catch (err2) {
      return { error: "Unable to fetch weather data", timestamp: new Date().toISOString() };
    }
  }
}

async function fetchSynopticWeather_() {
  const lat = EVENT_CONFIG.latitude;
  const lon = EVENT_CONFIG.longitude;

  const url = "https://api.synopticdata.com/v2/stations/nearesttime"
    + `?token=${SYNOPTIC_API_KEY}`
    + `&radius=${lat},${lon},50`
    + "&limit=1"
    + "&within=120"
    + "&vars=air_temp,dew_point_temperature,relative_humidity,wind_speed,wind_direction,wind_gust,visibility,cloud_layer_1_code,cloud_layer_2_code,cloud_layer_3_code,precip_accum_one_hour,sea_level_pressure,altimeter"
    + "&obtimezone=UTC"
    + "&output=json";

  const data = await fetchJSON(url);

  if (!data.STATION || data.STATION.length === 0) {
    throw new Error("No stations found near location");
  }

  const station = data.STATION[0];
  const obs = station.OBSERVATIONS;

  function getVal() {
    for (let i = 0; i < arguments.length; i++) {
      const field = arguments[i];
      if (obs[field] && typeof obs[field].value !== "undefined") return obs[field].value;
    }
    return null;
  }

  function getTimestamp() {
    for (let i = 0; i < arguments.length; i++) {
      const field = arguments[i];
      if (obs[field] && obs[field].date_time) return obs[field].date_time;
    }
    return null;
  }

  const tempC = getVal("air_temp_value_1", "air_temp_set_1");
  const dewpointC = getVal("dew_point_temperature_value_1d", "dew_point_temperature_set_1d");
  const windSpeedMs = getVal("wind_speed_value_1", "wind_speed_set_1");
  const windGustMs = getVal("wind_gust_value_1", "wind_gust_set_1");
  const windDir = getVal("wind_direction_value_1", "wind_direction_set_1");
  const pressurePa = getVal("altimeter_value_1", "altimeter_set_1");
  const precipMm = getVal("precip_accum_one_hour_value_1", "precip_accum_one_hour_set_1");
  const visib = getVal("visibility_value_1", "visibility_set_1");
  const rh = getVal("relative_humidity_value_1", "relative_humidity_set_1");
  const slp = getVal("sea_level_pressure_value_1d", "sea_level_pressure_set_1d");

  const cloud1 = getVal("cloud_layer_1_code_value_1", "cloud_layer_1_code_set_1");
  const cloud2 = getVal("cloud_layer_2_code_value_1", "cloud_layer_2_code_set_1");
  const cloud3 = getVal("cloud_layer_3_code_value_1", "cloud_layer_3_code_set_1");

  function parseCloudLayer(raw) {
    if (!raw) return null;
    const str = String(raw);
    const match = str.match(/(CLR|SKC|FEW|SCT|BKN|OVC|VV)(\d{3})?/i);
    if (!match) return str;
    const cover = match[1].toUpperCase();
    const ht = match[2] ? parseInt(match[2], 10) * 100 : null;
    const names = { CLR: "Clear", SKC: "Clear", FEW: "Few", SCT: "Scattered", BKN: "Broken", OVC: "Overcast", VV: "Vert Vis" };
    const name = names[cover] || cover;
    return ht ? `${name} @ ${ht.toLocaleString()} ft` : name;
  }

  const cloudLayers = [parseCloudLayer(cloud1), parseCloudLayer(cloud2), parseCloudLayer(cloud3)]
    .filter((c) => c !== null);

  const result = {
    timestamp: new Date().toISOString(),
    observationTime: getTimestamp("air_temp_value_1", "air_temp_set_1"),
    source: "Synoptic Data API",
    station: {
      id: station.STID,
      name: station.NAME,
      latitude: station.LATITUDE,
      longitude: station.LONGITUDE,
      distance: station.DISTANCE
    },
    observations: {
      temperature: { value: round1(celsiusToFahrenheit(tempC)), unit: "F" },
      dewpoint: { value: round1(celsiusToFahrenheit(dewpointC)), unit: "F" },
      relativeHumidity: { value: round1(rh), unit: "%" },
      wind: {
        speed: { value: round1(msToMph(windSpeedMs)), unit: "mph" },
        direction: { value: round1(windDir), unit: "degrees" },
        cardinal: degToCompass(windDir),
        gust: { value: round1(msToMph(windGustMs)), unit: "mph" }
      },
      visibility: { value: round1(visib), unit: "miles" },
      pressure: {
        seaLevel: { value: round1(slp), unit: "mb" },
        altimeter: { value: round2(pascalsToInHg(pressurePa)), unit: "inHg" }
      },
      precipitation: { oneHour: { value: round2(mmToInches(precipMm)), unit: "inches" } },
      clouds: cloudLayers
    },
    location: EVENT_CONFIG
  };

  cachePut("weather_current", result, CACHE_WEATHER);
  return result;
}

async function fetchNOAAWeather_() {
  const grid = await getNWSGridPoint_();
  const stations = await fetchJSON(grid.observationStations, {
    headers: { "Accept": "application/geo+json" }
  });
  const stationUrl = stations.features[0].id;
  const obsData = await fetchJSON(`${stationUrl}/observations/latest`, {
    headers: { "Accept": "application/geo+json" }
  });

  const props = obsData.properties;
  const tempC = props.temperature && props.temperature.value;
  const dewC = props.dewpoint && props.dewpoint.value;
  const rh = props.relativeHumidity && props.relativeHumidity.value;
  const wsMs = props.windSpeed && props.windSpeed.value;
  const wDir = props.windDirection && props.windDirection.value;
  const wgMs = props.windGust && props.windGust.value;
  const vis = props.visibility && props.visibility.value;
  const slp = props.seaLevelPressure && props.seaLevelPressure.value;

  const nwsClouds = [];
  if (props.cloudLayers && props.cloudLayers.length > 0) {
    const clNames = { CLR: "Clear", SKC: "Clear", FEW: "Few", SCT: "Scattered", BKN: "Broken", OVC: "Overcast", VV: "Vert Vis" };
    for (let ci = 0; ci < props.cloudLayers.length; ci++) {
      const cl = props.cloudLayers[ci];
      const amt = cl.amount || "";
      const base = cl.base && cl.base.value ? Math.round(cl.base.value * 3.28084) : null;
      const cName = clNames[amt] || amt;
      nwsClouds.push(base ? `${cName} @ ${base.toLocaleString()} ft` : cName);
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    observationTime: props.timestamp,
    source: "NOAA NWS (fallback)",
    station: {
      id: stationUrl.split("/").pop(),
      name: "NWS Station"
    },
    observations: {
      temperature: { value: round1(celsiusToFahrenheit(tempC)), unit: "F" },
      dewpoint: { value: round1(celsiusToFahrenheit(dewC)), unit: "F" },
      relativeHumidity: { value: round1(rh), unit: "%" },
      wind: {
        speed: { value: round1(msToMph(wsMs !== null ? wsMs : null)), unit: "mph" },
        direction: { value: round1(wDir), unit: "degrees" },
        cardinal: degToCompass(wDir),
        gust: { value: round1(msToMph(wgMs !== null ? wgMs : null)), unit: "mph" }
      },
      visibility: { value: vis !== null ? round1(vis / 1609.34) : null, unit: "miles" },
      pressure: {
        seaLevel: { value: slp !== null ? round1(slp / 100) : null, unit: "mb" },
        altimeter: { value: slp !== null ? round2(slp / 3386.39) : null, unit: "inHg" }
      },
      precipitation: { oneHour: { value: null, unit: "inches" } },
      clouds: nwsClouds
    },
    location: EVENT_CONFIG
  };

  cachePut("weather_current", result, CACHE_WEATHER);
  return result;
}

async function getGridpointForecast() {
  const cached = cacheGet("gridpoint_forecast");
  if (cached) return cached;

  try {
    const grid = await getNWSGridPoint_();
    const url = `https://api.weather.gov/gridpoints/${grid.gridId}/${grid.gridX},${grid.gridY}`;
    const data = await fetchJSON(url, { headers: { "Accept": "application/geo+json" } });
    const props = data.properties;

    const now = new Date();
    let startHour = new Date(now);
    startHour.setMinutes(0, 0, 0);
    if (startHour <= now) {
      startHour = new Date(startHour.getTime() + 3600000);
    }

    const hours = [];
    for (let i = 0; i < 24; i++) {
      hours.push(new Date(startHour.getTime() + i * 3600000).toISOString());
    }

    function expandToHourly(fieldData) {
      if (!fieldData || !fieldData.values) return {};
      const map = {};
      for (let i = 0; i < fieldData.values.length; i++) {
        const entry = fieldData.values[i];
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
    const dewMap = expandToHourly(props.dewpoint);
    const rhMap = expandToHourly(props.relativeHumidity);
    const wsMap = expandToHourly(props.windSpeed);
    const wdMap = expandToHourly(props.windDirection);
    const wgMap = expandToHourly(props.windGust);
    const popMap = expandToHourly(props.probabilityOfPrecipitation);
    const skyMap = expandToHourly(props.skyCover);
    const qpfMap = expandToHourly(props.quantitativePrecipitation);

    const series = [];
    for (let h = 0; h < hours.length; h++) {
      const iso = hours[h];
      const tempC = tempMap[iso];
      const dewC = dewMap[iso];
      const wsKmh = wsMap[iso];
      const wgKmh = wgMap[iso];

      series.push({
        time: iso,
        temperature: tempC !== undefined ? round1(celsiusToFahrenheit(tempC)) : null,
        dewpoint: dewC !== undefined ? round1(celsiusToFahrenheit(dewC)) : null,
        relativeHumidity: rhMap[iso] !== undefined ? Math.round(rhMap[iso]) : null,
        windSpeed: wsKmh !== undefined ? round1(wsKmh * 0.621371) : null,
        windDirection: wdMap[iso] !== undefined ? Math.round(wdMap[iso]) : null,
        windCardinal: degToCompass(wdMap[iso]),
        windGust: wgKmh !== undefined ? round1(wgKmh * 0.621371) : null,
        probabilityOfPrecipitation: popMap[iso] !== undefined ? Math.round(popMap[iso]) : null,
        skyCover: skyMap[iso] !== undefined ? Math.round(skyMap[iso]) : null,
        qpf: qpfMap[iso] !== undefined ? round2(qpfMap[iso] / 25.4) : null
      });
    }

    const result = {
      timestamp: new Date().toISOString(),
      source: `NWS Gridpoint Forecast (MTR ${grid.gridX},${grid.gridY})`,
      hours: series,
      adverseThresholds: EVENT_CONFIG.adverseConditions
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
  const dayMatch = dur.match(/(\d+)D/);
  const hourMatch = dur.match(/(\d+)H/);
  const minMatch = dur.match(/(\d+)M/);
  if (dayMatch) ms += parseInt(dayMatch[1], 10) * 86400000;
  if (hourMatch) ms += parseInt(hourMatch[1], 10) * 3600000;
  if (minMatch) ms += parseInt(minMatch[1], 10) * 60000;
  return ms || 3600000;
}

async function getRadarTimes() {
  const cached = cacheGet("radar_times");
  if (cached) return cached;

  try {
    const capsUrl = `${RADAR_WMS_URL}?service=wms&version=1.3.0&request=GetCapabilities`;
    const response = await fetch(capsUrl);
    if (!response.ok) {
      throw new Error(`WMS GetCapabilities HTTP ${response.status}`);
    }

    const xml = await response.text();
    const timeMatch = xml.match(/<Dimension[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i);
    if (!timeMatch || !timeMatch[1]) {
      throw new Error("No time dimension found in WMS capabilities");
    }

    const allTimes = timeMatch[1].split(",").map((t) => t.trim());
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    let times = allTimes.filter((t) => new Date(t) >= cutoff);
    if (times.length < 3 && allTimes.length > 0) {
      times = allTimes.slice(-15);
    }

    const result = {
      timestamp: new Date().toISOString(),
      source: "MRMS CONUS Base Reflectivity (QCD)",
      wmsUrl: RADAR_WMS_URL,
      layer: "conus_bref_qcd",
      style: "radar_reflectivity",
      times,
      totalAvailable: allTimes.length,
      timeCount: times.length
    };

    cachePut("radar_times", result, CACHE_RADAR);
    return result;
  } catch (err) {
    return { error: "Unable to fetch radar times", timestamp: new Date().toISOString(), times: [] };
  }
}

async function getSatelliteTimes(channel) {
  const selectedChannel = channel || "G18-ABI-CONUS-BAND02";
  const cacheKey = `satellite_times_${selectedChannel}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const url = `${SATELLITE_TIMES_URL}?products=${selectedChannel}`;
    const data = await fetchJSON(url);
    const allTimes = data[selectedChannel] || [];
    const cutoffMs = Date.now() - SATELLITE_LOOP_MINUTES * 60 * 1000;

    let times = allTimes.filter((t) => {
      const iso = t.substring(0,4) + "-" + t.substring(4,6) + "-" + t.substring(6,8) +
        "T" + t.substring(9,11) + ":" + t.substring(11,13) + ":" + t.substring(13,15) + "Z";
      return new Date(iso).getTime() >= cutoffMs;
    });

    if (times.length < 2 && allTimes.length > 0) {
      times = allTimes.slice(-6);
    }

    const result = {
      timestamp: new Date().toISOString(),
      source: "GOES-18 (SSEC RealEarth)",
      tileUrl: SATELLITE_TILE_URL,
      channel: selectedChannel,
      channelName: SATELLITE_CHANNELS[selectedChannel] || selectedChannel,
      times,
      totalAvailable: allTimes.length,
      timeCount: times.length
    };

    cachePut(cacheKey, result, CACHE_SATELLITE);
    return result;
  } catch (err) {
    return {
      error: `Unable to fetch satellite times: ${err.message}`,
      timestamp: new Date().toISOString(),
      times: [],
      channel: selectedChannel
    };
  }
}

async function getKeyPoints() {
  const cached = cacheGet("key_points");
  if (cached) return cached;

  try {
    const forecastData = await getGridpointForecast();
    if (forecastData.error || !forecastData.hours || forecastData.hours.length === 0) {
      return { error: "No forecast data available for key points", bullets: [], timestamp: new Date().toISOString() };
    }

    if (!OPENAI_API_KEY) {
      return { error: "OpenAI API key not configured", bullets: [], timestamp: new Date().toISOString() };
    }

    const hours = forecastData.hours;
    const lines = [];
    for (let i = 0; i < hours.length; i++) {
      const h = hours[i];
      const dt = new Date(h.time);
      const timeLabel = dt.toLocaleString("en-US", {
        weekday: "short", hour: "numeric", hour12: true, timeZone: "America/Los_Angeles"
      });
      lines.push(
        `${timeLabel}: ${h.temperature !== null ? h.temperature + "F" : "--"}, ` +
        `Wind ${h.windCardinal || ""} ${h.windSpeed !== null ? Math.round(h.windSpeed) : "--"} mph` +
        `${h.windGust ? " G" + Math.round(h.windGust) : ""}, ` +
        `PoP ${h.probabilityOfPrecipitation !== null ? h.probabilityOfPrecipitation : "--"}%, ` +
        `Sky ${h.skyCover !== null ? h.skyCover : "--"}%` +
        `${h.qpf > 0 ? `, QPF ${h.qpf.toFixed(2)}\"` : ""}`
      );
    }

    const forecastText = lines.join("\n");
    const systemPrompt = "You are a concise operational meteorologist briefing staff at a large outdoor sporting event. " +
      `The event is ${EVENT_CONFIG.name} at ${EVENT_CONFIG.location}. ` +
      `Kickoff is at ${EVENT_CONFIG.startDate} local time (Pacific). ` +
      "Given the NWS gridpoint forecast data below, produce exactly 4 short bullet points summarizing the key weather details " +
      "an event operations team needs to know at a glance for the next 24 hours. " +
      "Focus on: temperature trends, precipitation risk and timing, wind impacts, sky conditions, and any notable changes. " +
      "Be specific with numbers. Each bullet should be one short sentence. Do not use markdown formatting. " +
      "Return ONLY a JSON array of strings, e.g. [\"bullet 1\", \"bullet 2\", \"bullet 3\"].";

    const payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the hourly NWS gridpoint forecast for the next 24 hours:\n\n${forecastText}` }
      ],
      temperature: 0.3,
      max_tokens: 300
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API HTTP ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content.trim();

    let bullets;
    try {
      bullets = JSON.parse(content);
    } catch (parseErr) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        bullets = JSON.parse(jsonMatch[0]);
      } else {
        bullets = content.split("\n").filter((line) => line.trim().length > 0)
          .map((line) => line.replace(/^[\-\*\u2022]\s*/, "").trim());
      }
    }

    const result = {
      timestamp: new Date().toISOString(),
      bullets,
      model: aiData.model || "gpt-4o-mini"
    };

    cachePut("key_points", result, CACHE_KEYPOINTS);
    return result;
  } catch (err) {
    return { error: `Unable to generate key points: ${err.message}`, bullets: [], timestamp: new Date().toISOString() };
  }
}
