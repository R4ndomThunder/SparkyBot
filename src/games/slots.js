/** Slot machine rules (pure logic).
 *
 * Probabilities over 6^3 = 216 outcomes:
 *   7️⃣7️⃣7️⃣  1/216  → profit 10× the bet
 *   any triple 6/216 → profit 4× (including the jackpot one)
 *   exactly one pair 90/216 → stake refunded, no profit
 *   nothing  120/216 → lose the bet
 * Expected return ≈ 0.583 per staked credit → ~42% sink against inflation.
 */

const SYMBOLS = ["🍒", "🍋", "🔔", "7️⃣", "⭐", "🍀"];

function spin(rng = Math.random) {
  return Array.from({ length: 3 }, () => SYMBOLS[Math.floor(rng() * SYMBOLS.length)]);
}

/**
 * @returns {"jackpot"|"triple"|"pair"|"none"}
 */
function evaluate([a, b, c]) {
  if (a === b && b === c) return a === "7️⃣" ? "jackpot" : "triple";
  if (a === b || b === c || a === c) return "pair";
  return "none";
}

/** Credits returned for a staked bet (stake included). */
function creditsReturned(bet, kind) {
  switch (kind) {
    case "jackpot":
      return bet + bet * 10; // stake back + 10× profit
    case "triple":
      return bet + bet * 4; // stake back + 4× profit
    case "pair":
      return bet; // refund only
    default:
      return 0;
  }
}

const LABELS = {
  jackpot: " JACKPOT! 🎉",
  triple: "Tris! 🎊",
  pair: "Coppia — posta restituita 🤝",
  none: "Niente… 😵",
};

module.exports = { SYMBOLS, spin, evaluate, creditsReturned, LABELS };
