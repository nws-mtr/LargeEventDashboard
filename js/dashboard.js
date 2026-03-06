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

function showConfigModal(config) {
  document.getElementById("config-modal").style.display = "flex";
  document.getElementById("config-event-name").value = config?.name      || "";
  document.getElementById("config-latitude").value   = config?.latitude  || "";
  document.getElementById("config-longitude").value  = config?.longitude || "";
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
    this.activeRadarLayer = null;
    this.radarCounties    = null;
    this.venueMarkerRadar = null;
    this.venueCircleRadar = null;

    // Satellite map state
    this.satelliteMap     = null;
    this.activeSatLayer   = null;
    this.satLabelsLayer   = null;
    this.satCounties      = null;
    this.venueMarkerSat   = null;
    this.venueCircleSat   = null;
    this.satelliteChannel = "G18-ABI-CONUS-BAND02";

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

        // Choose GOES satellite based on longitude
        try {
          const prefix     = this.chooseSatellitePrefix(config.longitude);
          const bandSuffix = this.satelliteChannel.includes("-BAND")
            ? this.satelliteChannel.substring(this.satelliteChannel.indexOf("-BAND"))
            : "-BAND02";
          this.satelliteChannel = prefix + bandSuffix;

          document.querySelectorAll(".channel-btn").forEach((btn) => {
            const ch = btn.getAttribute("data-channel");
            if (ch) btn.setAttribute("data-channel", ch.replace(/G1[89]-ABI-CONUS/, prefix));
          });

          if (this.satelliteMap) this.loadLatestSatelliteFrame();
        } catch (e) {
          console.warn("Satellite selection error:", e);
        }
      })
      .catch((err) => console.error("Config error:", err));
  }

  updateEventInfo() {
    if (!this.config) return;
    document.getElementById("event-name").textContent     = this.config.name ? this.config.name + " Weather" : "Event Weather";
    document.getElementById("event-location").textContent = this.config.location || `${this.config.latitude}, ${this.config.longitude}`;
    document.getElementById("event-date").textContent     = new Date(this.config.startDate).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    document.getElementById("timezone").textContent = this.getTimezoneDisplayName(this.displayTimezone || this.config.timezone);
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
    const update = () => {
      document.getElementById("clock").textContent = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        timeZone: this.displayTimezone || "America/Los_Angeles"
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
    this.loadLatestRadarFrame();
  }

  setupSatelliteMap() {
    const venueLatLng = [37.403147, -121.969814];
    const { map, labelsLayer, countiesLayer } = initSatelliteMap("satellite-map", venueLatLng);
    this.satelliteMap   = map;
    this.satLabelsLayer = labelsLayer;
    this.satCounties    = countiesLayer;

    // Channel selector buttons
    document.querySelectorAll(".channel-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".channel-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.satelliteChannel = btn.getAttribute("data-channel");
        this.loadLatestSatelliteFrame();
      });
    });

    this.loadLatestSatelliteFrame();
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

  // ── Radar ──────────────────────────────────────────────────────────────────

  loadLatestRadarFrame() {
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
        this.showRadarFrame(times[times.length - 1]);
      })
      .catch(() => {
        document.getElementById("radar-timestamp-overlay").textContent = "Error loading";
      });
  }

  showRadarFrame(timeStr) {
    if (this.activeRadarLayer) this.radarMap.removeLayer(this.activeRadarLayer);

    this.activeRadarLayer = L.tileLayer.wms(
      "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?", {
        layers:      "conus_bref_qcd",
        format:      "image/png",
        transparent: true,
        version:     "1.3.0",
        crs:         L.CRS.EPSG3857,
        styles:      "radar_reflectivity",
        time:        timeStr,
        opacity:     0.7,
        attribution: "MRMS — NOAA/NCEP"
      }
    ).addTo(this.radarMap);

    if (this.radarCounties) this.radarCounties.bringToFront();
    document.getElementById("radar-timestamp-overlay").textContent = this.formatTimePST(timeStr);
  }

  // ── Satellite ──────────────────────────────────────────────────────────────

  loadLatestSatelliteFrame() {
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
        this.showSatelliteFrame(times[times.length - 1], data.channelName);
      })
      .catch(() => {
        document.getElementById("satellite-timestamp-overlay").textContent = "Error loading";
      });
  }

  showSatelliteFrame(timeStr, channelName) {
    if (this.activeSatLayer) this.satelliteMap.removeLayer(this.activeSatLayer);

    this.activeSatLayer = L.tileLayer(
      `https://realearth.ssec.wisc.edu/api/image?products=${this.satelliteChannel}.100&x={x}&y={y}&z={z}&time=${timeStr}`, {
        opacity:        0.85,
        maxZoom:        12,
        crossOrigin:    "anonymous",
        referrerPolicy: "no-referrer",
        attribution:    "GOES — SSEC RealEarth"
      }
    ).addTo(this.satelliteMap);

    if (this.satLabelsLayer) this.satLabelsLayer.bringToFront();
    if (this.satCounties)    this.satCounties.bringToFront();

    const chName = channelName || { "G18-ABI-CONUS-BAND02": "Visible", "G18-ABI-CONUS-BAND09": "Water Vapor", "G18-ABI-CONUS-BAND13": "Clean IR" }[this.satelliteChannel] || this.satelliteChannel;
    document.getElementById("satellite-timestamp-overlay").textContent = this.formatSsecTime(timeStr, chName);
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

  // ── Data Loading ───────────────────────────────────────────────────────────

  loadAllData() {
    this.loadCurrentWeather();
    this.loadHourlyForecast();
    this.loadKeyPoints();
    this.updateLastUpdateTime();
  }

  loadCurrentWeather() {
    getCurrentWeather()
      .then((data) => {
        if (data.error) { console.error("Weather error:", data.error); return; }
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
        }
        document.getElementById("feels-like").textContent    = feelsLike !== null ? Math.round(feelsLike) + "F" : "--";
        document.getElementById("dewpoint").textContent      = obs.dewpoint ? Math.round(obs.dewpoint.value) + "F" : "--";
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
      })
      .catch((err) => console.error("Weather fetch error:", err));
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
        buildTimelineChart("hourly-container", hours, data.adverseThresholds);
      })
      .catch((err) => {
        console.error("Gridpoint forecast fetch error:", err);
        document.getElementById("hourly-container").innerHTML = "<div class=\"error-msg\">Failed to load gridpoint forecast</div>";
      });
  }

  loadKeyPoints() {
    getKeyPoints()
      .then((data) => {
        const container = document.getElementById("keypoints-container");
        if (data.error) {
          container.innerHTML = `<div class="error-msg">${data.error}</div>`;
          return;
        }
        const bullets = data.bullets || [];
        if (bullets.length === 0) {
          container.innerHTML = "<div class=\"error-msg\">No key points available</div>";
          return;
        }
        container.innerHTML = "<ul class=\"keypoints-list\">" + bullets.map((b) => `<li class="keypoint-item">${b}</li>`).join("") + "</ul>";
      })
      .catch((err) => {
        console.error("Key points fetch error:", err);
        document.getElementById("keypoints-container").innerHTML = "<div class=\"error-msg\">Failed to load key points</div>";
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

  updateLastUpdateTime() {
    document.getElementById("last-update").textContent = new Date().toLocaleTimeString("en-US", {
      timeZone: this.displayTimezone || "America/Los_Angeles"
    });
  }

  startAutoRefresh() {
    // Full page reload every 30 minutes
    setTimeout(() => window.location.reload(), 30 * 60 * 1000);
    // Radar refresh every 2 minutes
    setInterval(() => this.loadLatestRadarFrame(), 2 * 60 * 1000);
    // Satellite refresh every 5 minutes
    setInterval(() => this.loadLatestSatelliteFrame(), 5 * 60 * 1000);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {
  const dashboard = new WeatherDashboard();

  const configBtn    = document.getElementById("config-btn");
  const configForm   = document.getElementById("config-form");
  const configCancel = document.getElementById("config-cancel-btn");

  configBtn.addEventListener("click", () => {
    const stored = getStoredConfig();
    showConfigModal(stored || dashboard.config || {});
  });

  configCancel.addEventListener("click", hideConfigModal);

  configForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const newConfig = {
      ...dashboard.config,
      name:      document.getElementById("config-event-name").value.trim(),
      latitude:  parseFloat(document.getElementById("config-latitude").value),
      longitude: parseFloat(document.getElementById("config-longitude").value)
    };
    setStoredConfig(newConfig);
    hideConfigModal();
    window.location.reload();
  });
});
