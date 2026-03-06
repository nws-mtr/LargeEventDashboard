// ============================================================================
// js/maps.js — Leaflet map initialization helpers
// ============================================================================

function initRadarMap(elementId, venueLatLng) {
  const map = L.map(elementId, {
    center:             venueLatLng,
    zoom:               9,
    zoomControl:        true,
    attributionControl: true
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; <a href=\"https://carto.com/\">CARTO</a>",
    subdomains:  "abcd",
    maxZoom:     19
  }).addTo(map);

  const countiesLayer = L.tileLayer.wms(
    "https://tigerweb.geo.census.gov/arcgis/services/TIGERweb/tigerWMS_Current/MapServer/WMSServer", {
      layers:      "84",
      format:      "image/png",
      transparent: true,
      styles:      "",
      attribution: "US Census Bureau",
      pane:        "overlayPane",
      opacity:     1
    }
  ).addTo(map);

  const timestampOverlay = L.DomUtil.create("div", "map-timestamp-overlay");
  timestampOverlay.id          = "radar-timestamp-overlay";
  timestampOverlay.textContent = "Loading...";
  document.getElementById(elementId).appendChild(timestampOverlay);

  return { map, countiesLayer };
}

function initSatelliteMap(elementId, venueLatLng) {
  const map = L.map(elementId, {
    center:             venueLatLng,
    zoom:               7,
    zoomControl:        true,
    attributionControl: true
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; <a href=\"https://carto.com/\">CARTO</a>",
    subdomains:  "abcd",
    maxZoom:     12
  }).addTo(map);

  const labelsLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom:    12,
      pane:       "overlayPane"
    }
  ).addTo(map);

  const countiesLayer = L.tileLayer.wms(
    "https://tigerweb.geo.census.gov/arcgis/services/TIGERweb/tigerWMS_Current/MapServer/WMSServer", {
      layers:      "84",
      format:      "image/png",
      transparent: true,
      styles:      "",
      attribution: "US Census Bureau",
      pane:        "overlayPane",
      opacity:     1
    }
  ).addTo(map);

  const timestampOverlay = L.DomUtil.create("div", "map-timestamp-overlay");
  timestampOverlay.id          = "satellite-timestamp-overlay";
  timestampOverlay.textContent = "Loading...";
  document.getElementById(elementId).appendChild(timestampOverlay);

  return { map, labelsLayer, countiesLayer };
}
