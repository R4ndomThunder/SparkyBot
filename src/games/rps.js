/** Rock-paper-scissors rules (pure logic). */

const MOVES = {
  rock: { emoji: "🪨", name: "Sasso", beats: "scissors" },
  paper: { emoji: "📄", name: "Carta", beats: "rock" },
  scissors: { emoji: "✂️", name: "Forbici", beats: "paper" },
};

const KEYS = Object.keys(MOVES);

/**
 * @returns {"win"|"loss"|"draw"} result of `a` against `b`
 */
function judge(a, b) {
  if (!MOVES[a] || !MOVES[b]) throw new Error(`unknown move: ${a}/${b}`);
  if (a === b) return "draw";
  return MOVES[a].beats === b ? "win" : "loss";
}

function randomMove() {
  return KEYS[Math.floor(Math.random() * KEYS.length)];
}

module.exports = { MOVES, KEYS, judge, randomMove };
