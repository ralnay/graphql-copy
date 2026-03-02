import { gql, clearJwt, getJwt } from "./api.js";
import { renderAuditDonut, renderDailyXpBars, renderXpByPathBars } from "./charts.js";

const loginEl = document.querySelector("#login");
const uidEl = document.querySelector("#uid");

const auditRatioEl = document.querySelector("#auditRatio");
const auditUpEl = document.querySelector("#auditUp");
const auditDownEl = document.querySelector("#auditDown");

const lastContentEl = document.querySelector("#lastContent");
const lastCompletedAtEl = document.querySelector("#lastCompletedAt");
const lastGradeEl = document.querySelector("#lastGrade");
const lastRewardXpEl = document.querySelector("#lastRewardXp");
const lastPathEl = document.querySelector("#lastPath");

const topProjectsList = document.querySelector("#topProjectsList");
const statusBox = document.querySelector("#statusBox");

const auditChart = document.querySelector("#auditChart");
const rewardsChart = document.querySelector("#rewardsChart");
const xpByPathChart = document.querySelector("#xpByPathChart");

const logoutBtn = document.querySelector("#logoutBtn");

function setStatus(msg){ statusBox.textContent = msg || ""; }
function goLogin(){ window.location.replace("index.html"); }

logoutBtn.addEventListener("click", () => { clearJwt(); goLogin(); });
if (!getJwt()) goLogin();

/* Normal query */
const Q_ME_NORMAL = `
  query Me {
    user { id login }
  }
`;

/* Arguments query: xp + up/down */
const Q_TX_ARGS = `
  query TxArgs {
    transaction(
      where: { type: { _in: ["xp","up","down"] } }
      order_by: { createdAt: asc }
      limit: 3000
    ) {
      id
      type
      amount
      createdAt
      path
    }
  }
`;

/* Nested query: project/result history (completion source) */
const Q_RESULTS_NESTED = `
  query ResultsNested {
    result(order_by: {createdAt: desc}, limit: 250) {
      id
      grade
      createdAt
      path
      user { id login }
    }
  }
`;

