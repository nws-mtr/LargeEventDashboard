// ============================================================================
// app.js — Client-side Dashboard Logic (local dev)
// ============================================================================

class WeatherDashboard {
  constructor() {
    this.config = null;
    this.radarMap = null;
    this.activeRadarLayer = null;
    this.radarCounties = null;

    this.satelliteMap = null;
    this.activeSatLayer = null;
    this.satLabelsLayer = null;
    this.satCounties = null;
    this.satelliteChannel = "G18-ABI-CONUS-BAND02";
    this.init();
  }

  init() {
    this.loadConfig();
    this.setupClock();
    this.initRadarMap();
    this.initSatelliteMap();
    this.loadAllData();
    this.startAutoRefresh();
  }

  loadConfig() {
    getConfig()
      .then((config) => {
        this.config = config;
        this.updateEventInfo();
      })
      .catch((err) => {
        console.error("Config error:", err);
      });
  }

  updateEventInfo() {
    if (!this.config) return;
    document.getElementById("event-location").textContent = this.config.location;

    const startDate = new Date(this.config.startDate);
    document.getElementById("event-date").textContent = startDate.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    document.getElementById("timezone").textContent = this.config.timezone;
  }

  setupClock() {
    const updateClock = function() {
      const now = new Date();
      document.getElementById("clock").textContent = now.toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        timeZone: "America/Los_Angeles"
      });
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  loadAllData() {
    this.loadCurrentWeather();
    this.loadHourlyForecast();
    this.loadKeyPoints();
    this.loadLatestRadarFrame();
    this.loadLatestSatelliteFrame();
    this.updateLastUpdateTime();
  }

  initRadarMap() {
    const venueLatLng = [37.403147, -121.969814];

    this.radarMap = L.map("radar-map", {
      center: venueLatLng,
      zoom: 9,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; <a href=\"https://carto.com/\">CARTO</a>",
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(this.radarMap);

    const venueIcon = L.divIcon({
      className: "venue-marker",
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker(venueLatLng, { icon: venueIcon, zIndex: 1000 })
      .addTo(this.radarMap)
      .bindPopup("<b>Levi's Stadium</b><br>Super Bowl LX");

    L.circle(venueLatLng, {
      radius: 18520,
      color: "rgba(255,255,255,0.4)",
      weight: 1,
      dashArray: "6,4",
      fill: false
    }).addTo(this.radarMap);

    this.radarCounties = L.tileLayer.wms("https://tigerweb.geo.census.gov/arcgis/services/TIGERweb/tigerWMS_Current/MapServer/WMSServer", {
      layers: "84",
      format: "image/png",
      transparent: true,
      styles: "",
      attribution: "US Census Bureau",
      pane: "overlayPane",
      opacity: 1
    }).addTo(this.radarMap);

    const radarTimestamp = L.DomUtil.create("div", "map-timestamp-overlay");
    radarTimestamp.id = "radar-timestamp-overlay";
    radarTimestamp.textContent = "Loading...";
    document.getElementById("radar-map").appendChild(radarTimestamp);

    this.loadLatestRadarFrame();
  }

  loadLatestRadarFrame() {
    getRadarTimes()
      .then((data) => {
        if (data.error) {
          console.error("Radar times error:", data.error);
          document.getElementById("radar-timestamp-overlay").textContent = "Error loading";
          return;
        }
        const times = data.times || [];
        if (times.length === 0) {
          document.getElementById("radar-timestamp-overlay").textContent = "No data";
          return;
        }

        const latestTime = times[times.length - 1];
        this.showRadarFrame(latestTime);
      })
      .catch((err) => {
        console.error("Radar times fetch error:", err);
        document.getElementById("radar-timestamp-overlay").textContent = "Error loading";
      });
  }

  showRadarFrame(timeStr) {
    if (this.activeRadarLayer) {
      this.radarMap.removeLayer(this.activeRadarLayer);
    }

    this.activeRadarLayer = L.tileLayer.wms(
      "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?", {
        layers: "conus_bref_qcd",
        format: "image/png",
        transparent: true,
        version: "1.3.0",
        crs: L.CRS.EPSG3857,
        styles: "radar_reflectivity",
        time: timeStr,
        opacity: 0.7,
        attribution: "MRMS — NOAA/NCEP"
      }
    );

    this.activeRadarLayer.addTo(this.radarMap);

    if (this.radarCounties) {
      this.radarCounties.bringToFront();
    }

    document.getElementById("radar-timestamp-overlay").textContent =
      this.formatTimePST(timeStr);
  }

  initSatelliteMap() {
    const venueLatLng = [37.403147, -121.969814];

    this.satelliteMap = L.map("satellite-map", {
      center: venueLatLng,
      zoom: 7,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; <a href=\"https://carto.com/\">CARTO</a>",
      subdomains: "abcd",
      maxZoom: 12
    }).addTo(this.satelliteMap);

    const venueIcon = L.divIcon({
      className: "venue-marker",
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    L.marker(venueLatLng, { icon: venueIcon, zIndex: 1000 })
      .addTo(this.satelliteMap)
      .bindPopup("<b>Levi's Stadium</b><br>Super Bowl LX");

    L.circle(venueLatLng, {
      radius: 92600,
      color: "rgba(255,255,255,0.25)",
      weight: 1,
      dashArray: "6,4",
      fill: false
    }).addTo(this.satelliteMap);

    this.satLabelsLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 12,
        pane: "overlayPane"
      }
    ).addTo(this.satelliteMap);

    this.satCounties = L.tileLayer.wms("https://tigerweb.geo.census.gov/arcgis/services/TIGERweb/tigerWMS_Current/MapServer/WMSServer", {
      layers: "84",
      format: "image/png",
      transparent: true,
      styles: "",
      attribution: "US Census Bureau",
      pane: "overlayPane",
      opacity: 1
    }).addTo(this.satelliteMap);

    const satTimestamp = L.DomUtil.create("div", "map-timestamp-overlay");
    satTimestamp.id = "satellite-timestamp-overlay";
    satTimestamp.textContent = "Loading...";
    document.getElementById("satellite-map").appendChild(satTimestamp);

    const channelBtns = document.querySelectorAll(".channel-btn");
    const self = this;
    channelBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        channelBtns.forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        self.satelliteChannel = btn.getAttribute("data-channel");
        self.loadLatestSatelliteFrame();
      });
    });

    this.loadLatestSatelliteFrame();
  }

