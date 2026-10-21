/** Click-race helpers: the button appears after a random short delay. */

const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 7_500;

/** How long before the 🎯 shows up. */
const revealDelay = () => MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));

module.exports = { MIN_DELAY_MS, MAX_DELAY_MS, revealDelay };
