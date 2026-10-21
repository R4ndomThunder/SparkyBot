const db = require("./index");

const stmts = {
  get: db.prepare("SELECT * FROM game_stats WHERE guild_id = ? AND user_id = ? AND game = ?"),
  insert: db.prepare(`
    INSERT INTO game_stats (guild_id, user_id, game, wins, losses, draws, plays, best)
    VALUES (@guild_id, @user_id, @game, @wins, @losses, @draws, 1, @best)
  `),
  topGame: db.prepare(`
    SELECT * FROM game_stats
    WHERE guild_id = ? AND game = ?
    ORDER BY wins DESC, plays DESC, user_id
    LIMIT ?
  `),
  topGameByBest: db.prepare(`
    SELECT * FROM game_stats
    WHERE guild_id = ? AND game = ? AND best IS NOT NULL
    ORDER BY best ASC, wins DESC, user_id
    LIMIT ?
  `),
  topOverall: db.prepare(`
    SELECT user_id,
           SUM(wins)   AS wins,
           SUM(losses) AS losses,
           SUM(draws)  AS draws,
           SUM(plays)  AS plays
    FROM game_stats
    WHERE guild_id = ?
    GROUP BY user_id
    ORDER BY wins DESC, plays DESC, user_id
    LIMIT ?
  `),
  byUser: db.prepare(
    "SELECT * FROM game_stats WHERE guild_id = ? AND user_id = ? ORDER BY wins DESC"
  ),
  deleteGuild: db.prepare("DELETE FROM game_stats WHERE guild_id = ?"),
};

/**
 * Record the result of one finished game for one user.
 *
 * @param {object} opts
 * @param {string} opts.guildId
 * @param {string} opts.userId
 * @param {string} opts.game    machine name (rps, tris, slots, corsa, blackjack)
 * @param {"win"|"loss"|"draw"} opts.result
 * @param {number|null} [opts.score]  per-game record value to consider
 * @param {"higher"|"lower"} [opts.better="higher"]  corsa keeps the LOWEST ms
 */
const recordResult = db.transaction(
  ({ guildId, userId, game, result, score = null, better = "higher" }) => {
    const row = stmts.get.get(guildId, userId, game);
    const now = Math.floor(Date.now() / 1000);

    if (!row) {
      stmts.insert.run({
        guild_id: guildId,
        user_id: userId,
        game,
        wins: result === "win" ? 1 : 0,
        losses: result === "loss" ? 1 : 0,
        draws: result === "draw" ? 1 : 0,
        best: score,
      });
      return stmts.get.get(guildId, userId, game);
    }

    const wins = row.wins + (result === "win" ? 1 : 0);
    const losses = row.losses + (result === "loss" ? 1 : 0);
    const draws = row.draws + (result === "draw" ? 1 : 0);
    const plays = row.plays + 1;

    let best = row.best;
    if (score !== null && score !== undefined) {
      if (best === null || best === undefined) best = score;
      else if (better === "lower" ? score < best : score > best) best = score;
    }

    db.prepare(
      `UPDATE game_stats SET wins = ?, losses = ?, draws = ?, plays = ?, best = ?, updated_at = unixepoch()
       WHERE guild_id = ? AND user_id = ? AND game = ?`
    ).run(wins, losses, draws, plays, best, guildId, userId, game);

    return stmts.get.get(guildId, userId, game);
  }
);

/** Top players for a single game (wins, or best record when `byBest`). */
function topForGame(guildId, game, limit = 10, { byBest = false } = {}) {
  return byBest
    ? stmts.topGameByBest.all(guildId, game, limit)
    : stmts.topGame.all(guildId, game, limit);
}

/** Top players across every game (aggregated wins). */
function topOverall(guildId, limit = 10) {
  return stmts.topOverall.all(guildId, limit);
}

function statsForUser(guildId, userId) {
  return stmts.byUser.all(guildId, userId);
}

function removeStatsByGuild(guildId) {
  return stmts.deleteGuild.run(guildId).changes;
}

module.exports = {
  recordResult,
  topForGame,
  topOverall,
  statsForUser,
  removeStatsByGuild,
};
