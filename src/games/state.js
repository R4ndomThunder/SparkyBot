/**
 * In-memory game state with TTL.
 *
 * Every live game lives here, keyed by a short random id embedded in the
 * component customIds (`rps:a1b2c3:rock`). When a state expires it is swept
 * away — clicking a stale button then just yields "scaduta". An optional
 * `onExpire` hook runs exactly once so escrowed bets can be refunded.
 */

const stores = [];
const SWEEP_MS = 30_000;

const randomId = () => Math.random().toString(36).slice(2, 8);

/**
 * @param {string} name       store label (used in logs)
 * @param {number} [ttlMs]    default lifetime of a state (renewed with touch())
 * @returns {object} store
 */
function createStore(name, ttlMs = 120_000) {
  const map = new Map();

  const store = {
    name,

    /** Create a state; returns the entry (with its generated `id`). */
    create(data = {}) {
      let id = randomId();
      while (map.has(id)) id = randomId();
      const entry = { ...data, id, expires: Date.now() + ttlMs };
      map.set(id, entry);
      return entry;
    },

    /** Fetch a live state (and drop it when expired). */
    get(id) {
      const entry = map.get(id);
      if (!entry) return null;
      if (entry.expires <= Date.now()) {
        map.delete(id);
        expire(entry);
        return null;
      }
      return entry;
    },

    /** Merge fields into a live state (no-op when missing/expired). */
    update(id, patch) {
      const entry = store.get(id);
      if (!entry) return null;
      Object.assign(entry, patch);
      return entry;
    },

    /** Extend the lifetime after player activity. */
    touch(id, extraTtlMs = ttlMs) {
      const entry = map.get(id);
      if (entry && entry.expires > Date.now()) {
        entry.expires = Date.now() + extraTtlMs;
        return true;
      }
      return false;
    },

    delete(id) {
      return map.delete(id);
    },

    size: () => map.size,

    /** Drop expired states now (the interval does this automatically). */
    sweep() {
      const stamp = Date.now();
      for (const [id, entry] of map) {
        if (entry.expires <= stamp) {
          map.delete(id);
          expire(entry);
        }
      }
    },
  };

  function expire(entry) {
    if (entry.expired) return;
    entry.expired = true;
    try {
      entry.onExpire?.(entry);
    } catch (err) {
      console.error(`[games] onExpire error in store ${name}`, err);
    }
  }

  stores.push(store);
  return store;
}

const sweepTimer = setInterval(() => {
  for (const store of stores) store.sweep();
}, SWEEP_MS);
sweepTimer.unref?.();

/** Sweep every store right now (exposed for tests). */
function sweepAll() {
  for (const store of stores) store.sweep();
}

module.exports = { createStore, sweepAll };
