import { isWild } from "./canastaEngine";

export function buildMeldPreviewCards(title, meld) {
  if (!meld) return [];
  if (meld.rank === 0) return [...meld.cards];

  const naturals = meld.cards.filter((c) => !isWild(c) && c.rank === meld.rank);
  const wilds = meld.cards.filter((c) => isWild(c));
  const isCanasta = meld.cards.length >= 7;
  const isImpure = isCanasta && wilds.length > 0;
  const frontValueCard = {
    id: `front-${title}-${meld.rank}-${isCanasta ? (isImpure ? "impure" : "pure") : "normal"}`,
    suit: isCanasta ? (isImpure ? "spades" : "hearts") : (naturals[0]?.suit ?? "hearts"),
    rank: meld.rank,
    joker: false,
  };
  const restNaturals = naturals.filter((c, idx) => !(idx === 0 && !isCanasta));
  return [frontValueCard, ...restNaturals, ...wilds];
}
