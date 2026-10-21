/**
 * Bet helpers on top of the wallet ledger.
 *
 * PvP stakes are escrowed: both players pay when the challenge is accepted,
 * the winner takes the pot, draws/abandonments are refunded. Compensation is
 * synchronous (better-sqlite3), so a partial failure can never leak credits.
 */

const econ = require("../db/economy");

/**
 * Collect `stake` from every player (all-or-nothing).
 * @returns {{ok:true}|{ok:false, userId:string}} failed userId when someone can't pay
 */
function escrow(guildId, userIds, stake, reason = "posta") {
  if (stake <= 0) return { ok: true };
  const paid = [];
  for (const userId of userIds) {
    const balance = econ.debit(guildId, userId, stake, reason);
    if (balance === null) {
      for (const done of paid) econ.credit(guildId, done, stake, `rimborso: ${reason}`);
      return { ok: false, userId };
    }
    paid.push(userId);
  }
  return { ok: true };
}

/** Give every player their stake back (challenge declined/expired). */
function refund(guildId, userIds, stake, reason = "rimborso posta") {
  if (stake <= 0) return;
  for (const userId of userIds) econ.credit(guildId, userId, stake, reason);
}

/**
 * Pay the pot to the winner after a settled PvP game.
 * (Escrowed stakes are already out of both wallets.)
 */
function settlePvp(guildId, winnerId, userIds, stake, reason = "vincita posta") {
  if (stake <= 0) return;
  econ.credit(guildId, winnerId, stake * userIds.length, reason);
}

/** True when the user can afford the stake (used before issuing a challenge). */
function canAfford(guildId, userId, stake) {
  if (stake <= 0) return true;
  return econ.getOrCreate(guildId, userId).balance >= stake;
}

module.exports = { escrow, refund, settlePvp, canAfford };
