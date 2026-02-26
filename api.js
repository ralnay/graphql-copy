export const AUTH_URL = "https://learn.reboot01.com/api/auth/signin";
export const GQL_URL  = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

export function getJwt() { return localStorage.getItem("jwt"); }
export function setJwt(jwt) { localStorage.setItem("jwt", jwt); }
export function clearJwt() { localStorage.removeItem("jwt"); }

export async function signin(identifier, password) {
  const basic = btoa(`${identifier}:${password}`);

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}` },
  });

  if (!res.ok) throw new Error("Invalid credentials. Use username/email + password.");

  const raw = (await res.text()).trim();
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const jwtRegex = /([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)\.([A-Za-z0-9\-_]+)/;

  let token = raw.replace(/^"+|"+$/g, "").trim();
  if (jwtRegex.test(token)) return token;

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim().replace(/^"+|"+$/g, "");
    if (jwtRegex.test(token)) return token;
  }

  if (raw.startsWith("{") || ct.includes("application/json")) {
    try {
      const data = JSON.parse(raw);
      token =
        data?.token ||
        data?.access_token ||
        data?.accessToken ||
        data?.jwt ||
        data?.id_token ||
        data?.data?.token ||
        data?.data?.access_token ||
        "";
      token = String(token).trim().replace(/^"+|"+$/g, "");
      if (jwtRegex.test(token)) return token;
    } catch {}
  }

  const match = raw.match(jwtRegex);
  if (match) return match[0];

  const preview = raw.slice(0, 120).replace(/\s+/g, " ");
  throw new Error(`Signin succeeded but no JWT found. content-type="${ct}". Preview: "${preview}"`);
}

export async function gql(query, variables = {}) {
  const jwt = getJwt();
  if (!jwt) throw new Error("Not logged in.");

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || `GraphQL HTTP error ${res.status}`;
    throw new Error(msg);
  }
  if (json?.errors?.length) throw new Error(json.errors[0].message);

  return json.data;
}