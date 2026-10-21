const db = require("./index");

const START_BALANCE = 500;
const DAILY_AMOUNT = 150;
const DAILY_COOLDOWN = 24 * 3600; // seconds
const WORK_MIN = 20;
const WORK_MAX = 80;
const WORK_COOLDOWN = 60 * 60; // seconds

const now = () => Math.floor(Date.now() / 1000);

const stmts = {
  ensure: db.prepare(
    "INSERT OR IGNORE INTO wallets (guild_id, user_id, balance) VALUES (?, ?, ?)"
  ),
  get: db.prepare("SELECT * FROM wallets WHERE guild_id = ? AND user_id = ?"),
  credit: db.prepare(
    "UPDATE wallets SET balance = balance + ?, updated_at = unixepoch() WHERE guild_id = ? AND user_id = ?"
  ),
  debitIfPossible: db.prepare(
    "UPDATE wallets SET balance = balance - ?, updated_at = unixepoch() WHERE guild_id = ? AND user_id = ? AND balance >= ?"
  ),
  setDaily: db.prepare(
    "UPDATE wallets SET daily_at = ?, updated_at = unixepoch() WHERE guild_id = ? AND user_id = ?"
  ),
  setWork: db.prepare(
    "UPDATE wallets SET work_at = ?, updated_at = unixepoch() WHERE guild_id = ? AND user_id = ?"
  ),
  log: db.prepare(
    `INSERT INTO economy_log (guild_id, user_id, delta, reason) VALUES (?, ?, ?, ?)`
  ),
  recent: db.prepare(
    `SELECT * FROM economy_log WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT ?`
  ),
  top: db.prepare(
    "SELECT * FROM wallets WHERE guild_id = ? ORDER BY balance DESC, user_id LIMIT ?"
  ),
  deleteGuild: db.prepare("DELETE FROM wallets WHERE guild_id = ?"),
  deleteGuildLog: db.prepare("DELETE FROM economy_log WHERE guild_id = ?"),
};

/** Wallet row, created on first use with the starting balance. */
function getOrCreate(guildId, userId) {
  stmts.ensure.run(guildId, userId, START_BALANCE);
  return stmts.get.get(guildId, userId);
}

/** Add credits (ledger entry). Returns the new balance. */
const credit = db.transaction((guildId, userId, delta, reason) => {
  if (!Number.isInteger(delta) || delta <= 0) throw new Error("credit delta must be > 0");
  stmts.ensure.run(guildId, userId, START_BALANCE);
  stmts.credit.run(delta, guildId, userId);
  stmts.log.run(guildId, userId, delta, reason || null);
  return stmts.get.get(guildId, userId).balance;
});

/**
 * Remove credits if the balance allows it (never negative).
 * Returns the new balance, or null when funds are insufficient.
 */
const debit = db.transaction((guildId, userId, delta, reason) => {
  if (!Number.isInteger(delta) || delta <= 0) throw new Error("debit delta must be > 0");
  stmts.ensure.run(guildId, userId, START_BALANCE);
  const res = stmts.debitIfPossible.run(delta, guildId, userId, delta);
  if (!res.changes) return null;
  stmts.log.run(guildId, userId, -delta, reason || null);
  return stmts.get.get(guildId, userId).balance;
});

/** Move credits between two wallets. Returns { balance } of sender, or null. */
const transfer = db.transaction((guildId, fromId, toId, amount, reason) => {
  const taken = debit(guildId, fromId, amount, reason || "trasferimento");
  if (taken === null) return null;
  credit(guildId, toId, amount, reason || "trasferimento");
  return { balance: taken };
});

/** Claim the daily reward; blocked inside the 24h cooldown. */
const claimDaily = db.transaction((guildId, userId, amount = DAILY_AMOUNT) => {
  const wallet = getOrCreate(guildId, userId);
  const ts = now();
  if (wallet.daily_at && ts - wallet.daily_at < DAILY_COOLDOWN) {
    return { ok: false, retryAt: wallet.daily_at + DAILY_COOLDOWN, balance: wallet.balance };
  }
  stmts.credit.run(amount, guildId, userId);
  stmts.setDaily.run(ts, guildId, userId);
  stmts.log.run(guildId, userId, amount, "daily");
  return { ok: true, amount, balance: stmts.get.get(guildId, userId).balance };
});

/** Claim the work reward (amount picked by the caller); blocked inside the 1h cooldown. */
const claimWork = db.transaction((guildId, userId, amount) => {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("work amount must be > 0");
  const wallet = getOrCreate(guildId, userId);
  const ts = now();
  if (wallet.work_at && ts - wallet.work_at < WORK_COOLDOWN) {
    return { ok: false, retryAt: wallet.work_at + WORK_COOLDOWN, balance: wallet.balance };
  }
  stmts.credit.run(amount, guildId, userId);
  stmts.setWork.run(ts, guildId, userId);
  stmts.log.run(guildId, userId, amount, "lavoro");
  return { ok: true, amount, balance: stmts.get.get(guildId, userId).balance };
});

function recentMovements(guildId, userId, limit = 10) {
  return stmts.recent.all(guildId, userId, limit);
}

function topBalances(guildId, limit = 10) {
  return stmts.top.all(guildId, limit);
}

function removeEconomyByGuild(guildId) {
  stmts.deleteGuild.run(guildId);
  return stmts.deleteGuildLog.run(guildId).changes;
}

module.exports = {
  START_BALANCE,
  DAILY_AMOUNT,
  WORK_MIN,
  WORK_MAX,
  DAILY_COOLDOWN,
  WORK_COOLDOWN,
  getOrCreate,
  credit,
  debit,
  transfer,
  claimDaily,
  claimWork,
  recentMovements,
  topBalances,
  removeEconomyByGuild,
};
