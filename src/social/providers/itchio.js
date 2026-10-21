const { request } = require("../../utils/http");

const PROFILE_URL = (username) => `https://${encodeURIComponent(username)}.itch.io/`;
const API_PROFILE = "https://api.itch.io/profile";
const API_GAMES = "https://api.itch.io/profile/games";
const KEY_HELP = "creala su itch.io/api-keys";
const SRC_HELP = "usa `me` (la tua API key) o il profilo `utente.itch.io`";

const decodeHtml = (s) =>
  (s || "")
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const stripTags = (s) => decodeHtml(String(s || "").replace(/<[^>]+>/g, "")).trim();

const httpsUrl = (url) => String(url || "").replace(/^http:\/\//, "https://");

/**
 * Scrape a creator profile page (no credentials needed).
 * Each `game_cell` block holds the cover thumb and a title anchor with a
 * stable `data-label="game:<id>:title"` attribute used as the item id.
 */
async function fetchProfileEntries(username) {
  const res = await request(PROFILE_URL(username));
  if (res.status === 404) {
    throw new Error(`Profilo Itch.io inesistente: "${username}". ${SRC_HELP}`);
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`itch.io http ${res.status}`);

  // itch.io serves the cell div with varying attribute order
  // (`class="game_cell …" data-game_id=…` or the reverse): match on the
  // class attribute wherever it appears inside the opening tag.
  const blocks = res.body.split(/<div[^>]*class="[^"]*\bgame_cell\b[^"]*"/).slice(1);
  const entries = [];
  for (const block of blocks) {
    const anchor = block.match(/<a\s([^>]*data-label="game:\d+:title"[^>]*)>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const id = anchor[1].match(/data-label="game:(\d+):title"/)?.[1];
    const url = anchor[1].match(/href="([^"]+)"/)?.[1];
    if (!id || !url) continue;
    const image =
      block.match(
        /(?:data-lazy_src|data-src|src)="(https:\/\/img\.itch\.zone\/[^"]+)"/
      )?.[1] || null;
    entries.push({
      id,
      url: httpsUrl(url),
      title: stripTags(anchor[2]) || "Gioco",
      description: stripTags(
        block.match(/<div[^>]*class="game_text"[^>]*>([\s\S]*?)<\/div>/)?.[1]
      ),
      author: `@${username}`,
      image,
      timestamp: null, // profile cells carry no dates
    });
  }
  if (!entries.length && !res.body.includes('data-page_name="user"')) {
    throw new Error(`Non sembra un profilo Itch.io: "${username}". ${SRC_HELP}`);
  }
  return entries;
}

/** Fetch the creator's games through the official API (per-feed key). */
async function fetchApiEntries(username, apiKey) {
  const res = await request(API_GAMES, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`API key Itch.io non valida o revocata (${KEY_HELP}).`);
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`itch.io api http ${res.status}`);

  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    throw new Error("Risposta non valida da api.itch.io");
  }
  if (Array.isArray(data.errors) && data.errors.length) {
    throw new Error(`API key Itch.io non valida o revocata (${KEY_HELP}).`);
  }

  return (data.games || [])
    .filter((g) => g.published)
    .sort((a, b) => String(b.published_at || "").localeCompare(String(a.published_at || "")))
    .map((g) => ({
      id: String(g.id),
      url: httpsUrl(g.url),
      title: g.title || "Gioco",
      description: g.short_text || null,
      author: `@${username}`,
      image: httpsUrl(g.cover_url),
      timestamp: g.published_at || null,
    }));
}

module.exports = {
  key: "itchio",
  label: "Itch.io",
  color: 0xfa5c5c,
  interval: 300, // seconds between checks
  configured: () => true, // API key is per-feed (BYO), scraping needs none
  needsApiKey: true, // `/social add` collects the key through a modal when sorgente = "me"

  /**
   * Scraping mode: accepts a profile URL (with or without scheme) or a
   * bare username. The canonical source is always the lowercase username.
   */
  async resolve(input) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("sorgente vuota");
    if (/^me$/i.test(raw)) {
      throw new Error(`Usa "me" come sorgente di /social add per inserire la tua API key (${KEY_HELP}).`);
    }

    let username = raw;
    if (/^https?:\/\//i.test(raw) || raw.includes(".")) {
      const asUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const url = new URL(asUrl);
      const match = url.hostname.match(/^([A-Za-z0-9_-]+)\.itch\.io$/i);
      if (!match) {
        throw new Error(`Quello non è un profilo Itch.io. ${SRC_HELP}`);
      }
      const path = url.pathname.replace(/\/+$/, "");
      if (path) {
        throw new Error(
          "Quello è il link di un gioco, non di un profilo: usa l'URL del creatore (`utente.itch.io`)."
        );
      }
      username = match[1];
    }
    if (!/^[\w-]{1,60}$/.test(username)) {
      throw new Error(`"${raw}" non è un username Itch.io valido. ${SRC_HELP}`);
    }

    username = username.toLowerCase();
    await fetchProfileEntries(username); // validates the profile exists
    return { source: username, label: `@${username}` };
  },

  /**
   * API-key mode: validates the key against the official API and returns the
   * account it belongs to. `apiKey` is persisted on the feed row (never logged).
   */
  async resolveKey(apiKey) {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("API key vuota");

    const res = await request(API_PROFILE, { headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`API key Itch.io non valida o revocata (${KEY_HELP}).`);
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`itch.io api http ${res.status}`);

    let data;
    try {
      data = JSON.parse(res.body);
    } catch {
      throw new Error("Risposta non valida da api.itch.io");
    }
    const username = String(data?.user?.username || "").trim().toLowerCase();
    if (!username) throw new Error(`API key Itch.io non valida o revocata (${KEY_HELP}).`);

    return { source: username, label: `@${username}`, apiKey: key };
  },

  /**
   * @param {string} source lowercase username
   * @param {string|null} lastItemId serialized set of seen game ids ("1,2,3")
   * @param {object} [feed] feed row (carries api_key for API mode)
   * @returns {Promise<{items: object[], currentId: string|null}>}
   */
  async check(source, lastItemId, feed) {
    const apiKey = feed?.api_key || null;
    const entries = apiKey
      ? await fetchApiEntries(source, apiKey)
      : await fetchProfileEntries(source);

    const currentId = entries.length ? entries.map((e) => e.id).join(",") : null;

    // First run: remember the whole set without dumping history.
    if (lastItemId === null || lastItemId === undefined) {
      return { items: [], currentId };
    }

    // `/social test` probe marker: preview the newest entries, never match.
    if (String(lastItemId).startsWith("probe:")) {
      return { items: entries.slice(0, 3).reverse(), currentId };
    }

    // Set difference: any game id not seen yet is a new release.
    const seen = new Set(String(lastItemId).split(",").filter(Boolean));
    let fresh = entries.filter((e) => !seen.has(e.id));
    if (fresh.length > 3) fresh = fresh.slice(0, 3); // cap after long downtime
    fresh.reverse(); // post oldest → newest

    return { items: fresh, currentId };
  },
};
