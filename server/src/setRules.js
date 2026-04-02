function allSameOrAllDifferent(a, b, c) {
  const set = new Set([a, b, c]);
  return set.size === 1 || set.size === 3;
}

function isSet(cardA, cardB, cardC) {
  if (!cardA || !cardB || !cardC) return false;
  const idA = String(cardA.id);
  const idB = String(cardB.id);
  const idC = String(cardC.id);
  if (idA === idB || idA === idC || idB === idC) return false;
  const ca = Number(cardA.count);
  const cb = Number(cardB.count);
  const cc = Number(cardC.count);
  return (
    allSameOrAllDifferent(cardA.shape, cardB.shape, cardC.shape) &&
    allSameOrAllDifferent(cardA.color, cardB.color, cardC.color) &&
    allSameOrAllDifferent(cardA.fill, cardB.fill, cardC.fill) &&
    allSameOrAllDifferent(ca, cb, cc)
  );
}

function hasAnySet(board) {
  const n = board.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (isSet(board[i], board[j], board[k])) {
          return true;
        }
      }
    }
  }
  return false;
}

module.exports = {
  isSet,
  hasAnySet,
};

