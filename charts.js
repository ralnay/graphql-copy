export function renderXpLine(svgEl, xpAmounts) {
  const w = 760, h = 260, pad = 32;

  let cum = 0;
  const series = xpAmounts.map(a => (cum += (Number(a) || 0)));
  const n = series.length;

  svgEl.innerHTML = "";
  if (!n) {
    svgEl.innerHTML = `<text class="label" x="${pad}" y="${pad}">No XP transactions found.</text>`;
    return;
  }

  const maxY = Math.max(...series, 1);

  const points = series.map((y, i) => {
    const x = pad + (n <= 1 ? 0 : (i * (w - 2*pad)) / (n - 1));
    const yy = (h - pad) - (y * (h - 2*pad)) / maxY;
    return { x, y: yy };
  });

  const grid = [];
  for (let k = 0; k <= 4; k++) {
    const gy = pad + (k * (h - 2*pad)) / 4;
    grid.push(`<line class="gridline" x1="${pad}" y1="${gy}" x2="${w-pad}" y2="${gy}" />`);
  }

  const poly = points.map(p => `${p.x},${p.y}`).join(" ");
  const last = series[series.length - 1];

  svgEl.innerHTML = `
    ${grid.join("")}
    <line class="axis" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" />
    <line class="axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" />
    <polyline class="line" points="${poly}" />
    <circle class="dot" cx="${points[points.length-1].x}" cy="${points[points.length-1].y}" r="4" />
    <text class="label" x="${pad}" y="${pad-10}">Cumulative XP</text>
    <text class="label" x="${w-pad}" y="${h-10}" text-anchor="end">${n} tx • Last: ${last.toLocaleString()}</text>
  `;
}

export function renderPassFailBar(svgEl, passCount, failCount) {
  const w = 360, h = 220, pad = 28;
  const max = Math.max(passCount, failCount, 1);

  const barW = 90;
  const gap = 60;

  const passH = ((h - 2*pad) * passCount) / max;
  const failH = ((h - 2*pad) * failCount) / max;

  const x1 = pad + 55;
  const x2 = x1 + barW + gap;
  const baseY = h - pad;

  svgEl.innerHTML = `
    <line class="axis" x1="${pad}" y1="${baseY}" x2="${w-pad}" y2="${baseY}" />
    <line class="axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${baseY}" />

    <rect class="bar-pass" x="${x1}" y="${baseY - passH}" width="${barW}" height="${passH}" rx="12" />
    <rect class="bar-fail" x="${x2}" y="${baseY - failH}" width="${barW}" height="${failH}" rx="12" />

    <text class="label" x="${x1 + barW/2}" y="${h-10}" text-anchor="middle">PASS</text>
    <text class="label" x="${x2 + barW/2}" y="${h-10}" text-anchor="middle">FAIL</text>

    <text class="label" x="${x1 + barW/2}" y="${baseY - passH - 8}" text-anchor="middle">${passCount}</text>
    <text class="label" x="${x2 + barW/2}" y="${baseY - failH - 8}" text-anchor="middle">${failCount}</text>
  `;
}

/* ✅ EXTRA GRAPH: XP by project/path (Top N) */
export function renderXpByPathBars(svgEl, items) {
  // items: [{ label, value }]
  const w = 760, h = 260, pad = 32;
  svgEl.innerHTML = "";

  if (!items?.length) {
    svgEl.innerHTML = `<text class="label" x="${pad}" y="${pad}">No per-project XP data.</text>`;
    return;
  }

  const max = Math.max(...items.map(x => x.value), 1);
  const rowH = Math.floor((h - 2*pad) / items.length);
  const barH = Math.max(14, Math.floor(rowH * 0.55));

  // chart area
  const left = pad;
  const right = w - pad;
  const top = pad;
  const bottom = h - pad;

  const grid = [];
  for (let k = 0; k <= 4; k++) {
    const x = left + (k * (right - left)) / 4;
    grid.push(`<line class="gridline" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" />`);
    grid.push(`<text class="label" x="${x}" y="${h-10}" text-anchor="middle">${Math.round((k*max)/4).toLocaleString()}</text>`);
  }

  const bars = items.map((it, i) => {
    const yMid = top + i * rowH + rowH / 2;
    const y = yMid - barH / 2;

    const barW = ((right - left) * it.value) / max;
    const label = it.label.length > 36 ? it.label.slice(0, 33) + "…" : it.label;

    return `
      <text class="label" x="${left}" y="${yMid + 4}" text-anchor="start">${escapeXml(label)}</text>
      <rect class="bar-xp" x="${left + 250}" y="${y}" width="${Math.max(2, barW - 250)}" height="${barH}" rx="10" />
      <text class="label" x="${right}" y="${yMid + 4}" text-anchor="end">${it.value.toLocaleString()}</text>
    `;
  }).join("");

  svgEl.innerHTML = `
    ${grid.join("")}
    <line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" />
    ${bars}
  `;

  function escapeXml(s){
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }
}
