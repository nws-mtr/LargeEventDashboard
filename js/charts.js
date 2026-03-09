// ============================================================================
// js/charts.js — SVG line graph rendering for hourly forecast
// ============================================================================

// Interpret a datetime-local string (no TZ) as if it's in the given timezone.
// Returns epoch milliseconds in UTC.
function parseDateInTimezone(dateStr, tz) {
  if (!dateStr) return NaN;
  // Parse the bare datetime string as if it were UTC to get a reference epoch
  const naiveUtc = new Date(dateStr + "Z").getTime();
  // Format that UTC instant in the target timezone using fixed parts
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  });
  const p = fmt.formatToParts(new Date(naiveUtc));
  const g = (type) => p.find((x) => x.type === type).value;
  const tzLocalMs = new Date(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}Z`).getTime();
  // offsetMs = how far ahead the TZ is from UTC (negative for west)
  const offsetMs = tzLocalMs - naiveUtc;
  // To convert "local time in tz" → UTC, subtract the offset
  return naiveUtc - offsetMs;
}

function renderLineGraph(containerId, data, labels, varConfig, hours, eventTimes) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;

  const ml = 38, mr = 8, mt = 14, mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  const color = varConfig.color || "#2196f3";
  const mode  = varConfig.mode  || "value";
  const unit  = varConfig.unit  || "";

  const validData = data.filter((v) => v !== null);
  if (validData.length === 0) {
    container.innerHTML = "<div style=\"text-align:center;color:#9fa8da;padding:1rem;font-size:0.8rem;\">No data</div>";
    return;
  }

  let yMin, yMax;
  if (mode === "pct") {
    yMin = 0;
    yMax = 100;
  } else {
    yMin = Math.floor((Math.min(...validData) - 2) / 5) * 5;
    yMax = Math.ceil((Math.max(...validData) + 2) / 5) * 5;
    if (yMax - yMin < 10) {
      const mid = (yMax + yMin) / 2;
      yMin = Math.floor((mid - 5) / 5) * 5;
      yMax = Math.ceil((mid + 5) / 5) * 5;
    }
  }
  const yRange = yMax - yMin || 1;
  const n = data.length;

  function getX(i)   { return ml + (i / (n - 1)) * pw; }
  function getY(val) { return mt + ph - ((val - yMin) / yRange) * ph; }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">`;

  // Y-axis gridlines + labels
  if (mode === "pct") {
    for (let g = 1; g <= 4; g++) {
      const gVal = yMin + (g / 4) * yRange;
      const gy   = getY(gVal);
      svg += `<line x1="${ml}" y1="${gy}" x2="${w - mr}" y2="${gy}" stroke="rgba(40,53,147,0.3)" stroke-width="0.5"/>`;
      svg += `<text x="${ml - 4}" y="${gy + 4}" text-anchor="end" fill="#9fa8da" font-size="13">${Math.round(gVal)}</text>`;
    }
  } else {
    let firstLabel = true;
    for (let gVal = yMin; gVal <= yMax; gVal += 5) {
      const gy = getY(gVal);
      svg += `<line x1="${ml}" y1="${gy}" x2="${w - mr}" y2="${gy}" stroke="rgba(40,53,147,0.3)" stroke-width="0.5"/>`;
      if (!firstLabel) {
        svg += `<text x="${ml - 4}" y="${gy + 4}" text-anchor="end" fill="#9fa8da" font-size="13">${Math.round(gVal)}</text>`;
      }
      firstLabel = false;
    }
  }

  // Vertical tick marks at each hour
  for (let i = 0; i < n; i++) {
    const vx = getX(i);
    svg += `<line x1="${vx}" y1="${mt}" x2="${vx}" y2="${h - mb}" stroke="rgba(200,200,200,0.12)" stroke-width="0.5"/>`;
  }

  // Time-axis labels
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== null) {
      const lx    = getX(i);
      const parts = labels[i].split("|");
      svg += `<line x1="${lx}" y1="${mt}" x2="${lx}" y2="${h - mb}" stroke="rgba(40,53,147,0.2)" stroke-width="0.5"/>`;
      svg += `<text x="${lx}" y="${h - mb + 13}" text-anchor="middle" fill="#9fa8da" font-size="13">${parts[0]}</text>`;
      if (parts[1]) {
        svg += `<text x="${lx}" y="${h - mb + 24}" text-anchor="middle" fill="#7986cb" font-size="11">${parts[1]}</text>`;
      }
    }
  }

  // Event time annotations
  if (eventTimes && eventTimes.length > 0 && hours && hours.length > 0) {
    const tz = container.dataset.timezone || "America/Los_Angeles";
    const firstTime = new Date(hours[0].time).getTime();
    const lastTime  = new Date(hours[hours.length - 1].time).getTime();
    const timeRange = lastTime - firstTime;
    if (timeRange > 0) {
      eventTimes.forEach((evt) => {
        // datetime-local values have no timezone; interpret in venue timezone
        const evtMs = parseDateInTimezone(evt.time, tz);
        if (evtMs >= firstTime && evtMs <= lastTime) {
          const evtIdx = (evtMs - firstTime) / timeRange * (n - 1);
          const ex = ml + (evtIdx / (n - 1)) * pw;
          svg += `<line x1="${ex.toFixed(1)}" y1="${mt}" x2="${ex.toFixed(1)}" y2="${h - mb}" stroke="#f44336" stroke-width="2" stroke-dasharray="4,2"/>`;
          // Vertical label anchored at top of chart, reading downward
          const labelY = (mt + 4).toFixed(1);
          const labelX = (ex - 3).toFixed(1);
          svg += `<text x="${labelX}" y="${labelY}" fill="#f44336" font-size="10" font-weight="600" transform="rotate(-90,${labelX},${labelY})" text-anchor="end">${evt.name}</text>`;
        }
      });
    }
  }

  // Area fill + line path
  const pathParts = [];
  let dotsSvg   = "";
  let firstPoint = true;
  for (let i = 0; i < n; i++) {
    if (data[i] === null) continue;
    const px = getX(i);
    const py = getY(data[i]);
    pathParts.push((firstPoint ? "M" : "L") + px.toFixed(1) + "," + py.toFixed(1));
    firstPoint = false;
    dotsSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${color}"/>`;
  }

  if (pathParts.length > 1) {
    let firstValidIdx = -1, lastValidIdx = -1;
    for (let i = 0; i < n; i++)       { if (data[i] !== null) { firstValidIdx = i; break; } }
    for (let i = n - 1; i >= 0; i--)  { if (data[i] !== null) { lastValidIdx  = i; break; } }
    if (firstValidIdx >= 0 && lastValidIdx >= 0) {
      const areaPath = pathParts.join(" ")
        + ` L${getX(lastValidIdx).toFixed(1)},${mt + ph}`
        + ` L${getX(firstValidIdx).toFixed(1)},${mt + ph} Z`;
      svg += `<path d="${areaPath}" fill="${color}" fill-opacity="0.1"/>`;
    }
    svg += `<path d="${pathParts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  // Invisible hover zone for tooltip
  svg += `<rect class="chart-hover-zone" x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" style="cursor:crosshair"/>`;

  svg += dotsSvg + "</svg>";
  container.innerHTML = svg;

  // Create tooltip element
  let tooltip = container.querySelector(".chart-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "chart-tooltip";
    container.appendChild(tooltip);
  }

  // Mouseover handler
  const hoverZone = container.querySelector(".chart-hover-zone");
  if (hoverZone) {
    hoverZone.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Find nearest data point
      let nearestIdx = 0;
      let minDist = Infinity;
      for (let i = 0; i < n; i++) {
        if (data[i] === null) continue;
        const dist = Math.abs(getX(i) - mouseX);
        if (dist < minDist) { minDist = dist; nearestIdx = i; }
      }
      if (data[nearestIdx] !== null && hours && hours[nearestIdx]) {
        const timeStr = new Date(hours[nearestIdx].time).toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit", hour12: true,
          timeZone: container.dataset.timezone || "America/Los_Angeles"
        });
        tooltip.textContent = `${timeStr}: ${data[nearestIdx]}${unit}`;
        tooltip.style.display = "block";
        tooltip.style.left = (getX(nearestIdx) - tooltip.offsetWidth / 2) + "px";
        tooltip.style.top  = (getY(data[nearestIdx]) - tooltip.offsetHeight - 6) + "px";
      }
    });
    hoverZone.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  }
}

