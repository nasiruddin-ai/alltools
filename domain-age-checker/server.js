// Domain Age Checker - tiny server with no dependencies.
// Run with:  node server.js   (or double-click Start.bat)
//
// It does two things:
//   1. Serves index.html (the page you see in the browser)
//   2. Answers /api/age?domain=example.com by asking the public RDAP
//      registry for the domain's registration date.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HTML_FILE = path.join(__dirname, "index.html");

// ---------- helpers ----------

// Turn whatever the user typed ("https://www.Example.com/page?x=1") into "example.com"
function cleanDomain(input) {
  let s = String(input || "").trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, ""); // remove http:// or https://
  s = s.split("/")[0].split("?")[0].split("#")[0]; // remove path, query, hash
  s = s.split("@").pop(); // remove user@ if someone pasted an email
  s = s.split(":")[0]; // remove :port
  s = s.replace(/^www\./, "");
  s = s.replace(/\.+$/, ""); // remove trailing dots
  return s;
}

function looksLikeDomain(d) {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(d);
}

const USER_AGENT = "DomainAgeChecker/1.0 (local tool)";

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json, application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// IANA publishes which RDAP server handles each top-level domain.
// We load that list once and keep it in memory as a fallback to rdap.org.
let bootstrapCache = null;
let bootstrapLoadedAt = 0;
async function rdapBaseForTld(tld) {
  const oneDay = 86400000;
  if (!bootstrapCache || Date.now() - bootstrapLoadedAt > oneDay) {
    try {
      const { status, data } = await fetchJson("https://data.iana.org/rdap/dns.json");
      if (status === 200 && data && Array.isArray(data.services)) {
        bootstrapCache = data.services;
        bootstrapLoadedAt = Date.now();
      }
    } catch (_) {
      /* keep old cache if any */
    }
  }
  if (!bootstrapCache) return null;
  for (const [tlds, urls] of bootstrapCache) {
    if (tlds.includes(tld) && urls.length) {
      const https = urls.find((u) => u.startsWith("https://")) || urls[0];
      return https.endsWith("/") ? https : https + "/";
    }
  }
  return null;
}

// Ask RDAP for one exact name. Tries rdap.org first, then the registry directly.
async function rdapLookup(domain) {
  let result = { status: 0, data: null };
  try {
    result = await fetchJson("https://rdap.org/domain/" + encodeURIComponent(domain));
    if (result.status === 200 || result.status === 404) return result;
  } catch (_) {
    /* fall through to direct lookup */
  }

  const tld = domain.split(".").pop();
  const base = await rdapBaseForTld(tld);
  if (!base) return result.status ? result : { status: 404, data: null };
  return fetchJson(base + "domain/" + encodeURIComponent(domain));
}

// Try the full host first, then drop subdomains: blog.shop.example.com -> shop.example.com -> example.com
async function findDomainRecord(domain) {
  const labels = domain.split(".");
  let lastStatus = 0;
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".");
    const { status, data } = await rdapLookup(candidate);
    lastStatus = status;
    if (status === 200 && data) return { domain: candidate, data };
    if (status !== 404) break; // 429 rate-limit, 5xx etc. - stop trying
  }
  return { domain, data: null, status: lastStatus };
}

function pickEvent(events, action) {
  if (!Array.isArray(events)) return null;
  const hit = events.find((e) => e && e.eventAction === action && e.eventDate);
  return hit ? hit.eventDate : null;
}

function registrarName(entities) {
  if (!Array.isArray(entities)) return null;
  const reg = entities.find((e) => Array.isArray(e.roles) && e.roles.includes("registrar"));
  if (!reg) return null;
  // vCard format: ["vcard", [["version",{},"text","4.0"], ["fn",{},"text","Registrar Name"], ...]]
  const card = reg.vcardArray && reg.vcardArray[1];
  if (Array.isArray(card)) {
    const fn = card.find((f) => f[0] === "fn");
    if (fn && fn[3]) return fn[3];
  }
  return reg.handle || null;
}

function ageBreakdown(fromIso) {
  const from = new Date(fromIso);
  const now = new Date();
  if (isNaN(from.getTime())) return null;

  let years = now.getUTCFullYear() - from.getUTCFullYear();
  let months = now.getUTCMonth() - from.getUTCMonth();
  let days = now.getUTCDate() - from.getUTCDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    days += prevMonth.getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.floor((now - from) / 86400000);
  return { years, months, days, totalDays };
}

// ---------- API ----------

async function handleAge(req, res, url) {
  const raw = url.searchParams.get("domain");
  const domain = cleanDomain(raw);

  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(obj));
  };

  if (!domain) return send(400, { ok: false, error: "Please enter a domain name." });
  if (!looksLikeDomain(domain)) return send(400, { ok: false, error: `"${domain}" does not look like a valid domain name.` });

  try {
    const found = await findDomainRecord(domain);
    if (!found.data) {
      if (found.status === 404) return send(404, { ok: false, domain, error: "No registration record found. The domain may be unregistered, or its registry does not publish RDAP data." });
      if (found.status === 429) return send(429, { ok: false, domain, error: "The registry is rate-limiting lookups. Please wait a minute and try again." });
      return send(502, { ok: false, domain, error: `The registry returned an unexpected response (${found.status}).` });
    }

    const d = found.data;
    const registered = pickEvent(d.events, "registration");
    const expires = pickEvent(d.events, "expiration");
    const updated = pickEvent(d.events, "last changed");

    return send(200, {
      ok: true,
      domain: found.domain,
      queried: domain,
      registered,
      expires,
      updated,
      registrar: registrarName(d.entities),
      status: Array.isArray(d.status) ? d.status : [],
      age: registered ? ageBreakdown(registered) : null,
      note: registered ? null : "This registry does not publish the registration date.",
    });
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "The registry took too long to respond. Please try again." : "Lookup failed: " + (err && err.message ? err.message : "unknown error");
    return send(502, { ok: false, domain, error: msg });
  }
}

// ---------- server ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/age") return handleAge(req, res, url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    fs.readFile(HTML_FILE, (err, buf) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("index.html is missing next to server.js");
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buf);
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  Domain Age Checker is running.");
  console.log("  Open this in your browser:  http://localhost:" + PORT);
  console.log("  Press Ctrl+C in this window to stop it.");
  console.log("");
});
