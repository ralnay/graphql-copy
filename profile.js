import { gql, clearJwt, getJwt } from "./api.js";
import { renderAuditDonut, renderActivityBars, renderXpByPathBars } from "./charts.js";

const loginEl = document.querySelector("#login");
const uidEl = document.querySelector("#uid");

const auditRatioEl = document.querySelector("#auditRatio");
const auditUpEl = document.querySelector("#auditUp");
const auditDownEl = document.querySelector("#auditDown");

const moduleNameEl = document.querySelector("#moduleName");
const totalXpEl = document.querySelector("#totalXp");
const currentLevelEl = document.querySelector("#currentLevel");
const txCountEl = document.querySelector("#txCount");

const topProjectsList = document.querySelector("#topProjectsList");
const statusBox = document.querySelector("#statusBox");

const auditChart = document.querySelector("#auditChart");
const activityChart = document.querySelector("#activityChart");
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

/* Arguments query: transactions (xp + up/down for audits) */
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

/* Nested query (kept for project context and audit requirement) */
const Q_RESULTS_NESTED = `
  query ResultsNested {
    result(order_by: {createdAt: desc}, limit: 50) {
      id
      grade
      createdAt
      path
      user { id login }
    }
  }
`;

/* Optional: try to read a level-like field if it exists (safe fallback)
   If your schema has none of these, it will just show "—". */
const Q_USER_LEVEL_TRY = `
  query UserLevelTry {
    user {
      level
      currentLevel
      lvl
      attrs
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

    // Keep nested query usage (requirement)
    const resultsData = await gql(Q_RESULTS_NESTED);
    const results = resultsData?.result ?? [];

    // ===== Audit ratio =====
    const up = tx.filter(t => t.type === "up").reduce((s,t)=> s + (Number(t.amount)||0), 0);
    const down = tx.filter(t => t.type === "down").reduce((s,t)=> s + (Number(t.amount)||0), 0);
    const denom = up + down;
    const ratio = denom ? up / denom : 0;

    auditRatioEl.textContent = denom ? `${(ratio*100).toFixed(1)}%` : "—";
    auditUpEl.textContent = up.toLocaleString();
    auditDownEl.textContent = down.toLocaleString();
    renderAuditDonut(auditChart, up, down);

    // ===== XP Board summary =====
    const xpTx = tx.filter(t => t.type === "xp");
    const totalXp = xpTx.reduce((s,t)=> s + (Number(t.amount)||0), 0);
    totalXpEl.textContent = humanizeXp(totalXp);

    txCountEl.textContent = tx.length.toLocaleString();

    // Module = most recent relevant path (prefer xp tx, else result)
    const lastXp = xpTx.length ? xpTx[xpTx.length - 1] : null; // tx ordered asc
    const lastRes = results.length ? results[0] : null;       // results ordered desc

    const lastXpTime = lastXp ? Date.parse(lastXp.createdAt) : -1;
    const lastResTime = lastRes ? Date.parse(lastRes.createdAt) : -1;

    const modulePath = (lastXpTime >= lastResTime ? lastXp?.path : lastRes?.path) || "";
    moduleNameEl.textContent = friendlyPath(modulePath);

    // Current level (best-effort from schema)
    currentLevelEl.textContent = "—";
    try {
      const lv = await gql(Q_USER_LEVEL_TRY);
      const u = lv?.user?.[0];
      const found =
        u?.level ??
        u?.currentLevel ??
        u?.lvl ??
        (typeof u?.attrs === "object" ? (u.attrs.level ?? u.attrs.currentLevel ?? u.attrs.lvl) : null);
      if (found !== null && found !== undefined && String(found).trim() !== "") {
        currentLevelEl.textContent = String(found);
      }
    } catch {
      // ignore if schema doesn’t have these fields
    }

    // ===== Submission/Transactions history graph (last 14 days) =====
    renderActivityBars(activityChart, tx.map(t => ({ createdAt: t.createdAt })), 14);

    // ===== Bonus: XP by project =====
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

function humanizeXp(n){
  // 01 platforms often display XP like “kB”, so we format that way.
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

  // Drop the first segment if it looks like a username
  if (parts.length >= 2) parts.shift();

  const keep = parts.slice(-2);
  return keep.map(friendlySegment).join(" / ");
}

function friendlySegment(seg){
  return String(seg)
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

loadProfile();