function buildTimelineChart(containerId, hours, selectedVariables, eventTimes, timezone) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tz = timezone || "America/Los_Angeles";

  const labels = hours.map((h, i) => {
    const dt  = new Date(h.time);
    const hr  = dt.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: tz });
    if (i % 3 === 0) {
      const day = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: tz });
      return `${hr}|${day}`;
    }
    return null;
  });

  // Build row HTML dynamically from selected variables
  let rowsHtml = "";
  selectedVariables.forEach((key, idx) => {
    const varDef = FORECAST_VARIABLES.find((v) => v.key === key);
    if (!varDef) return;
    const graphId = `graph-var-${idx}`;
    rowsHtml += `<div class="timeline-row"><div class="row-header">${varDef.label} (${varDef.unit})</div><div class="row-graph" id="${graphId}" data-timezone="${tz}"></div></div>`;
  });

  container.innerHTML = `<div class="timeline-chart"><div class="timeline-rows">${rowsHtml}</div></div>`;

  requestAnimationFrame(() => {
    selectedVariables.forEach((key, idx) => {
      const varDef = FORECAST_VARIABLES.find((v) => v.key === key);
      if (!varDef) return;
      const graphId = `graph-var-${idx}`;
      const dataArr = hours.map((h) => h[key] !== undefined ? h[key] : null);
      renderLineGraph(graphId, dataArr, labels, varDef, hours, eventTimes);
    });
  });
}