  loadLatestSatelliteFrame() {
    getSatelliteTimes(this.satelliteChannel)
      .then((data) => {
        if (data.error) {
          console.error("Satellite times error:", data.error);
          document.getElementById("satellite-timestamp-overlay").textContent = "Error loading";
          return;
        }
        const times = data.times || [];
        if (times.length === 0) {
          document.getElementById("satellite-timestamp-overlay").textContent = "No data";
          return;
        }

        const latestTime = times[times.length - 1];
        this.showSatelliteFrame(latestTime, data.channelName);
      })
      .catch((err) => {
        console.error("Satellite times fetch error:", err);
        document.getElementById("satellite-timestamp-overlay").textContent = "Error loading";
      });
  }

  showSatelliteFrame(timeStr, channelName) {
    if (this.activeSatLayer) {
      this.satelliteMap.removeLayer(this.activeSatLayer);
    }

    this.activeSatLayer = L.tileLayer(
      "https://realearth.ssec.wisc.edu/api/image?products=" +
        this.satelliteChannel + ".100&x={x}&y={y}&z={z}&time=" + timeStr, {
        opacity: 0.85,
        maxZoom: 12,
        crossOrigin: "anonymous",
        referrerPolicy: "no-referrer",
        attribution: "GOES-18 — SSEC RealEarth"
      }
    );

    this.activeSatLayer.addTo(this.satelliteMap);

    if (this.satLabelsLayer) {
      this.satLabelsLayer.bringToFront();
    }

    if (this.satCounties) {
      this.satCounties.bringToFront();
    }

    const channelNames = {
      "G18-ABI-CONUS-BAND02": "Visible",
      "G18-ABI-CONUS-BAND09": "Water Vapor",
      "G18-ABI-CONUS-BAND13": "Clean IR"
    };
    const chName = channelName || channelNames[this.satelliteChannel] || this.satelliteChannel;
    document.getElementById("satellite-timestamp-overlay").textContent =
      this.formatSsecTime(timeStr, chName);
  }

