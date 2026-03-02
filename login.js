import { signin, setJwt, getJwt, clearJwt } from "./api.js";

const form = document.querySelector("#loginForm");
const errorBox = document.querySelector("#errorBox");
const identifierEl = document.querySelector("#identifier");
const passwordEl = document.querySelector("#password");

function showError(msg){ errorBox.textContent = msg || ""; }
function goProfile(){ window.location.replace("./profile.html"); }

// If token exists but is bad/expired, you can get “glitchy” behavior.
// This keeps it clean: only auto-go if token exists.
if (getJwt()) {
  goProfile();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");

  const identifier = identifierEl.value.trim();
  const password = passwordEl.value;

  if (!identifier || !password) {
    showError("Please fill both fields.");
    return;
  }

  try {
    const jwt = await signin(identifier, password);
    setJwt(jwt);
    goProfile();
  } catch (err) {
    // If signin succeeds weirdly, clear token to prevent loops
    clearJwt();
    showError(err?.message || "Login failed.");
  }
});