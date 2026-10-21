const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "sparky.db"));
db.pragma("journal_mode = WAL");

// Base tables — extend as features are added.
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    locale TEXT DEFAULT 'en',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Join-to-Create: the "hub" voice channel that spawns temporary channels.
  CREATE TABLE IF NOT EXISTS jtc_config (
    guild_id TEXT PRIMARY KEY,
    hub_channel_id TEXT NOT NULL,
    category_id TEXT,
    name_template TEXT NOT NULL DEFAULT '{user}''s channel',
    user_limit INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  -- Temporary voice channels currently alive, with their owner.
  CREATE TABLE IF NOT EXISTS jtc_channels (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  -- Social feeds: one row per watched account posting into a Discord channel.
  CREATE TABLE IF NOT EXISTS social_feeds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    source TEXT NOT NULL,               -- canonical id (resolved from user input)
    source_label TEXT,                  -- human readable name for listings
    mention_role_id TEXT,               -- optional role pinged on new items
    custom_message TEXT,                -- optional custom text posted with each item
    api_key TEXT,                       -- Itch.io: per-feed API key (BYO, never logged)
    live_message_id TEXT,               -- Twitch: message of the current live notification
    last_item_id TEXT,                  -- newest item already handled (baseline)
    enabled INTEGER NOT NULL DEFAULT 1,
    failures INTEGER NOT NULL DEFAULT 0,
    last_checked INTEGER,
    next_check INTEGER,
    last_error TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    UNIQUE (guild_id, platform, source, channel_id)
  );

  -- Minigames: per-user results for each game, per guild.
  CREATE TABLE IF NOT EXISTS game_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    plays INTEGER NOT NULL DEFAULT 0,
    best INTEGER,                       -- per-game record (max, or min ms for corsa)
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id, game)
  );

  -- Economy: one wallet per user per guild (starting balance 500).
  CREATE TABLE IF NOT EXISTS wallets (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 500,
    daily_at INTEGER,                   -- last daily claim (unix seconds)
    work_at INTEGER,                    -- last work claim (unix seconds)
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, user_id)
  );

  -- Economy: ledger of every movement (for /economia movimenti + debugging).
  CREATE TABLE IF NOT EXISTS economy_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delta INTEGER NOT NULL,
    reason TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_economy_log_user
    ON economy_log (guild_id, user_id, id DESC);
`);

// Migrations for columns added after a table was first created.
const socialColumns = db.prepare("PRAGMA table_info(social_feeds)").all().map((c) => c.name);
if (!socialColumns.includes("custom_message")) {
  db.exec("ALTER TABLE social_feeds ADD COLUMN custom_message TEXT");
}
if (!socialColumns.includes("live_message_id")) {
  db.exec("ALTER TABLE social_feeds ADD COLUMN live_message_id TEXT");
}
if (!socialColumns.includes("api_key")) {
  db.exec("ALTER TABLE social_feeds ADD COLUMN api_key TEXT");
}

module.exports = db;
