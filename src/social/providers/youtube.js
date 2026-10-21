const { request } = require("../../utils/http");

const RSS_URL = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

const CHANNEL_ID_RE = /"channelId":"(UC[\w-]{22})"/;
const CANONICAL_RE = /rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/;
const HANDLE_RE = /^@?[A-Za-z0-9._-]{1,100}$/;
const YT_HOST_RE = /^(?:www\.|m\.|music\.)?youtube\.com$/i;
const YT_HELP = "usa l'handle (@esempio), l'URL completo del canale o l'id UC…";
const decodeXml = (s) =>
  (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const truncate = (text, max = 300) => {
  const t = String(text || "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Pull `<tag>` values out of one RSS `<entry>` block. */
function parseEntry(block) {
  const videoId = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
  if (!videoId) return null;
  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: decodeXml(block.match(/<title>([\s\S]*?)<\/title>/)?.[1]) || "Video",
    description: truncate(decodeXml(block.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1])),
    author:
      decodeXml(block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1]) || "YouTube",
    image: block.match(/<media:thumbnail url="([^"]+)"/)?.[1] || null,
    timestamp: block.match(/<published>([^<]+)<\/published>/)?.[1] || null,
  };
}

module.exports = {
  key: "youtube",
  label: "YouTube",
  color: 0xff0000,
  interval: 180, // seconds between checks
  configured: () => true, // no credentials required

  /**
   * Accepts a channel URL (with or without scheme, incl. m./music./youtu.be),
   * a @handle, a bare handle, or a raw UC… channel id.
   * Canonical source is always the UC… channel id (RSS needs it).
   */
  async resolve(input) {
    const raw = String(input || "").trim();
    if (!raw) throw new Error("sorgente vuota");

    // Bare UC… id
    if (/^UC[\w-]{22}$/.test(raw)) return { source: raw, label: raw };

    // Pasted domain without scheme: "www.youtube.com/@x", "m.youtube.com/@x"
    let text = raw;
    if (!/^https?:\/\//i.test(text) && /^(?:www\.|m\.|music\.)?youtube\.com\//i.test(text)) {
      text = `https://${text}`;
    }

    let channelId = null;
    let pageUrl = null;
    let label = raw.replace(/^@/, "");

    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text);
      const parts = url.pathname.split("/").filter(Boolean);
      const head = parts[0] || "";

      if (url.hostname === "youtu.be") {
        // youtu.be holds video links; only @handle paths are usable
        if (!head.startsWith("@")) {
          throw new Error(`Quello è il link di un video, non di un canale. ${YT_HELP}`);
        }
        pageUrl = `https://www.youtube.com/${encodeURIComponent(head)}`;
      } else if (!YT_HOST_RE.test(url.hostname)) {
        throw new Error(`Quello non è un link YouTube. ${YT_HELP}`);
      } else if (head === "channel" && /^UC[\w-]{22}$/.test(parts[1] || "")) {
        channelId = parts[1];
      } else if (head) {
        // @handle, /c/name, /user/name, legacy custom URLs: the page's
        // canonical tag is the authoritative channel id (and filters out
        // non-channel pages safely).
        pageUrl = `https://www.youtube.com/${parts.map(encodeURIComponent).join("/")}`;
      } else {
        throw new Error(`Link generico di YouTube, non di un canale. ${YT_HELP}`);
      }
    } else {
      // Plain text → handle ("kurzgesagt" or "@kurzgesagt")
      const handle = raw.replace(/^@/, "");
      if (!HANDLE_RE.test(handle)) {
        throw new Error(`"${raw}" non è un handle valido. ${YT_HELP}`);
      }
      label = handle;
      pageUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    }

    if (!channelId) {
      const res = await request(pageUrl);
      if (res.status >= 200 && res.status < 400) {
        // Canonical link appears only on real channel pages.
        channelId =
          res.body.match(CANONICAL_RE)?.[1] || res.body.match(CHANNEL_ID_RE)?.[1];
      }
      // Legacy custom URLs sometimes still redirect better without the @.
      if (!channelId && pageUrl.includes("/@")) {
        const legacy = await request(pageUrl.replace("/@", "/"));
        if (legacy.status >= 200 && legacy.status < 400) {
          channelId =
            legacy.body.match(CANONICAL_RE)?.[1] || legacy.body.match(CHANNEL_ID_RE)?.[1];
        }
      }
      if (!channelId) {
        throw new Error(`Canale YouTube non trovato: "${label}". ${YT_HELP}`);
      }
    }

    return { source: channelId, label };
  },

  /**
   * @param {string} source channel id (UC…)
   * @param {string|null} lastItemId newest video already handled
   * @returns {Promise<{items: object[], currentId: string|null}>}
   */
  async check(source, lastItemId) {
    const res = await request(RSS_URL(source));
    if (res.status === 404) throw new Error("feed RSS inesistente (canale privato?)");
    if (res.status < 200 || res.status >= 300) throw new Error(`youtube http ${res.status}`);

    const entries = [...res.body.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => parseEntry(m[1]))
      .filter(Boolean);

    const currentId = entries[0]?.id || null;

    // First run: remember the newest item without flooding the channel.
    if (lastItemId === null || lastItemId === undefined) {
      return { items: [], currentId };
    }

    // Feed is newest-first: everything above the marker is new.
    const marker = entries.findIndex((e) => e.id === lastItemId);
    let fresh = marker === -1 ? entries : entries.slice(0, marker);
    if (fresh.length > 3) fresh = fresh.slice(0, 3); // cap after long downtime
    fresh.reverse(); // post oldest → newest

    return { items: fresh, currentId };
  },
};
