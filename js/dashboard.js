// ============================================================================
// js/dashboard.js — WeatherDashboard class + config modal
// ============================================================================

// ── Config Modal ─────────────────────────────────────────────────────────────

function getStoredConfig() {
  try { return JSON.parse(localStorage.getItem("dashboardConfig")); } catch { return null; }
}

function setStoredConfig(cfg) {
  localStorage.setItem("dashboardConfig", JSON.stringify(cfg));
}

function populateVariableSelects(selectedVars) {
  const ids = ["config-var-1", "config-var-2", "config-var-3"];
  ids.forEach((id, i) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = "";
    FORECAST_VARIABLES.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.key;
      opt.textContent = `${v.label} (${v.unit})`;
      if (v.key === selectedVars[i]) opt.selected = true;
      select.appendChild(opt);
    });
  });
}

function renderEventTimeRow(name, time) {
  const row = document.createElement("div");
  row.className = "event-time-row";
  row.innerHTML =
    `<input type="text" class="event-name-input" placeholder="Event name" value="${name || ""}">` +
    `<input type="datetime-local" class="event-time-input" value="${time || ""}">` +
    `<button type="button" class="remove-event-btn" title="Remove">&times;</button>`;
  row.querySelector(".remove-event-btn").addEventListener("click", () => row.remove());
  return row;
}

function populateEventTimes(eventTimes) {
  const list = document.getElementById("event-times-list");
  if (!list) return;
  list.innerHTML = "";
  (eventTimes || []).forEach((evt) => {
    list.appendChild(renderEventTimeRow(evt.name, evt.time));
  });
}

function readEventTimesFromForm() {
  const rows = document.querySelectorAll("#event-times-list .event-time-row");
  const events = [];
  rows.forEach((row) => {
    const name = row.querySelector(".event-name-input").value.trim();
    const time = row.querySelector(".event-time-input").value;
    if (name && time) events.push({ name, time });
  });
  return events;
}

function showConfigModal(config) {
  document.getElementById("config-modal").style.display = "flex";
  document.getElementById("config-event-name").value = config?.name      || "";
  document.getElementById("config-latitude").value   = config?.latitude  || "";
  document.getElementById("config-longitude").value  = config?.longitude || "";
  populateVariableSelects(config?.selectedVariables || DEFAULT_SELECTED_VARIABLES);
  populateEventTimes(config?.eventTimes || []);
}

function hideConfigModal() {
  document.getElementById("config-modal").style.display = "none";
}

// ── WeatherDashboard ─────────────────────────────────────────────────────────

class WeatherDashboard {
  constructor() {
    this.config          = null;
    this.displayTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

    // Radar map state
    this.radarMap         = null;
    this.radarCounties    = null;
    this.venueMarkerRadar = null;
    this.venueCircleRadar = null;
    // Radar animation
    this.radarFrames      = [];
    this.radarTimes       = [];
    this.radarFrameIndex  = 0;
    this.radarAnimInterval = null;
    this.radarAnimSpeed   = 500;
    this.radarDwellSpeed  = 1500; // dwell on last frame

    // Satellite map state
    this.satelliteMap     = null;
    this.satLabelsLayer   = null;
    this.satCounties      = null;
    this.venueMarkerSat   = null;
    this.venueCircleSat   = null;
    this.satelliteChannel = "G18-ABI-CONUS-BAND02";
    // Satellite animation
    this.satFrames        = [];
    this.satTimes         = [];
    this.satFrameIndex    = 0;
    this.satAnimInterval  = null;
    this.satAnimSpeed     = 500;
    this.satDwellSpeed    = 1500; // dwell on last frame

    this.init();
  }

