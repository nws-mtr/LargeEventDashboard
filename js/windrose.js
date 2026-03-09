// ============================================================================
// js/windrose.js — SVG wind rose (polar frequency chart)
// ============================================================================

function renderWindRose(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const bins     = data.bins || [];
  const totalObs = data.totalObs || 0;
  if (bins.length === 0 || totalObs === 0) {
    container.innerHTML = "<div style=\"text-align:center;color:#9fa8da;padding:1rem;font-size:0.8rem;\">No wind data</div>";
    return;
  }

  // Layout constants
  const size   = 300;
  const cx     = size / 2;
  const cy     = size / 2;
  const margin = 40;
  const maxR   = (size / 2) - margin;

  // Find max frequency in any single bin (for scaling)
  const maxFreq = Math.max(...bins.map((b) => {
    return b.speedCounts.reduce((s, c) => s + c, 0);
  }));
  const maxPct = maxFreq / totalObs;

  // Determine nice reference ring values
  const ringPcts = [];
  if (maxPct <= 0.15)      { ringPcts.push(0.05, 0.10, 0.15); }
  else if (maxPct <= 0.25) { ringPcts.push(0.10, 0.20); }
  else if (maxPct <= 0.50) { ringPcts.push(0.10, 0.20, 0.30, 0.40); }
  else                     { ringPcts.push(0.20, 0.40, 0.60); }

  const scalePct = (ringPcts[ringPcts.length - 1] || maxPct) * 1.15; // slight padding

  function pctToR(pct) {
    return (pct / scalePct) * maxR;
  }

  const numBins  = bins.length; // 16
  const wedgeAng = (2 * Math.PI) / numBins;
  const halfWedge = wedgeAng / 2;

  // Convert polar (angle from North, CW) to SVG cartesian
  // angle=0 => North (up), angle=PI/2 => East (right)
  function polarToXY(angleDeg, r) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  function arcPath(innerR, outerR, startDeg, endDeg) {
    const [x1, y1] = polarToXY(startDeg, innerR);
    const [x2, y2] = polarToXY(startDeg, outerR);
    const [x3, y3] = polarToXY(endDeg, outerR);
    const [x4, y4] = polarToXY(endDeg, innerR);
    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} `
         + `L${x2.toFixed(2)},${y2.toFixed(2)} `
         + `A${outerR.toFixed(2)},${outerR.toFixed(2)} 0 ${largeArc} 1 ${x3.toFixed(2)},${y3.toFixed(2)} `
         + `L${x4.toFixed(2)},${y4.toFixed(2)} `
         + `A${innerR.toFixed(2)},${innerR.toFixed(2)} 0 ${largeArc} 0 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size + 40}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">`;

  // Reference circles
  ringPcts.forEach((pct) => {
    const r = pctToR(pct);
    svg += `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="rgba(159,168,218,0.2)" stroke-width="0.5"/>`;
    svg += `<text x="${cx + 2}" y="${cy - r - 1}" fill="#9fa8da" font-size="9" opacity="0.6">${Math.round(pct * 100)}%</text>`;
  });

  // Wedge segments
  bins.forEach((bin, i) => {
    const centerDeg = i * (360 / numBins);
    const startDeg  = centerDeg - (360 / numBins / 2);
    const endDeg    = centerDeg + (360 / numBins / 2);

    let cumulativePct = 0;
    bin.speedCounts.forEach((count, si) => {
      if (count === 0) return;
      const segPct = count / totalObs;
      const innerR = pctToR(cumulativePct);
      const outerR = pctToR(cumulativePct + segPct);
      svg += `<path d="${arcPath(innerR, outerR, startDeg, endDeg)}" fill="${WIND_SPEED_BINS[si].color}" fill-opacity="0.85" stroke="rgba(26,31,58,0.5)" stroke-width="0.5"/>`;
      cumulativePct += segPct;
    });
  });

  // Cardinal direction labels
  const cardinalLabels = [
    { label: "N",   deg: 0 },
    { label: "NE",  deg: 45 },
    { label: "E",   deg: 90 },
    { label: "SE",  deg: 135 },
    { label: "S",   deg: 180 },
    { label: "SW",  deg: 225 },
    { label: "W",   deg: 270 },
    { label: "NW",  deg: 315 }
  ];

  cardinalLabels.forEach(({ label, deg }) => {
    const [x, y] = polarToXY(deg, maxR + 14);
    svg += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" fill="#e8eaf6" font-size="12" font-weight="600">${label}</text>`;
  });

  // Center dot
  svg += `<circle cx="${cx}" cy="${cy}" r="2" fill="#9fa8da"/>`;

  // Legend (below chart)
  const legendY = size + 8;
  const legendStartX = 20;
  const boxW = 14, boxH = 10, gap = 4;
  let lx = legendStartX;
  WIND_SPEED_BINS.forEach((bin) => {
    svg += `<rect x="${lx}" y="${legendY}" width="${boxW}" height="${boxH}" rx="2" fill="${bin.color}" fill-opacity="0.85"/>`;
    svg += `<text x="${lx + boxW + 3}" y="${legendY + 9}" fill="#9fa8da" font-size="9">${bin.label}</text>`;
    lx += boxW + 3 + bin.label.length * 5.5 + gap + 4;
  });
  svg += `<text x="${lx}" y="${legendY + 9}" fill="#9fa8da" font-size="9">mph</text>`;

  // Station info
  svg += `<text x="${cx}" y="${size + 32}" text-anchor="middle" fill="#9fa8da" font-size="9" opacity="0.7">${data.stationName} (${data.stationId}) \u2014 ${totalObs} obs</text>`;

  svg += "</svg>";
  container.innerHTML = svg;
}