async function loadProfile(){
  setStatus("Loading…");

  try {
    const meData = await gql(Q_ME_NORMAL);
    const me = meData?.user?.[0];
    loginEl.textContent = me?.login ?? "Unknown";
    uidEl.textContent = me?.id ?? "—";

    const txData = await gql(Q_TX_ARGS);
    const tx = txData?.transaction ?? [];

    const resultsData = await gql(Q_RESULTS_NESTED);
    const results = resultsData?.result ?? [];

    // ===== Audit ratio (UPDATED) =====
    // ratio = up / down (not %)
    const upBytes = tx.filter(t => t.type === "up").reduce((s,t)=> s + (Number(t.amount)||0), 0);
    const downBytes = tx.filter(t => t.type === "down").reduce((s,t)=> s + (Number(t.amount)||0), 0);

    // Display up/down as MB with 2 decimals
    auditUpEl.textContent = formatMB(upBytes);
    auditDownEl.textContent = formatMB(downBytes);

    // Ratio as a number like 0.9, 1.0, 1.2
    const ratio = downBytes > 0 ? (upBytes / downBytes) : (upBytes > 0 ? Infinity : 0);
    auditRatioEl.textContent = Number.isFinite(ratio) ? ratio.toFixed(1) : "∞";

    // Donut visuals still show up vs down proportions, center text shows ratio
    renderAuditDonut(auditChart, upBytes, downBytes, auditRatioEl.textContent);

    // ===== Last completed content + rewards received =====
    const completed = results.find(r => r.grade !== null && r.grade !== undefined);
    const xpTx = tx.filter(t => t.type === "xp");

    if (completed) {
      const path = completed.path || "";
      const contentName = friendlyPath(path);

      lastContentEl.textContent = contentName;
      lastPathEl.textContent = friendlyPathFull(path);
      lastCompletedAtEl.textContent = fmtDateTime(completed.createdAt);
      lastGradeEl.textContent = String(completed.grade);

      // Reward XP: best-effort
      const compTime = Date.parse(completed.createdAt);
      const windowMs = 48 * 60 * 60 * 1000;

      let best = null;
      let bestDt = Infinity;

      for (const t of xpTx) {
        if (t.path !== path) continue;
        const tt = Date.parse(t.createdAt);
        if (!Number.isFinite(tt) || !Number.isFinite(compTime)) continue;

        if (tt >= compTime && tt - compTime <= windowMs) {
          const dt = tt - compTime;
          if (dt < bestDt) { bestDt = dt; best = t; }
        }
      }

      if (best) {
        lastRewardXpEl.textContent = humanizeXp(best.amount);
      } else {
        const totalForPath = xpTx
          .filter(t => t.path === path)
          .reduce((s,t)=> s + (Number(t.amount)||0), 0);
        lastRewardXpEl.textContent = totalForPath ? humanizeXp(totalForPath) : "—";
      }
    } else {
      lastContentEl.textContent = "—";
      lastPathEl.textContent = "—";
      lastCompletedAtEl.textContent = "—";
      lastGradeEl.textContent = "—";
      lastRewardXpEl.textContent = "—";
    }

    // ===== Rewards graph (XP per day, last 14 days) =====
    renderDailyXpBars(
      rewardsChart,
      xpTx.map(t => ({ createdAt: t.createdAt, amount: t.amount })),
      14
    );

    // ===== Bonus: Top XP projects + XP by project =====
    const xpByPathMap = new Map();
    for (const t of xpTx) {
      const path = t.path || "(no path)";
      const amt = Number(t.amount) || 0;
      xpByPathMap.set(path, (xpByPathMap.get(path) || 0) + amt);
    }

    const sorted = [...xpByPathMap.entries()]
      .map(([path, value]) => ({ path, value }))
      .sort((a,b) => b.value - a.value);

    topProjectsList.innerHTML = "";
    const top5 = sorted.slice(0, 5);
    for (const it of top5) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${friendlyPath(it.path)}</span> <small>— ${humanizeXp(it.value)}</small>`;
      topProjectsList.appendChild(li);
    }
    if (!top5.length) {
      topProjectsList.innerHTML = `<li><small>No XP-by-project data found.</small></li>`;
    }

    const top6 = sorted.slice(0, 6).map(it => ({
      label: friendlyPath(it.path),
      value: it.value
    }));
    renderXpByPathBars(xpByPathChart, top6);

    setStatus(`Loaded ${tx.length} transactions • ${results.length} results`);
  } catch (err) {
    console.error("PROFILE LOAD ERROR:", err);
    const msg = err?.message || "Failed to load profile.";
    setStatus(msg);

    const low = String(msg).toLowerCase();
    if (low.includes("jwt") || low.includes("auth") || low.includes("unauthorized")) {
      clearJwt();
      goLogin();
    }
  }
}

function fmtDateTime(iso){
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function formatMB(bytes){
  const mb = (Number(bytes) || 0) / 1_000_000;
  return `${mb.toFixed(2)} MB`;
}

function humanizeXp(n){
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1024 * 1024 * 1024) return `${(num / (1024*1024*1024)).toFixed(1)} GB`;
  if (abs >= 1024 * 1024) return `${(num / (1024*1024)).toFixed(1)} MB`;
  if (abs >= 1024) return `${Math.round(num / 1024)} kB`;
  return `${Math.round(num)} B`;
}

function friendlyPath(path){
  const parts = String(path || "").split("/").filter(Boolean);
  if (!parts.length) return "Unknown";
  if (parts.length >= 2) parts.shift();
  const keep = parts.slice(-2);
  return keep.map(friendlySegment).join(" / ");
}

function friendlyPathFull(path){
  const parts = String(path || "").split("/").filter(Boolean);
  if (!parts.length) return "Unknown";
  if (parts.length >= 2) parts.shift();
  const keep = parts.slice(-3);
  return keep.map(friendlySegment).join(" / ");
}

function friendlySegment(seg){
  return String(seg)
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

loadProfile();