  init() {
    this.loadConfig();
    this.setupClock();
    this.setupRadarMap();
    this.setupSatelliteMap();
    this.loadAllData();
    this.startAutoRefresh();
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  loadConfig() {
    getConfig()
      .then((config) => {
        this.config = config;
        this.updateEventInfo();

        if (typeof config.latitude === "number" && typeof config.longitude === "number") {
          this.applyVenueLocation(config.latitude, config.longitude);
        }

        // Derive display timezone
        try {
          const stored = getStoredConfig();
          this.displayTimezone = (stored && stored.timezone)
            ? stored.timezone
            : this.chooseTimezone(config.longitude);
          const tzEl = document.getElementById("timezone");
          if (tzEl) tzEl.textContent = this.getTimezoneDisplayName(this.displayTimezone || config.timezone);
        } catch {}

        // Choose GOES satellite based on longitude, then auto VIS/IR
        try {
          const prefix = this.chooseSatellitePrefix(config.longitude);
          const band   = this.chooseSatelliteBand(config.longitude);
          this.satelliteChannel = prefix + "-" + band;
          if (this.satelliteMap) this.loadSatelliteLoop();
        } catch (e) {
          console.warn("Satellite selection error:", e);
        }
      })
      .catch((err) => console.error("Config error:", err));
  }

  updateEventInfo() {
    if (!this.config) return;
    document.getElementById("event-name").textContent = this.config.name ? this.config.name + " Weather" : "Event Weather";
    document.getElementById("timezone").textContent   = this.getTimezoneDisplayName(this.displayTimezone || this.config.timezone);
  }

  chooseTimezone(longitude) {
    if (typeof longitude !== "number" || isNaN(longitude)) return "America/Los_Angeles";
    if (longitude >= -87.5)  return "America/New_York";
    if (longitude >= -101.5) return "America/Chicago";
    if (longitude >= -115)   return "America/Denver";
    return "America/Los_Angeles";
  }

  chooseSatellitePrefix(longitude) {
    if (typeof longitude !== "number" || isNaN(longitude)) return "G18-ABI-CONUS";
    return (longitude >= -105) ? "G19-ABI-CONUS" : "G18-ABI-CONUS";
  }

  chooseSatelliteBand(longitude) {
    // Auto VIS/IR: use venue local hour to decide
    const tz = this.chooseTimezone(longitude);
    const hour = parseInt(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: tz }), 10);
    return (hour >= 7 && hour < 18) ? "BAND02" : "BAND13";
  }

  getTimezoneDisplayName(tz) {
    if (!tz) return "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date());
      const short = parts.find((p) => p.type === "timeZoneName");
      if (short && !/GMT|UTC/.test(short.value)) return short.value;
    } catch {}
    const mapping = {
      "America/Los_Angeles": "PST",
      "America/Denver":      "MST",
      "America/Chicago":     "CST",
      "America/New_York":    "EST"
    };
    return mapping[tz] || tz;
  }

  // ── Clock ──────────────────────────────────────────────────────────────────

  setupClock() {
    const tz = () => this.displayTimezone || "America/Los_Angeles";
    const update = () => {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        timeZone: tz()
      });
      document.getElementById("current-date").textContent = now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        timeZone: tz()
      });
    };
    update();
    setInterval(update, 1000);
  }

  // ── Maps ───────────────────────────────────────────────────────────────────

  setupRadarMap() {
    const venueLatLng = [37.403147, -121.969814];
    const { map, countiesLayer } = initRadarMap("radar-map", venueLatLng);
    this.radarMap      = map;
    this.radarCounties = countiesLayer;
    this.loadRadarLoop();
  }

  setupSatelliteMap() {
    const venueLatLng = [37.403147, -121.969814];
    const { map, labelsLayer, countiesLayer } = initSatelliteMap("satellite-map", venueLatLng);
    this.satelliteMap   = map;
    this.satLabelsLayer = labelsLayer;
    this.satCounties    = countiesLayer;
    this.loadSatelliteLoop();
  }

  applyVenueLocation(lat, lon) {
    const latlng    = [lat, lon];
    const venueIcon = L.divIcon({ className: "venue-marker", iconSize: [12, 12], iconAnchor: [6, 6] });

    if (this.radarMap) {
      if (this.venueMarkerRadar) this.venueMarkerRadar.setLatLng(latlng);
      else this.venueMarkerRadar = L.marker(latlng, { icon: venueIcon, zIndex: 1000 }).addTo(this.radarMap);

      if (this.venueCircleRadar) this.venueCircleRadar.setLatLng(latlng);
      else this.venueCircleRadar = L.circle(latlng, { radius: 18520, color: "rgba(255,255,255,0.4)", weight: 1, dashArray: "6,4", fill: false }).addTo(this.radarMap);

      try { this.radarMap.setView(latlng, this.radarMap.getZoom()); } catch {}
    }

    if (this.satelliteMap) {
      if (this.venueMarkerSat) this.venueMarkerSat.setLatLng(latlng);
      else this.venueMarkerSat = L.marker(latlng, { icon: venueIcon, zIndex: 1000 }).addTo(this.satelliteMap);

      if (this.venueCircleSat) this.venueCircleSat.setLatLng(latlng);
      else this.venueCircleSat = L.circle(latlng, { radius: 92600, color: "rgba(255,255,255,0.25)", weight: 1, dashArray: "6,4", fill: false }).addTo(this.satelliteMap);

      try { this.satelliteMap.setView(latlng, this.satelliteMap.getZoom()); } catch {}
    }
  }

  // ── Radar Animation ────────────────────────────────────────────────────────

  loadRadarLoop() {
    getRadarTimes()
      .then((data) => {
        if (data.error) {
          document.getElementById("radar-timestamp-overlay").textContent = "Error loading";
          return;
        }
        const times = data.times || [];
        if (times.length === 0) {
          document.getElementById("radar-timestamp-overlay").textContent = "No data";
          return;
        }

        // Stop existing animation and remove old layers
        this.stopRadarAnimation();
        this.radarFrames.forEach((layer) => this.radarMap.removeLayer(layer));
        this.radarFrames = [];
        this.radarTimes  = times;
        this.radarFrameIndex = 0;

        // Pre-create all frame layers with opacity 0
        times.forEach((timeStr) => {
          const layer = L.tileLayer.wms(
            "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?", {
              layers:      "conus_bref_qcd",
              format:      "image/png",
              transparent: true,
              version:     "1.3.0",
              crs:         L.CRS.EPSG3857,
              styles:      "radar_reflectivity",
              time:        timeStr,
              opacity:     0,
              attribution: "MRMS — NOAA/NCEP"
            }
          ).addTo(this.radarMap);
          this.radarFrames.push(layer);
        });

        // Show first frame
        if (this.radarFrames.length > 0) {
          this.radarFrames[0].setOpacity(0.7);
          if (this.radarCounties) this.radarCounties.bringToFront();
          document.getElementById("radar-timestamp-overlay").textContent = this.formatTimePST(times[0]);
        }

        // Start animation loop
        if (this.radarFrames.length > 1) {
          this.scheduleRadarAdvance();
        }
      })
      .catch(() => {
        document.getElementById("radar-timestamp-overlay").textContent = "Error loading";
      });
  }

  scheduleRadarAdvance() {
    // Dwell longer on the last frame before looping
    const isLastFrame = this.radarFrameIndex === this.radarFrames.length - 1;
    const delay = isLastFrame ? this.radarDwellSpeed : this.radarAnimSpeed;
    this.radarAnimInterval = setTimeout(() => {
      this.advanceRadarFrame();
      this.scheduleRadarAdvance();
    }, delay);
  }

  advanceRadarFrame() {
    if (this.radarFrames.length === 0) return;
    this.radarFrames[this.radarFrameIndex].setOpacity(0);
    this.radarFrameIndex = (this.radarFrameIndex + 1) % this.radarFrames.length;
    this.radarFrames[this.radarFrameIndex].setOpacity(0.7);
    if (this.radarCounties) this.radarCounties.bringToFront();
    document.getElementById("radar-timestamp-overlay").textContent =
      this.formatTimePST(this.radarTimes[this.radarFrameIndex]);
  }

  stopRadarAnimation() {
    if (this.radarAnimInterval) {
      clearTimeout(this.radarAnimInterval);
      this.radarAnimInterval = null;
    }
  }

  // ── Satellite Animation ────────────────────────────────────────────────────

  loadSatelliteLoop() {
    // Auto-select VIS/IR before fetching
    if (this.config && typeof this.config.longitude === "number") {
      const prefix = this.chooseSatellitePrefix(this.config.longitude);
      const band   = this.chooseSatelliteBand(this.config.longitude);
      this.satelliteChannel = prefix + "-" + band;
    }

    getSatelliteTimes(this.satelliteChannel)
      .then((data) => {
        if (data.error) {
          document.getElementById("satellite-timestamp-overlay").textContent = "Error loading";
          return;
        }
        const times = data.times || [];
        if (times.length === 0) {
          document.getElementById("satellite-timestamp-overlay").textContent = "No data";
          return;
        }

        // Stop existing animation and remove old layers
        this.stopSatelliteAnimation();
        this.satFrames.forEach((layer) => this.satelliteMap.removeLayer(layer));
        this.satFrames = [];
        this.satTimes  = times;
        this.satFrameIndex = 0;

        const channelName = data.channelName || this.satelliteChannel;

        // Pre-create all frame layers with opacity 0
        times.forEach((timeStr) => {
          const layer = L.tileLayer(
            `https://realearth.ssec.wisc.edu/api/image?products=${this.satelliteChannel}.100&x={x}&y={y}&z={z}&time=${timeStr}`, {
              opacity:        0,
              maxZoom:        12,
              crossOrigin:    "anonymous",
              referrerPolicy: "no-referrer",
              attribution:    "GOES — SSEC RealEarth"
            }
          ).addTo(this.satelliteMap);
          this.satFrames.push(layer);
        });

        // Show first frame
        if (this.satFrames.length > 0) {
          this.satFrames[0].setOpacity(0.85);
          if (this.satLabelsLayer) this.satLabelsLayer.bringToFront();
          if (this.satCounties) this.satCounties.bringToFront();
          document.getElementById("satellite-timestamp-overlay").textContent =
            this.formatSsecTime(times[0]) + " " + channelName;
        }

        this._satChannelName = channelName;

        // Start animation loop
        if (this.satFrames.length > 1) {
          this.scheduleSatelliteAdvance();
        }
      })
      .catch(() => {
        document.getElementById("satellite-timestamp-overlay").textContent = "Error loading";
      });
  }

  scheduleSatelliteAdvance() {
    const isLastFrame = this.satFrameIndex === this.satFrames.length - 1;
    const delay = isLastFrame ? this.satDwellSpeed : this.satAnimSpeed;
    this.satAnimInterval = setTimeout(() => {
      this.advanceSatelliteFrame();
      this.scheduleSatelliteAdvance();
    }, delay);
  }

  advanceSatelliteFrame() {
    if (this.satFrames.length === 0) return;
    this.satFrames[this.satFrameIndex].setOpacity(0);
    this.satFrameIndex = (this.satFrameIndex + 1) % this.satFrames.length;
    this.satFrames[this.satFrameIndex].setOpacity(0.85);
    if (this.satLabelsLayer) this.satLabelsLayer.bringToFront();
    if (this.satCounties) this.satCounties.bringToFront();
    document.getElementById("satellite-timestamp-overlay").textContent =
      this.formatSsecTime(this.satTimes[this.satFrameIndex]) + " " + (this._satChannelName || "");
  }

  stopSatelliteAnimation() {
    if (this.satAnimInterval) {
      clearTimeout(this.satAnimInterval);
      this.satAnimInterval = null;
    }
  }

  // ── Data Loading ───────────────────────────────────────────────────────────

  loadAllData() {
    // Load weather first, then use same station for wind rose
    this.loadCurrentWeather().then((stationId) => {
      this.loadWindRose(stationId);
    });
    this.loadHourlyForecast();
    this.updateLastUpdateTime();
  }

  loadCurrentWeather() {
    return getCurrentWeather()
      .then((data) => {
        if (data.error) { console.error("Weather error:", data.error); return null; }
        const obs  = data.observations;
        const temp = obs.temperature ? obs.temperature.value : null;
        document.getElementById("current-temp").textContent = temp !== null ? Math.round(temp) : "--";

        if (data.observationTime) {
          document.getElementById("obs-time").textContent = "Obs: " + new Date(data.observationTime).toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true,
            timeZone: this.displayTimezone || "America/Los_Angeles"
          });
        }

        if (data.station) {
          let stLabel = data.station.id || "";
          if (data.station.name)     stLabel += " — " + data.station.name;
          if (data.station.distance) stLabel += " (" + data.station.distance.toFixed(1) + " mi)";
          document.getElementById("obs-station").textContent = stLabel;
        }

        const windSpeed = obs.wind && obs.wind.speed ? obs.wind.speed.value : 0;
        let feelsLike = temp;
        if (temp !== null && windSpeed > 3 && temp < 50) {
          feelsLike = 35.74 + (0.6215 * temp) - (35.75 * Math.pow(windSpeed, 0.16))
                    + (0.4275 * temp * Math.pow(windSpeed, 0.16));
        } else if (temp !== null && temp > 80) {
          // Simple heat index approximation
          const rh = obs.relativeHumidity ? obs.relativeHumidity.value : 50;
          feelsLike = -42.379 + 2.04901523 * temp + 10.14333127 * rh
                    - 0.22475541 * temp * rh - 0.00683783 * temp * temp
                    - 0.05481717 * rh * rh + 0.00122874 * temp * temp * rh
                    + 0.00085282 * temp * rh * rh - 0.00000199 * temp * temp * rh * rh;
        }
        const feelsLabel = temp !== null && temp > 80 ? "Heat Idx" : (temp !== null && temp < 50 ? "Wind Chill" : "Feels Like");
        const feelsEl = document.getElementById("feels-like");
        feelsEl.textContent = feelsLike !== null ? Math.round(feelsLike) + "\u00B0F" : "--";
        // Update the label text
        const labelEl = feelsEl.closest(".detail-item")?.querySelector(".label");
        if (labelEl) labelEl.textContent = feelsLabel;

        document.getElementById("dewpoint").textContent      = obs.dewpoint ? Math.round(obs.dewpoint.value) + "\u00B0F" : "--";
        document.getElementById("humidity").textContent      = obs.relativeHumidity ? Math.round(obs.relativeHumidity.value) + "%" : "--";
        document.getElementById("wind").textContent          = obs.wind && obs.wind.speed ? `${obs.wind.cardinal} ${Math.round(obs.wind.speed.value)} mph` : "--";
        document.getElementById("wind-dir").textContent      = (obs.wind && obs.wind.cardinal) || "--";
        document.getElementById("wind-gust").textContent     = (obs.wind && obs.wind.gust && obs.wind.gust.value > 0) ? Math.round(obs.wind.gust.value) + " mph" : "None";
        document.getElementById("precip-1hr").textContent    = (obs.precipitation && obs.precipitation.oneHour && obs.precipitation.oneHour.value > 0)
          ? obs.precipitation.oneHour.value.toFixed(2) + "\""
          : "0.00\"";

        if (data.source && data.station) {
          const footerEl = document.querySelector(".data-sources");
          if (footerEl) footerEl.textContent = `Data: ${data.source} (${data.station.id}) / NOAA NWS / SSEC RealEarth`;
        }

        return data.station ? data.station.id : null;
      })
      .catch((err) => { console.error("Weather fetch error:", err); return null; });
  }

  loadHourlyForecast() {
    getGridpointForecast()
      .then((data) => {
        if (data.error) {
          document.getElementById("hourly-container").innerHTML = `<div class="error-msg">${data.error}</div>`;
          return;
        }
        const hours = data.hours || [];
        if (hours.length === 0) {
          document.getElementById("hourly-container").innerHTML = "<div class=\"error-msg\">No gridpoint data available</div>";
          return;
        }
        const selectedVars = (this.config && this.config.selectedVariables) || DEFAULT_SELECTED_VARIABLES;
        const eventTimes   = (this.config && this.config.eventTimes) || [];
        buildTimelineChart("hourly-container", hours, selectedVars, eventTimes, this.displayTimezone);
      })
      .catch((err) => {
        console.error("Gridpoint forecast fetch error:", err);
        document.getElementById("hourly-container").innerHTML = "<div class=\"error-msg\">Failed to load gridpoint forecast</div>";
      });
  }

  loadWindRose(stationId) {
    getWindRoseData(stationId)
      .then((data) => {
        const container = document.getElementById("windrose-container");
        if (data.error) {
          container.innerHTML = `<div class="error-msg">${data.error}</div>`;
          return;
        }
        if (data.totalObs === 0) {
          container.innerHTML = "<div class=\"error-msg\">No wind observations in last 2 hours</div>";
          return;
        }
        renderWindRose("windrose-container", data);
      })
      .catch((err) => {
        console.error("Wind rose fetch error:", err);
        document.getElementById("windrose-container").innerHTML = "<div class=\"error-msg\">Failed to load wind data</div>";
      });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  formatTimePST(isoStr) {
    try {
      return new Date(isoStr).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: this.displayTimezone || "America/Los_Angeles"
      });
    } catch { return isoStr; }
  }

  formatSsecTime(ssecStr) {
    try {
      const iso = `${ssecStr.substring(0,4)}-${ssecStr.substring(4,6)}-${ssecStr.substring(6,8)}T${ssecStr.substring(9,11)}:${ssecStr.substring(11,13)}:${ssecStr.substring(13,15)}Z`;
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: this.displayTimezone || "America/Los_Angeles"
      });
    } catch { return ssecStr; }
  }

  updateLastUpdateTime() {
    document.getElementById("last-update").textContent = new Date().toLocaleTimeString("en-US", {
      timeZone: this.displayTimezone || "America/Los_Angeles"
    });
  }

  startAutoRefresh() {
    // Radar refresh every 5 minutes
    setInterval(() => this.loadRadarLoop(), 5 * 60 * 1000);
    // Satellite refresh every 10 minutes
    setInterval(() => this.loadSatelliteLoop(), 10 * 60 * 1000);
    // Data refresh every 30 minutes (weather, forecast, wind rose)
    setInterval(() => this.loadAllData(), 30 * 60 * 1000);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  const dashboard = new WeatherDashboard();

  const configBtn    = document.getElementById("config-btn");
  const configForm   = document.getElementById("config-form");
  const configCancel = document.getElementById("config-cancel-btn");
  const addEventBtn  = document.getElementById("add-event-btn");

  configBtn.addEventListener("click", () => {
    const stored = getStoredConfig();
    showConfigModal(stored || dashboard.config || {});
  });

  configCancel.addEventListener("click", hideConfigModal);

  addEventBtn.addEventListener("click", () => {
    const list = document.getElementById("event-times-list");
    list.appendChild(renderEventTimeRow("", ""));
  });

  configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newConfig = {
      ...dashboard.config,
      name:              document.getElementById("config-event-name").value.trim(),
      latitude:          parseFloat(document.getElementById("config-latitude").value),
      longitude:         parseFloat(document.getElementById("config-longitude").value),
      selectedVariables: [
        document.getElementById("config-var-1").value,
        document.getElementById("config-var-2").value,
        document.getElementById("config-var-3").value
      ],
      eventTimes:        readEventTimesFromForm()
    };
    setStoredConfig(newConfig);
    hideConfigModal();
    window.location.reload();
  });
});
