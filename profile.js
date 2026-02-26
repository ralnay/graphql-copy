import { gql, clearJwt, getJwt } from "./api.js";
import { renderAuditDonut, renderActivityBars, renderXpByPathBars } from "./charts.js";

const loginEl = document.querySelector("#login");
const uidEl = document.querySelector("#uid");

const auditRatioEl = document.querySelector("#auditRatio");
const auditUpEl = document.querySelector("#auditUp");
const auditDownEl = document.querySelector("#auditDown");

const lastWhenEl = document.querySelector("#lastWhen");
const lastWhatEl = document.querySelector("#lastWhat");
const lastPathEl = document.querySelector("#lastPath");

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

/* Required query styles */
const Q_ME_NORMAL = `
  query Me {
    user { id login }
  }
`;

/* Nested query */
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

/* Arguments query: we fetch xp + audit (up/down) transactions */
const Q_TX_ARGS = `
  query TxArgs {
    transaction(
      where: { type: { _in: ["xp","up","down"] } }
      order_by: { createdAt: asc }
      limit: 2000
    ) {
      id
      type
      amount
      createdAt
      path
    }
  }
`;

async function loadProfile(){
  setStatus("Loading…");

  try {
    // Normal
    const meData = await gql(Q_ME_NORMAL);
    const me = meData?.user?.[0];
    loginEl.textContent = me?.login ?? "Unknown";
    uidEl.textContent = me?.id ?? "—";

    // Arguments (transactions)
    const txData = await gql(Q_TX_ARGS);
    const tx = txData?.transaction ?? [];

    // Nested (results)
    const resultsData = await gql(Q_RESULTS_NESTED);
    const results = resultsData?.result ?? [];

    // ===== Audit ratio from up/down =====
    const up = tx.filter(t => t.type === "up").reduce((s,t)=> s + (Number(t.amount)||0), 0);
    const down = tx.filter(t => t.type === "down").reduce((s,t)=> s + (Number(t.amount)||0), 0);
    const denom = up + down;
    const ratio = denom ? up / denom : 0;

    auditRatioEl.textContent = denom ? `${(ratio*100).toFixed(1)}%` : "—";
    auditUpEl.textContent = up.toLocaleString();
    auditDownEl.textContent = down.toLocaleString();

    renderAuditDonut(auditChart, up, down);

    // ===== Last activity: latest among tx + results =====
    const lastTx = tx.length ? tx[tx.length - 1] : null; // ordered asc
    const lastRes = results.length ? results[0] : null;  // ordered desc

    const lastTxTime = lastTx ? Date.parse(lastTx.createdAt) : -1;
    const lastResTime = lastRes ? Date.parse(lastRes.createdAt) : -1;

    let last = null;

    if (lastTxTime >= lastResTime) {
      last = lastTx ? {
        when: lastTx.createdAt,
        what: lastTx.type === "xp" ? "XP earned" : (lastTx.type === "up" ? "Audit received (up)" : "Audit received (down)"),
        path: lastTx.path
      } : null;
    } else {
      last = lastRes ? {
        when: lastRes.createdAt,
        what: "Result updated",
        path: lastRes.path
      } : null;
    }

    if (last) {
      lastWhenEl.textContent = fmtDateTime(last.when);
      lastWhatEl.textContent = last.what;
      lastPathEl.textContent = friendlyPath(last.path);
    } else {
      lastWhenEl.textContent = "—";
      lastWhatEl.textContent = "—";
      lastPathEl.textContent = "—";
    }

    // ===== Activity graph: last 14 days from tx + results =====
    const activityEvents = [
      ...tx.map(t => ({ createdAt: t.createdAt })),
      ...results.map(r => ({ createdAt: r.createdAt })),
    ];
    renderActivityBars(activityChart, activityEvents, 14);

    // ===== Bonus: Top XP projects + XP by project graph =====
    const xpTx = tx.filter(t => t.type === "xp");
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
      li.innerHTML = `<span>${friendlyPath(it.path)}</span> <small>— ${it.value.toLocaleString()} XP</small>`;
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

function friendlyPath(path){
  const parts = String(path || "").split("/").filter(Boolean);
  if (!parts.length) return "Unknown";

  // Drop the first segment if it looks like a username (common on 01 paths)
  if (parts.length >= 2) parts.shift();

  // Keep last 2 segments
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