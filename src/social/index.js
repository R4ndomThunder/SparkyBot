const socialDb = require("../db/social");
const { sendItem, endLiveMessage } = require("./post");

const providers = {};
for (const key of ["youtube", "bluesky", "twitch", "itchio"]) {
  const provider = require(`./providers/${key}`);
  providers[key] = provider;
}

const TICK_MS = 30_000;
const STARTUP_DELAY_MS = 5_000;
const PROVIDER_PAUSE_MS = 500; // pause between feeds to stay polite with the APIs

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);

let client = null;
let timer = null;
let ticking = false;

function getProvider(platform) {
  return providers[platform] || null;
}

function listProviders() {
  return Object.values(providers);
}

/**
 * Run one poll for a feed: provider check → post new items → persist state.
 *
 * @param {object} feed social_feeds row
 * @param {object} [opts]
 * @param {boolean} [opts.post=false] actually send to Discord (false = dry run)
 * @param {boolean} [opts.persist=true] store the new marker/check timestamps
 * @param {string|null} [opts.lastItemId] override the stored marker (probe mode)
 * @returns {Promise<{items: object[], currentId: string|null}>}
 */
async function checkFeed(feed, { post = false, persist = true, lastItemId } = {}) {
  const provider = getProvider(feed.platform);
  if (!provider) throw new Error(`piattaforma sconosciuta: ${feed.platform}`);
  if (!provider.configured()) {
    const err = new Error(`${provider.label}: credenziali mancanti in .env`);
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const marker = lastItemId !== undefined ? lastItemId : feed.last_item_id;
  const { items, currentId } = await provider.check(feed.source, marker, feed);

  // Twitch: the previous live (the stored marker) is over — update its notification.
  if (post && provider.key === "twitch" && marker && currentId !== marker) {
    try {
      if (await endLiveMessage(client, feed)) {
        console.log(`[social] live conclusa (feed ${feed.id}): notifica aggiornata`);
      }
    } catch (err) {
      console.error(`[social] end-live edit failed for feed ${feed.id}`, err);
    }
    socialDb.setLiveMessage(feed.id, null);
  }

  if (post && items.length) {
    for (const item of items) {
      const sent = await sendItem(client, feed, item, provider);
      // Remember the live notification so it can be edited when the stream ends.
      if (provider.key === "twitch" && sent) socialDb.setLiveMessage(feed.id, sent.id);
    }
  }

  if (persist) socialDb.markSuccess(feed.id, currentId, now() + provider.interval);
  return { items, currentId };
}

/**
 * Fetch the newest items without touching state or Discord.
 * Used by `/social test`.
 */
async function probeFeed(feed) {
  const provider = getProvider(feed.platform);
  if (!provider) throw new Error(`piattaforma sconosciuta: ${feed.platform}`);
  if (!provider.configured()) {
    const err = new Error(`${provider.label}: credenziali mancanti in .env`);
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  // A marker that can never match an item id → providers return the newest ones.
  return provider.check(feed.source, `probe:${feed.id}:${Date.now()}`, feed);
}

async function tick() {
  if (ticking || !client) return;
  ticking = true;
  try {
    const stamp = now();
    const due = socialDb.dueFeeds().filter((f) => !f.next_check || f.next_check <= stamp);
    for (const feed of due) {
      try {
        const { items } = await checkFeed(feed, { post: true });
        if (items.length) {
          console.log(`[social] ${feed.platform}:${feed.source} → ${items.length} nuovi elementi`);
        }
      } catch (err) {
        socialDb.markFailure(feed.id, err);
        console.error(`[social] ${feed.platform}:${feed.source} ${err.code || ""} ${err.message}`.trim());
      }
      await sleep(PROVIDER_PAUSE_MS);
    }
  } finally {
    ticking = false;
  }
}

/** Start the background poller. Safe to call once, after login. */
function startScheduler(botClient) {
  if (timer) return;
  client = botClient;
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
  setTimeout(tick, STARTUP_DELAY_MS).unref?.();
  console.log(`[social] scheduler started (${Object.keys(providers).join(", ")})`);
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Force a poll right now without posting or touching the stored state. */
async function runNow(feed) {
  return checkFeed(feed, { post: false, persist: false });
}

module.exports = {
  providers,
  getProvider,
  listProviders,
  startScheduler,
  stopScheduler,
  checkFeed,
  probeFeed,
  runNow,
  tick,
};
