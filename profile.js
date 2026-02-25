import { gql, clearJwt, getJwt } from "./api.js";
import { renderXpLine, renderPassFailBar, renderXpByPathBars } from "./charts.js";

const loginEl = document.querySelector("#login");
const uidEl = document.querySelector("#uid");
const totalXpEl = document.querySelector("#totalXp");
const passCountEl = document.querySelector("#passCount");
const failCountEl = document.querySelector("#failCount");
const passRateEl = document.querySelector("#passRate");
const topProjectsList = document.querySelector("#topProjectsList");
const statusBox = document.querySelector("#statusBox");

const xpChart = document.querySelector("#xpChart");
const pfChart = document.querySelector("#pfChart");
const xpByPathChart = document.querySelector("#xpByPathChart");

const logoutBtn = document.querySelector("#logoutBtn");

function setStatus(msg){ statusBox.textContent = msg || ""; }
function goLogin(){ window.location.replace("./index.html"); }
function fmtPct(n){ return Number.isFinite(n) ? `${(n*100).toFixed(1)}%` : "—"; }

logoutBtn.addEventListener("click", () => { clearJwt(); goLogin(); });

if (!getJwt()) goLogin();

/* Required query styles */
const Q_ME_NORMAL = `
  query Me {
    user { id login }
  }
`;

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

const Q_XP_ARGS = `
  query XpTransactionsArgs {
    transaction(
      where: { type: { _eq: "xp" } }
      order_by: { createdAt: asc }
    ) {
      id
      amount
      createdAt
      path
      type
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

    const xpData = await gql(Q_XP_ARGS);
    const xpTx = xpData?.transaction ?? [];

    const totalXp = xpTx.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    totalXpEl.textContent = totalXp.toLocaleString();

    const resultsData = await gql(Q_RESULTS_NESTED);
    const results = resultsData?.result ?? [];

    const finished = results.filter(r => r.grade !== null && r.grade !== undefined);
    const pass = finished.filter(r => Number(r.grade) > 0).length;
    const fail = finished.filter(r => Number(r.grade) === 0).length;

    passCountEl.textContent = pass.toLocaleString();
    failCountEl.textContent = fail.toLocaleString();

    const denom = pass + fail;
    passRateEl.textContent = denom ? fmtPct(pass / denom) : "—";

    renderXpLine(xpChart, xpTx.map(t => t.amount));
    renderPassFailBar(pfChart, pass, fail);

    // Extra section + graph: XP by path
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
      li.innerHTML = `<span>${it.path}</span> <small>— ${it.value.toLocaleString()} XP</small>`;
      topProjectsList.appendChild(li);
    }
    if (!top5.length) {
      topProjectsList.innerHTML = `<li><small>No XP-by-project data found.</small></li>`;
    }

    const top6 = sorted.slice(0, 6).map(it => ({
      label: shortPath(it.path),
      value: it.value
    }));
    renderXpByPathBars(xpByPathChart, top6);

    setStatus(`Loaded ${xpTx.length} XP transactions • ${results.length} results`);
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

function shortPath(p){
  const parts = String(p).split("/").filter(Boolean);
  if (parts.length <= 2) return p;
  return "/" + parts.slice(-2).join("/");
}

loadProfile();