const SHAPES = ["diamond", "squiggle", "oval"];
const COLORS = ["red", "green", "purple"];
const FILLS = ["solid", "striped", "open"];
const COUNTS = [1, 2, 3];

function generateDeck() {
  const deck = [];
  let id = 0;
  for (const shape of SHAPES) {
    for (const color of COLORS) {
      for (const fill of FILLS) {
        for (const count of COUNTS) {
          deck.push({ id: String(id), shape, color, fill, count });
          id += 1;
        }
      }
    }
  }
  return deck;
}

function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = {
  SHAPES,
  COLORS,
  FILLS,
  COUNTS,
  generateDeck,
  shuffle,
};

