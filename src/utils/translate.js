const https = require("https");
const http = require("http");
const { URL } = require("url");
const { detect, detectAll } = require("tinyld");

const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";
const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const request = (url, { timeout = 8000 } = {}) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        timeout,
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: raw }));
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });

/** Best-guess source language as ISO 639-1, or null when unknown. */
function detectLanguage(text) {
  try {
    const code = detect(text);
    return code ? code.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Best-guess as `{ lang, confidence }`, confidence in [0, 1]. */
function detectLanguageWithConfidence(text) {
  const results = detectAll(text) || [];
  if (!results.length) return { lang: null, confidence: 0 };
  const [top] = results;
  const total = results.reduce((sum, r) => sum + (r.accuracy || 0), 0) || 1;
  return {
    lang: top.lang ? top.lang.toLowerCase() : null,
    confidence: (top.accuracy || 0) / total,
  };
}

/** Split text into chunks of at most `size` chars, preferring sentence ends. */
function chunkText(text, size = 450) {
  if (text.length <= size) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let cut = -1;
    for (const marker of [".\n", "\n", ". ", "! ", "? ", "; ", ", "]) {
      const idx = rest.lastIndexOf(marker, size);
      if (idx > cut) cut = idx + marker.length;
    }
    if (cut <= 0) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

async function viaGoogle(text, from, to) {
  const url =
    `${GOOGLE_URL}?client=gtx&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await request(url);
  if (res.status !== 200) throw new Error(`google http ${res.status}`);
  const data = JSON.parse(res.body);
  const out = (data?.[0] ?? []).map((s) => s?.[0] ?? "").join("");
  if (!out) throw new Error("google empty");
  return { text: out, detected: data?.[2] || from };
}

async function viaMyMemory(text, from, to) {
  const params = new URLSearchParams({ q: text, langpair: `${from}|${to}` });
  // Optional: MyMemory allows a higher quota when a contact email is sent.
  if (process.env.TRANSLATE_EMAIL) params.set("de", process.env.TRANSLATE_EMAIL);
  const res = await request(`${MYMEMORY_URL}?${params.toString()}`);
  if (res.status !== 200) throw new Error(`mymemory http ${res.status}`);
  const data = JSON.parse(res.body);
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(data.responseDetails || "mymemory failed");
  }
  const out = data.responseData.translatedText;
  if (/MYMEMORY WARNING|INVALID SOURCE|QUOTA/i.test(out)) throw new Error(out);
  return { text: out, detected: from };
}

/**
 * Translate `text` into `targetLang` (ISO 639-1).
 *
 * The source language is detected locally (tinyld) so providers that need an
 * explicit source (MyMemory) can be used, with Google as an auto-detect
 * fallback. Providers are tried in order until one returns a usable result.
 *
 * @returns {Promise<{text: string, detected: string|null, provider: string}>}
 */
async function translate(text, targetLang) {
  const target = (targetLang || "en").toLowerCase();
  const { lang: detected, confidence } = detectLanguageWithConfidence(text);

  if (detected && detected === target) {
    return { text, detected, provider: "none" };
  }

  // A no-op output (source identical to input) usually means the source
  // language guess was wrong, so treat it as a failure and try the next one.
  const accept = (name) => async (promise) => {
    const result = await promise;
    const trimmed = text.trim();
    if (
      trimmed.length > 4 &&
      result.text.trim() === trimmed &&
      detected !== target
    ) {
      throw new Error(`${name}: no-op result`);
    }
    return result;
  };

  const providers = [];
  if (detected) {
    providers.push(["mymemory", () => accept("mymemory")(viaMyMemory(text, detected, target))]);
    providers.push(["google", () => accept("google")(viaGoogle(text, detected, target))]);
  }
  providers.push(["google-auto", () => accept("google-auto")(viaGoogle(text, "auto", target))]);
  if (detected) {
    providers.push([
      "mymemory-chunks",
      async () => {
        const parts = chunkText(text, 450);
        const results = await Promise.all(
          parts.map((p) => viaMyMemory(p, detected, target))
        );
        return accept("mymemory-chunks")(
          Promise.resolve({
            text: results.map((r) => r.text).join(" "),
            detected,
          })
        );
      },
    ]);
  }

  let lastError;
  for (const [name, run] of providers) {
    try {
      const result = await run();
      return { ...result, provider: name, confidence, source: detected };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("no provider available");
}

module.exports = { translate, detectLanguage, detectLanguageWithConfidence };
