/** Blackjack rules (pure logic): dealer stands on all 17, blackjack pays 3:2. */

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

function freshDeck() {
  const deck = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  return shuffle(deck);
}

function shuffle(deck, rng = Math.random) {
  const out = deck.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Draw cards off the front of the deck. */
function draw(deck, count = 1) {
  return deck.splice(0, count);
}

/** Hand total, aces counted as 11 while possible (soft hands). */
function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["K", "Q", "J"].includes(card.rank)) total += 10;
    else total += Number(card.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

/** Natural blackjack: exactly two cards totalling 21. */
const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;

const isBusted = (cards) => handValue(cards).total > 21;

/** Dealer draws to 17+ (stands on every 17). Mutates/returns the hand. */
function dealerPlay(deck, dealer) {
  while (handValue(dealer).total < 17) dealer.push(...draw(deck, 1));
  return dealer;
}

/**
 * Settle one player hand against the final dealer hand.
 *
 * @param {object} opts
 * @param {number} opts.bet    stake on this hand (already escrowed)
 * @param {boolean} [opts.fromSplit=false] split hands never pay 3:2
 * @returns {{outcome:"win"|"loss"|"push"|"blackjack", profit:number}} profit vs the stake
 */
function settleHand({ player, dealer, bet, fromSplit = false }) {
  const p = handValue(player).total;
  const d = handValue(dealer).total;

  if (p > 21) return { outcome: "loss", profit: -bet };
  if (!fromSplit && isBlackjack(player) && !isBlackjack(dealer)) {
    return { outcome: "blackjack", profit: Math.floor(bet * 1.5) };
  }
  if (d > 21) return { outcome: "win", profit: bet };
  if (p > d) return { outcome: "win", profit: bet };
  if (p < d) return { outcome: "loss", profit: -bet };
  return { outcome: "push", profit: 0 };
}

const formatCard = (card) => `${card.rank}${card.suit}`;

const formatHand = (cards) => cards.map(formatCard).join(" ");

module.exports = {
  RANKS,
  SUITS,
  freshDeck,
  shuffle,
  draw,
  handValue,
  isBlackjack,
  isBusted,
  dealerPlay,
  settleHand,
  formatCard,
  formatHand,
};
