// ============================================================================
// js/charts.js — SVG line graph rendering for hourly forecast
// ============================================================================

function renderLineGraph(containerId, data, labels, color, mode, threshold, threshDir, hours) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;

  const ml = 38, mr = 8, mt = 14, mb = 28;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

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

  // Adverse region shading
  if (threshold !== null && threshold !== undefined) {
    let inAdverse = false;
    let segStart  = 0;
    for (let i = 0; i < n; i++) {
      const isAdverse = data[i] !== null && data[i] > threshold;
      if (isAdverse && !inAdverse) { segStart = i; inAdverse = true; }
      if ((!isAdverse || i === n - 1) && inAdverse) {
        const segEnd = isAdverse ? i : i - 1;
        const x1 = getX(Math.max(0, segStart - 0.5));
        const x2 = getX(Math.min(n - 1, segEnd + 0.5));
        svg += `<rect x="${x1}" y="${mt}" width="${x2 - x1}" height="${ph}" fill="rgba(255,193,7,0.12)" stroke="rgba(255,193,7,0.35)" stroke-width="1" stroke-dasharray="4,2"/>`;
        inAdverse = false;
      }
    }
  }

  // Threshold line
  if (threshold !== null && threshold !== undefined && threshold >= yMin && threshold <= yMax) {
    const threshY = getY(threshold);
    svg += `<line x1="${ml}" y1="${threshY}" x2="${w - mr}" y2="${threshY}" stroke="rgba(255,193,7,0.5)" stroke-width="1" stroke-dasharray="6,3"/>`;
    svg += `<text x="${w - mr - 2}" y="${threshY - 3}" text-anchor="end" fill="rgba(255,193,7,0.7)" font-size="11" font-weight="600">${threshold}</text>`;
  }

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

  // Kickoff marker
  if (hours && hours.length > 0) {
    const kickoffDate = new Date("2026-02-08T15:30:00-08:00");
    const firstTime   = new Date(hours[0].time).getTime();
    const lastTime    = new Date(hours[hours.length - 1].time).getTime();
    const kickoffMs   = kickoffDate.getTime();
    if (kickoffMs >= firstTime && kickoffMs <= lastTime) {
      const kickoffIdx = (kickoffMs - firstTime) / (lastTime - firstTime) * (n - 1);
      const kx = ml + (kickoffIdx / (n - 1)) * pw;
      svg += `<line x1="${kx.toFixed(1)}" y1="${mt}" x2="${kx.toFixed(1)}" y2="${h - mb}" stroke="#f44336" stroke-width="3"/>`;
      svg += `<text x="${(kx + 4).toFixed(1)}" y="${mt + 12}" fill="#f44336" font-size="14" font-weight="700">Kickoff</text>`;
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
    const isAdverse = data[i] > threshold;
    dotsSvg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${isAdverse ? 3 : 2}" fill="${isAdverse ? "#ffc107" : color}"/>`;
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

  svg += dotsSvg + "</svg>";
  container.innerHTML = svg;
}

function buildTimelineChart(containerId, hours, thresholds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const maxTempThresh = (thresholds && thresholds.maxTemp)       || 80;
  const minRainThresh = (thresholds && thresholds.minRainChance) || 15;
  const minSkyThresh  = (thresholds && thresholds.minSkyCover)   || 50;

  const temps = hours.map((h) => h.temperature);
  const rains = hours.map((h) => h.probabilityOfPrecipitation);
  const skies = hours.map((h) => h.skyCover);

  const labels = hours.map((h, i) => {
    const dt  = new Date(h.time);
    const hr  = dt.toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: "America/Los_Angeles" });
    if (i % 3 === 0) {
      const day = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Los_Angeles" });
      return `${hr}|${day}`;
    }
    return null;
  });

  container.innerHTML =
    `<div class="timeline-chart"><div class="timeline-rows">
      <div class="timeline-row"><div class="row-header">Temperature (F)</div><div class="row-graph" id="graph-temp"></div></div>
      <div class="timeline-row"><div class="row-header">Rain Chance (%)</div><div class="row-graph" id="graph-rain"></div></div>
      <div class="timeline-row"><div class="row-header">Cloud Cover (%)</div><div class="row-graph" id="graph-sky"></div></div>
    </div></div>`;

  requestAnimationFrame(() => {
    renderLineGraph("graph-temp", temps, labels, "#2196f3", "temp", maxTempThresh, "above", hours);
    renderLineGraph("graph-rain", rains, labels, "#4caf50", "pct",  minRainThresh, "above", hours);
    renderLineGraph("graph-sky",  skies, labels, "#9e9e9e", "pct",  minSkyThresh,  "above", hours);
  });
}
