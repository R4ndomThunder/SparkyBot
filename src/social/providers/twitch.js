const { request, requestJson } = require("../../utils/http");

const HELIX = "https://api.twitch.tv/helix";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";

let tokenCache = { token: null, expiresAt: 0 };

function credentials() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const err = new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET mancanti in .env");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  return { clientId, clientSecret };
}

/** Client-credentials token, cached until shortly before expiry. */
async function getToken() {
  const { clientId, clientSecret } = credentials();
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const data = await requestJson(
    `${TOKEN_URL}?client_id=${encodeURIComponent(clientId)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
    { method: "POST" }
  );
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

async function helix(path) {
  const { clientId } = credentials();
  const token = await getToken();
  return requestJson(`${HELIX}${path}`, {
    headers: {
      "Client-Id": clientId,
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Normalize `twitch.tv/name`, `@name`, or a plain login. */
function parseLogin(input) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("sorgente vuota");
  const cleaned = raw
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^twitch\.tv\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  if (!/^[a-z0-9_]{3,25}$/.test(cleaned)) {
    throw new Error("login Twitch non valido (3-25 caratteri, a-z 0-9 _)");
  }
  return cleaned;
}

module.exports = {
  key: "twitch",
  label: "Twitch",
  color: 0x9146ff,
  interval: 60,
  configured: () => Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),

  async resolve(input) {
    const login = parseLogin(input);
    const data = await helix(`/users?login=${encodeURIComponent(login)}`);
    const user = data.data?.[0];
    if (!user) throw new Error(`canale Twitch inesistente: \`${login}\``);
    return { source: user.login, label: user.display_name || user.login };
  },

  /**
   * Live status for a channel.
   *
   * - offline → `{ items: [], currentId: null }` (clears the marker, so the
   *   next live triggers a fresh notification)
   * - live with a new stream id → one item ("live iniziata")
   * - same stream id as `lastItemId` → nothing to do
   * - live on first run → posts the current live (it *is* new to the feed)
   */
  async check(source, lastItemId) {
    const data = await helix(`/streams?user_login=${encodeURIComponent(source)}`);
    const stream = data.data?.[0];

    if (!stream) return { items: [], currentId: null };
    if (stream.id === lastItemId) return { items: [], currentId: stream.id };

    const started = new Date(stream.started_at);
    return {
      currentId: stream.id,
      items: [
        {
          id: stream.id,
          url: `https://twitch.tv/${source}`,
          title: `${stream.user_name} è in live`,
          description: stream.title?.trim() || "Nessuna descrizione",
          author: stream.user_name || source,
          image: (stream.thumbnail_url || "")
            .replace("{width}", "1280")
            .replace("{height}", "720"),
          timestamp: Number.isNaN(started.getTime()) ? null : started,
          fields: [
            {
              name: "Gioco",
              value: stream.game_name || "—",
              inline: true,
            },
            {
              name: "Spettatori",
              value: Number(stream.viewer_count || 0).toLocaleString("it-IT"),
              inline: true,
            },
            {
              name: "Lingua",
              value: (stream.language || "—").toUpperCase(),
              inline: true,
            },
          ],
        },
      ],
    };
  },

  // Exposed for tests/diagnostics.
  _resetTokenCache: () => {
    tokenCache = { token: null, expiresAt: 0 };
  },
  _request: request,
};
