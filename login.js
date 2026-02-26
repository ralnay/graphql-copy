import { signin, setJwt, getJwt } from "./api.js";

const form = document.querySelector("#loginForm");
const errorBox = document.querySelector("#errorBox");
const identifierEl = document.querySelector("#identifier");
const passwordEl = document.querySelector("#password");

function showError(msg){ errorBox.textContent = msg || ""; }
function goProfile(){ window.location.replace("./profile.html"); }

if (getJwt()) goProfile();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");

  const identifier = identifierEl.value.trim();
  const password = passwordEl.value;

  if (!identifier || !password) return showError("Please fill both fields.");

  try {
    const jwt = await signin(identifier, password);
    setJwt(jwt);
    goProfile();
  } catch (err) {
    showError(err?.message || "Login failed.");
  }
});