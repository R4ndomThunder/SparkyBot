const https = require("https");
const http = require("http");
const { URL } = require("url");

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Minimal HTTP client used by the social providers.
 * Follows up to 5 redirects (YouTube profile pages 302 to locale URLs).
 *
 * @returns {Promise<{status: number, body: string, headers: object}>}
 */
function request(url, { method = "GET", headers = {}, body = null, timeout = 10000 } = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method,
        headers: { "User-Agent": DEFAULT_UA, ...headers },
        timeout,
      },
      (res) => {
        const location = res.headers.location;
        if (location && res.statusCode >= 300 && res.statusCode < 400 && redirects < 5) {
          res.resume(); // discard the body, keep the socket healthy
          const next = new URL(location, parsed).href;
          resolve(request(next, { method, headers, body, timeout }, redirects + 1));
          return;
        }
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: raw, headers: res.headers })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** `request` + JSON.parse, with a helpful error on non-2xx or bad JSON. */
async function requestJson(url, opts = {}) {
  const res = await request(url, opts);
  if (res.status < 200 || res.status >= 300) {
    const snippet = res.body.slice(0, 200);
    const err = new Error(`http ${res.status}: ${snippet}`);
    err.status = res.status;
    throw err;
  }
  try {
    return JSON.parse(res.body);
  } catch {
    throw new Error(`invalid JSON from ${url}`);
  }
}

module.exports = { request, requestJson, DEFAULT_UA };
