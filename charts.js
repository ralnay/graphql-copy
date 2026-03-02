export function renderAuditDonut(svgEl, up, down, ratioNumber = null) {
  const cx = 120, cy = 120;
  const r = 62;
  const stroke = 16;

  svgEl.innerHTML = "";
  const total = Math.max(0, up) + Math.max(0, down);

  if (total <= 0) {
    svgEl.innerHTML = `<text class="label" x="18" y="28">No audit data found (up/down).</text>`;
    return;
  }

  // Donut split is just visualization (share of total), NOT the ratio
  const shareUp = up / total;
  const C = 2 * Math.PI * r;

  const upLen = C * shareUp;
  const downLen = C - upLen;

  const rotate = `rotate(-90 ${cx} ${cy})`;

  const ratioText =
    (ratioNumber === null || !Number.isFinite(ratioNumber))
      ? "—"
      : ratioNumber.toFixed(1);

  svgEl.innerHTML = `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="rgba(255,255,255,.08)" stroke-width="${stroke}" />

    <circle class="donut-up"
      cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${upLen} ${downLen}"
      transform="${rotate}"
    />

    <circle class="donut-down"
      cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${downLen} ${upLen}"
      stroke-dashoffset="${-upLen}"
      transform="${rotate}"
      opacity="0.95"
    />

    <text class="label" x="${cx}" y="${cy - 6}" text-anchor="middle"
      style="font-size:18px; fill: rgba(255,255,255,.86);">
      ${ratioText}
    </text>
    <text class="label" x="${cx}" y="${cy + 14}" text-anchor="middle">
      audit ratio
    </text>

    <text class="label" x="220" y="92">Up: ${Number(up).toLocaleString()}</text>
    <text class="label" x="220" y="118">Down: ${Number(down).toLocaleString()}</text>
  `;
}

/**
 * NEW: daily XP rewards bars (sum of XP amounts per day)
 * events: [{ createdAt, amount }]
 */
export function renderDailyXpBars(svgEl, events, days = 14) {
  const w = 760, h = 260, pad = 32;
  svgEl.innerHTML = "";

  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0,0,0,0);
    buckets.push({ date: d, value: 0 });
  }

  const start = buckets[0].date.getTime();
  const end = new Date(now).setHours(23,59,59,999);

  for (const e of events) {
    const t = Date.parse(e.createdAt);
    if (!Number.isFinite(t)) continue;
    if (t < start || t > end) continue;

    const d = new Date(t);
    d.setHours(0,0,0,0);
    const idx = Math.round((d.getTime() - start) / (24 * 60 * 60 * 1000));
    if (idx >= 0 && idx < buckets.length) {
      buckets[idx].value += (Number(e.amount) || 0);
    }
  }

  const max = Math.max(...buckets.map(b => b.value), 1);

  const chartLeft = pad;
  const chartRight = w - pad;
  const chartTop = pad;
  const chartBottom = h - pad;

  const grid = [];
  for (let k = 0; k <= 4; k++) {
    const gy = chartTop + (k * (chartBottom - chartTop)) / 4;
    grid.push(`<line class="gridline" x1="${chartLeft}" y1="${gy}" x2="${chartRight}" y2="${gy}" />`);
    const val = Math.round(max * (1 - k/4));
    grid.push(`<text class="label" x="${chartLeft - 8}" y="${gy + 4}" text-anchor="end">${val}</text>`);
  }

  const barGap = 6;
  const barW = (chartRight - chartLeft - barGap * (days - 1)) / days;

  const bars = buckets.map((b, i) => {
    const bh = ((chartBottom - chartTop) * b.value) / max;
    const x = chartLeft + i * (barW + barGap);
    const y = chartBottom - bh;
    return `<rect class="bar-act" x="${x}" y="${y}" width="${barW}" height="${Math.max(2, bh)}" rx="6" />`;
  }).join("");

  const labels = buckets.map((b, i) => {
    if (i === 0 || i === buckets.length - 1 || i === Math.floor(buckets.length/2)) {
      const x = chartLeft + i * (barW + barGap) + barW/2;
      const mm = String(b.date.getMonth() + 1).padStart(2, "0");
      const dd = String(b.date.getDate()).padStart(2, "0");
      return `<text class="label" x="${x}" y="${h - 8}" text-anchor="middle">${mm}/${dd}</text>`;
    }
    return "";
  }).join("");

  svgEl.innerHTML = `
    ${grid.join("")}
    <line class="axis" x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" />
    <line class="axis" x1="${chartLeft}" y1="${chartTop}" x2="${chartLeft}" y2="${chartBottom}" />
    ${bars}
    ${labels}
  `;
}

export function renderXpByPathBars(svgEl, items) {
  const w = 760, h = 260, pad = 32;
  svgEl.innerHTML = "";

  if (!items?.length) {
    svgEl.innerHTML = `<text class="label" x="${pad}" y="${pad}">No per-project XP data.</text>`;
    return;
  }

  const max = Math.max(...items.map(x => x.value), 1);
  const rowH = Math.floor((h - 2*pad) / items.length);
  const barH = Math.max(14, Math.floor(rowH * 0.55));

  const left = pad;
  const right = w - pad;
  const top = pad;
  const labelArea = 260;

  const bars = items.map((it, i) => {
    const yMid = top + i * rowH + rowH / 2;
    const y = yMid - barH / 2;

    const fullW = (right - left - labelArea);
    const barW = (fullW * it.value) / max;
    const label = it.label.length > 38 ? it.label.slice(0, 35) + "…" : it.label;

    return `
      <text class="label" x="${left}" y="${yMid + 4}" text-anchor="start">${escapeXml(label)}</text>
      <rect class="bar-xp" x="${left + labelArea}" y="${y}" width="${Math.max(2, barW)}" height="${barH}" rx="10" />
      <text class="label" x="${right}" y="${yMid + 4}" text-anchor="end">${it.value.toLocaleString()}</text>
    `;
  }).join("");

  svgEl.innerHTML = `
    <line class="axis" x1="${left}" y1="${h - pad}" x2="${right}" y2="${h - pad}" />
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