  formatSsecTime(ssecStr) {
    try {
      const iso = ssecStr.substring(0,4) + "-" + ssecStr.substring(4,6) + "-" +
                ssecStr.substring(6,8) + "T" + ssecStr.substring(9,11) + ":" +
                ssecStr.substring(11,13) + ":" + ssecStr.substring(13,15) + "Z";
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: "America/Los_Angeles"
      });
    } catch (e) {
      return ssecStr;
    }
  }

  loadCurrentWeather() {
    getCurrentWeather()
      .then((data) => {
        if (data.error) { console.error("Weather error:", data.error); return; }

        const obs = data.observations;
        const temp = obs.temperature ? obs.temperature.value : null;
        document.getElementById("current-temp").textContent = temp !== null ? Math.round(temp) : "--";

        if (data.observationTime) {
          const obsDate = new Date(data.observationTime);
          document.getElementById("obs-time").textContent = "Obs: " + obsDate.toLocaleTimeString("en-US", {
            hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles"
          });
        }

        if (data.station) {
          let stLabel = data.station.id || "";
          if (data.station.name) stLabel += " — " + data.station.name;
          if (data.station.distance) stLabel += " (" + data.station.distance.toFixed(1) + " mi)";
          document.getElementById("obs-station").textContent = stLabel;
        }

        const windSpeed = (obs.wind && obs.wind.speed) ? obs.wind.speed.value : 0;
        let feelsLike = temp;
        if (temp !== null && windSpeed > 3 && temp < 50) {
          feelsLike = 35.74 + (0.6215 * temp) - (35.75 * Math.pow(windSpeed, 0.16))
                    + (0.4275 * temp * Math.pow(windSpeed, 0.16));
        }
        document.getElementById("feels-like").textContent =
          feelsLike !== null ? Math.round(feelsLike) + "F" : "--";

        const dp = obs.dewpoint ? obs.dewpoint.value : null;
        document.getElementById("dewpoint").textContent = dp !== null ? Math.round(dp) + "F" : "--";

        const rh = obs.relativeHumidity ? obs.relativeHumidity.value : null;
        document.getElementById("humidity").textContent = rh !== null ? Math.round(rh) + "%" : "--";

        const cardinal = obs.wind ? obs.wind.cardinal : "";
        const ws = obs.wind && obs.wind.speed ? obs.wind.speed.value : null;
        document.getElementById("wind").textContent =
          ws !== null ? cardinal + " " + Math.round(ws) + " mph" : "--";

        document.getElementById("wind-dir").textContent = cardinal || "--";

        const gust = obs.wind && obs.wind.gust ? obs.wind.gust.value : null;
        document.getElementById("wind-gust").textContent =
          (gust !== null && gust > 0) ? Math.round(gust) + " mph" : "None";

        const precip = obs.precipitation && obs.precipitation.oneHour ? obs.precipitation.oneHour.value : null;
        document.getElementById("precip-1hr").textContent =
          (precip !== null && precip > 0) ? precip.toFixed(2) + "\"" : "0.00\"";

        if (data.source && data.station) {
          document.querySelector(".data-sources").textContent =
            "Data: " + data.source + " (" + data.station.id + ") / NOAA NWS / SSEC RealEarth GOES-18";
        }
      })
      .catch((err) => {
        console.error("Weather fetch error:", err);
      });
  }

  loadHourlyForecast() {
    getGridpointForecast()
      .then((data) => {
        if (data.error) {
          console.error("Gridpoint forecast error:", data.error);
          document.getElementById("hourly-container").innerHTML =
            "<div class=\"error-msg\">" + data.error + "</div>";
          return;
        }

        const hours = data.hours || [];
        if (hours.length === 0) {
          document.getElementById("hourly-container").innerHTML =
            "<div class=\"error-msg\">No gridpoint data available</div>";
          return;
        }

        this.buildTimelineChart(hours, data.adverseThresholds);
      })
      .catch((err) => {
        console.error("Gridpoint forecast fetch error:", err);
        document.getElementById("hourly-container").innerHTML =
          "<div class=\"error-msg\">Failed to load gridpoint forecast</div>";
      });
  }

  buildTimelineChart(hours, thresholds) {
    const container = document.getElementById("hourly-container");

    const maxTempThresh = (thresholds && thresholds.maxTemp) || 80;
    const minRainThresh = (thresholds && thresholds.minRainChance) || 15;
    const minSkyThresh = (thresholds && thresholds.minSkyCover) || 50;

    const temps = hours.map(function(h) { return h.temperature; });
    const rains = hours.map(function(h) { return h.probabilityOfPrecipitation; });
    const skies = hours.map(function(h) { return h.skyCover; });

    const labels = hours.map(function(h, i) {
      const dt = new Date(h.time);
      const hr = dt.toLocaleTimeString("en-US", {
        hour: "numeric", hour12: true, timeZone: "America/Los_Angeles"
      });
      if (i % 3 === 0) {
        const day = dt.toLocaleDateString("en-US", {
          weekday: "short", timeZone: "America/Los_Angeles"
        });
        return hr + "|" + day;
      }
      return null;
    });

    let html = "<div class=\"timeline-chart\">";
    html += "<div class=\"timeline-rows\">";

    html += "<div class=\"timeline-row\">" +
      "<div class=\"row-header\">Temperature (F)</div>" +
      "<div class=\"row-graph\" id=\"graph-temp\"></div></div>";

    html += "<div class=\"timeline-row\">" +
      "<div class=\"row-header\">Rain Chance (%)</div>" +
      "<div class=\"row-graph\" id=\"graph-rain\"></div></div>";

    html += "<div class=\"timeline-row\">" +
      "<div class=\"row-header\">Cloud Cover (%)</div>" +
      "<div class=\"row-graph\" id=\"graph-sky\"></div></div>";

    html += "</div></div>";

    container.innerHTML = html;

    const self = this;
    requestAnimationFrame(function() {
      self.renderLineGraph("graph-temp", temps, labels, "#2196f3", "temp", maxTempThresh, "above", hours);
      self.renderLineGraph("graph-rain", rains, labels, "#4caf50", "pct", minRainThresh, "above", hours);
      self.renderLineGraph("graph-sky", skies, labels, "#9e9e9e", "pct", minSkyThresh, "above", hours);
    });
  }

  renderLineGraph(containerId, data, labels, color, mode, threshold, threshDir, hours) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;

    const ml = 38, mr = 8, mt = 14, mb = 28;
    const pw = w - ml - mr;
    const ph = h - mt - mb;

    const validData = data.filter(function(v) { return v !== null; });
    if (validData.length === 0) {
      container.innerHTML = "<div style=\"text-align:center;color:#9fa8da;padding:1rem;font-size:0.8rem;\">No data</div>";
      return;
    }

    let yMin, yMax;
    if (mode === "pct") {
      yMin = 0;
      yMax = 100;
    } else {
      yMin = Math.floor((Math.min.apply(null, validData) - 2) / 5) * 5;
      yMax = Math.ceil((Math.max.apply(null, validData) + 2) / 5) * 5;
      if (yMax - yMin < 10) {
        const mid = (yMax + yMin) / 2;
        yMin = Math.floor((mid - 5) / 5) * 5;
        yMax = Math.ceil((mid + 5) / 5) * 5;
      }
    }
    const yRange = yMax - yMin || 1;

    const n = data.length;
    function getX(i) { return ml + (i / (n - 1)) * pw; }
    function getY(val) { return mt + ph - ((val - yMin) / yRange) * ph; }

    let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + w + " " + h + "\" preserveAspectRatio=\"none\" style=\"width:100%;height:100%\">";

    if (threshold !== null && threshold !== undefined) {
      let inAdverse = false;
      let segStart = 0;
      for (let i = 0; i < n; i++) {
        const val = data[i];
        const isAdverse = val !== null && val > threshold;
        if (isAdverse && !inAdverse) {
          segStart = i;
          inAdverse = true;
        }
        if ((!isAdverse || i === n - 1) && inAdverse) {
          const segEnd = isAdverse ? i : i - 1;
          const x1 = getX(Math.max(0, segStart - 0.5));
          const x2 = getX(Math.min(n - 1, segEnd + 0.5));
          svg += "<rect x=\"" + x1 + "\" y=\"" + mt + "\" width=\"" + (x2 - x1) + "\" height=\"" + ph + "\" fill=\"rgba(255,193,7,0.12)\" stroke=\"rgba(255,193,7,0.35)\" stroke-width=\"1\" stroke-dasharray=\"4,2\"/>";
          inAdverse = false;
        }
      }
    }

    if (threshold !== null && threshold !== undefined && threshold >= yMin && threshold <= yMax) {
      const threshY = getY(threshold);
      svg += "<line x1=\"" + ml + "\" y1=\"" + threshY + "\" x2=\"" + (w - mr) + "\" y2=\"" + threshY + "\" stroke=\"rgba(255,193,7,0.5)\" stroke-width=\"1\" stroke-dasharray=\"6,3\"/>";
      svg += "<text x=\"" + (w - mr - 2) + "\" y=\"" + (threshY - 3) + "\" text-anchor=\"end\" fill=\"rgba(255,193,7,0.7)\" font-size=\"11\" font-weight=\"600\">" + threshold + "</text>";
    }

    if (mode === "pct") {
      for (let g = 1; g <= 4; g++) {
        const gVal = yMin + (g / 4) * yRange;
        const gy = getY(gVal);
        svg += "<line x1=\"" + ml + "\" y1=\"" + gy + "\" x2=\"" + (w - mr) + "\" y2=\"" + gy + "\" stroke=\"rgba(40,53,147,0.3)\" stroke-width=\"0.5\"/>";
        svg += "<text x=\"" + (ml - 4) + "\" y=\"" + (gy + 4) + "\" text-anchor=\"end\" fill=\"#9fa8da\" font-size=\"13\">" + Math.round(gVal) + "</text>";
      }
    } else {
      let firstLabel = true;
      for (let gVal = yMin; gVal <= yMax; gVal += 5) {
        const gy = getY(gVal);
        svg += "<line x1=\"" + ml + "\" y1=\"" + gy + "\" x2=\"" + (w - mr) + "\" y2=\"" + gy + "\" stroke=\"rgba(40,53,147,0.3)\" stroke-width=\"0.5\"/>";
        if (!firstLabel) {
          svg += "<text x=\"" + (ml - 4) + "\" y=\"" + (gy + 4) + "\" text-anchor=\"end\" fill=\"#9fa8da\" font-size=\"13\">" + Math.round(gVal) + "</text>";
        }
        firstLabel = false;
      }
    }

    for (let i = 0; i < n; i++) {
      const vx = getX(i);
      svg += "<line x1=\"" + vx + "\" y1=\"" + mt + "\" x2=\"" + vx + "\" y2=\"" + (h - mb) + "\" stroke=\"rgba(200,200,200,0.12)\" stroke-width=\"0.5\"/>";
    }

    for (let i = 0; i < labels.length; i++) {
      if (labels[i] !== null) {
        const lx = getX(i);
        svg += "<line x1=\"" + lx + "\" y1=\"" + mt + "\" x2=\"" + lx + "\" y2=\"" + (h - mb) + "\" stroke=\"rgba(40,53,147,0.2)\" stroke-width=\"0.5\"/>";
        const parts = labels[i].split("|");
        svg += "<text x=\"" + lx + "\" y=\"" + (h - mb + 13) + "\" text-anchor=\"middle\" fill=\"#9fa8da\" font-size=\"13\">" + parts[0] + "</text>";
        if (parts[1]) {
          svg += "<text x=\"" + lx + "\" y=\"" + (h - mb + 24) + "\" text-anchor=\"middle\" fill=\"#7986cb\" font-size=\"11\">" + parts[1] + "</text>";
        }
      }
    }

    if (hours && hours.length > 0) {
      const kickoffDate = new Date("2026-02-08T15:30:00-08:00");
      const firstTime = new Date(hours[0].time).getTime();
      const lastTime = new Date(hours[hours.length - 1].time).getTime();
      const kickoffMs = kickoffDate.getTime();
      if (kickoffMs >= firstTime && kickoffMs <= lastTime) {
        const kickoffIdx = (kickoffMs - firstTime) / (lastTime - firstTime) * (n - 1);
        const kx = ml + (kickoffIdx / (n - 1)) * pw;
        svg += "<line x1=\"" + kx.toFixed(1) + "\" y1=\"" + mt + "\" x2=\"" + kx.toFixed(1) + "\" y2=\"" + (h - mb) + "\" stroke=\"#f44336\" stroke-width=\"3\"/>";
        svg += "<text x=\"" + (kx + 4).toFixed(1) + "\" y=\"" + (mt + 12) + "\" fill=\"#f44336\" font-size=\"14\" font-weight=\"700\">Kickoff</text>";
      }
    }

    const pathParts = [];
    let dotsSvg = "";
    let firstPoint = true;
    for (let i = 0; i < n; i++) {
      if (data[i] === null) continue;
      const px = getX(i);
      const py = getY(data[i]);
      pathParts.push((firstPoint ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1));
      firstPoint = false;

      const isAdverse = data[i] > threshold;
      const dotColor = isAdverse ? "#ffc107" : color;
      const dotR = isAdverse ? 3 : 2;
      dotsSvg += "<circle cx=\"" + px.toFixed(1) + "\" cy=\"" + py.toFixed(1) + "\" r=\"" + dotR + "\" fill=\"" + dotColor + "\"/>";
    }

    if (pathParts.length > 1) {
      let areaPath = pathParts.join(" ");
      let lastValidIdx = -1;
      let firstValidIdx = -1;
      for (let i = n - 1; i >= 0; i--) {
        if (data[i] !== null) { lastValidIdx = i; break; }
      }
      for (let i = 0; i < n; i++) {
        if (data[i] !== null) { firstValidIdx = i; break; }
      }
      if (firstValidIdx >= 0 && lastValidIdx >= 0) {
        areaPath += " L" + getX(lastValidIdx).toFixed(1) + "," + (mt + ph);
        areaPath += " L" + getX(firstValidIdx).toFixed(1) + "," + (mt + ph) + " Z";
        svg += "<path d=\"" + areaPath + "\" fill=\"" + color + "\" fill-opacity=\"0.1\"/>";
      }

      svg += "<path d=\"" + pathParts.join(" ") + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>";
    }

    svg += dotsSvg;
    svg += "</svg>";
    container.innerHTML = svg;
  }

  loadKeyPoints() {
    getKeyPoints()
      .then((data) => {
        const container = document.getElementById("keypoints-container");

        if (data.error) {
          console.error("Key points error:", data.error);
          container.innerHTML = "<div class=\"error-msg\">Unable to generate key points</div>";
          return;
        }

        const bullets = data.bullets || [];
        if (bullets.length === 0) {
          container.innerHTML = "<div class=\"error-msg\">No key points available</div>";
          return;
        }

        let html = "<ul class=\"keypoints-list\">";
        for (let i = 0; i < bullets.length; i++) {
          html += "<li class=\"keypoint-item\">" + bullets[i] + "</li>";
        }
        html += "</ul>";
        container.innerHTML = html;
      })
      .catch((err) => {
        console.error("Key points fetch error:", err);
        document.getElementById("keypoints-container").innerHTML =
          "<div class=\"error-msg\">Failed to load key points</div>";
      });
  }

  formatTimePST(isoStr) {
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", hour12: true,
        timeZone: "America/Los_Angeles"
      });
    } catch (e) {
      return isoStr;
    }
  }

  updateLastUpdateTime() {
    document.getElementById("last-update").textContent =
      new Date().toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles" });
  }

  startAutoRefresh() {
    const self = this;

    setTimeout(function() {
      window.location.reload();
    }, 30 * 60 * 1000);

    setInterval(function() {
      self.loadLatestRadarFrame();
    }, 2 * 60 * 1000);

    setInterval(function() {
      self.loadLatestSatelliteFrame();
    }, 5 * 60 * 1000);
  }
}

document.addEventListener("DOMContentLoaded", function() {
  new WeatherDashboard();
});
