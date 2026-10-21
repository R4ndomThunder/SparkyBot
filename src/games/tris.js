/** Tic-tac-toe rules + perfect opponent (minimax). Pure logic. */

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const emptyBoard = () => Array(9).fill(null);

/** @returns {{mark:"X"|"O", line:number[]}|{mark:"draw"}|null} */
function winner(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a], line };
    }
  }
  if (board.every((cell) => cell)) return { mark: "draw" };
  return null;
}

const available = (board) => board.reduce((acc, cell, i) => (cell ? acc : (acc.push(i), acc)), []);

function applyMove(board, index, mark) {
  if (index < 0 || index > 8) throw new Error(`cell out of range: ${index}`);
  if (board[index]) throw new Error(`cell ${index} already taken`);
  const next = board.slice();
  next[index] = mark;
  return next;
}

const other = (mark) => (mark === "X" ? "O" : "X");

/** Minimax: returns the best cell for `mark` on `board` (perfect play). */
function bestMove(board, mark) {
  const cells = available(board);
  if (!cells.length) return null;

  const score = (state, turn) => {
    const result = winner(state);
    if (result) {
      if (result.mark === "draw") return 0;
      // Prefer fast wins / slow losses.
      const depth = state.filter(Boolean).length;
      return result.mark === mark ? 10 - depth : depth - 10;
    }
    const moves = available(state);
    const values = moves.map((cell) => score(applyMove(state, cell, turn), other(turn)));
    return turn === mark ? Math.max(...values) : Math.min(...values);
  };

  let best = null;
  let bestScore = -Infinity;
  for (const cell of cells) {
    const value = score(applyMove(board, cell, mark), other(mark));
    if (value > bestScore) {
      bestScore = value;
      best = cell;
    }
  }
  return best;
}

module.exports = { LINES, emptyBoard, winner, available, applyMove, other, bestMove };
