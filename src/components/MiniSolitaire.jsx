import { useEffect, useMemo, useRef, useState } from "react";
import {
  readHarpanStats,
  recordHarpanWin,
  resetHarpanStreak,
} from "../lib/harpanProgress";

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const CARD_WIDTH = "clamp(34px, 11vw, 72px)";
const CARD_HEIGHT = "clamp(48px, 15.4vw, 101px)"; // 2.5:3.5 ratio
const CARD_STACK_OFFSET = 16;
const FACE_CARD_MAX_HEIGHT = 101;
const HARPAN_STATE_KEY = "scoreboard_harpan_state_v1";
const SUIT_SYMBOL = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

function isRed(suit) {
  return suit === "hearts" || suit === "diamonds";
}

function rankLabel(rank) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function cardColor(card) {
  return isRed(card.suit) ? "#b91c1c" : "#111827";
}

function makeDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `${suit}-${rank}-${id++}`, suit, rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function initGame() {
  const deck = makeDeck();
  const tableau = Array.from({ length: 7 }, () => []);
  for (let pile = 0; pile < 7; pile += 1) {
    for (let i = 0; i <= pile; i += 1) {
      const card = deck.pop();
      card.faceUp = i === pile;
      tableau[pile].push(card);
    }
  }
  return {
    stock: deck,
    waste: [],
    tableau,
    foundations: {
      spades: [],
      hearts: [],
      diamonds: [],
      clubs: [],
    },
  };
}

function isCard(value) {
  return Boolean(
    value &&
      typeof value.id === "string" &&
      SUITS.includes(value.suit) &&
      Number.isInteger(value.rank) &&
      value.rank >= 1 &&
      value.rank <= 13 &&
      typeof value.faceUp === "boolean"
  );
}

function isValidPile(pile) {
  return Array.isArray(pile) && pile.every(isCard);
}

function loadSavedGame() {
  try {
    const raw = localStorage.getItem(HARPAN_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!isValidPile(parsed.stock)) return null;
    if (!isValidPile(parsed.waste)) return null;
    if (!Array.isArray(parsed.tableau) || parsed.tableau.length !== 7) return null;
    if (!parsed.tableau.every(isValidPile)) return null;
    if (!parsed.foundations || typeof parsed.foundations !== "object") return null;
    if (!SUITS.every((suit) => isValidPile(parsed.foundations[suit]))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function canPlaceOnFoundation(card, foundationPile, suitKey) {
  if (!card || card.suit !== suitKey) return false;
  if (foundationPile.length === 0) return card.rank === 1;
  return foundationPile[foundationPile.length - 1].rank + 1 === card.rank;
}

function canPlaceOnTableau(card, pile) {
  if (!card) return false;
  const top = pile[pile.length - 1];
  if (!top) return card.rank === 13;
  if (!top.faceUp) return false;
  return isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1;
}

function isValidRun(cards) {
  if (!cards.length) return false;
  for (let i = 0; i < cards.length; i += 1) {
    if (!cards[i].faceUp) return false;
    if (i === cards.length - 1) continue;
    const a = cards[i];
    const b = cards[i + 1];
    if (isRed(a.suit) === isRed(b.suit) || a.rank !== b.rank + 1) return false;
  }
  return true;
}

function findFoundationTarget(card, foundations) {
  if (!card) return null;
  for (const suit of SUITS) {
    if (canPlaceOnFoundation(card, foundations[suit], suit)) return suit;
  }
  return null;
}

function applyAutoFinishStep(state) {
  const wasteTop = state.waste[state.waste.length - 1];
  const wasteSuit = findFoundationTarget(wasteTop, state.foundations);
  if (wasteTop && wasteSuit) {
    const foundations = {
      ...state.foundations,
      [wasteSuit]: [...state.foundations[wasteSuit], wasteTop],
    };
    return { ...state, waste: state.waste.slice(0, -1), foundations };
  }

  for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
    const pile = state.tableau[pileIndex];
    if (!pile.length) continue;
    const top = pile[pile.length - 1];
    const suit = findFoundationTarget(top, state.foundations);
    if (!suit) continue;

    const nextTableau = state.tableau.map((p, i) => (i === pileIndex ? p.slice(0, -1) : [...p]));
    const sourceAfterMove = nextTableau[pileIndex];
    if (sourceAfterMove.length > 0 && !sourceAfterMove[sourceAfterMove.length - 1].faceUp) {
      sourceAfterMove[sourceAfterMove.length - 1] = {
        ...sourceAfterMove[sourceAfterMove.length - 1],
        faceUp: true,
      };
    }
    const foundations = {
      ...state.foundations,
      [suit]: [...state.foundations[suit], top],
    };
    return { ...state, tableau: nextTableau, foundations };
  }

  return state;
}

function FaceCard({ card, compact = false }) {
  const rank = rankLabel(card.rank);
  const suit = SUIT_SYMBOL[card.suit];
  return (
    <>
      <div style={{ justifySelf: "start", fontSize: compact ? 14 : 15, lineHeight: 1 }}>
        {rank}
        {suit}
      </div>
      <div style={{ justifySelf: "center", fontSize: compact ? 20 : 22, lineHeight: 1 }}>
        {suit}
      </div>
      <div
        style={{
          justifySelf: "end",
          alignSelf: "end",
          fontSize: compact ? 14 : 15,
          lineHeight: 1,
          transform: "rotate(180deg)",
        }}
      >
        {rank}
        {suit}
      </div>
    </>
  );
}

export default function MiniSolitaire({ closeSignal = 0 }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("harpan") === "1";
  });
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [openSignal, setOpenSignal] = useState(0);
  const [stats, setStats] = useState(() => readHarpanStats());
  const [game, setGame] = useState(() => loadSavedGame() ?? initGame());
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState("Klicka på ♠ för att öppna Harpan.");
  const prevWonRef = useRef(false);
  const wonInitRef = useRef(false);

  const won = useMemo(
    () => SUITS.every((suit) => game.foundations[suit].length === 13),
    [game.foundations]
  );
  const cardBackImage = [
    "url('/12-an-hemskarm-logotyp.png')",
    "repeating-linear-gradient(45deg, rgba(255,255,255,.11) 0 6px, rgba(255,255,255,0) 6px 12px)",
    "linear-gradient(180deg, #14532d, #052e16)",
  ].join(", ");
  const isOpen = open && openSignal === closeSignal;
  const autoFinishReady = useMemo(() => {
    if (won) return false;
    const allTableauFaceUp = game.tableau.every((pile) => pile.every((card) => card.faceUp));
    const allAcesPlaced = SUITS.every((suit) => game.foundations[suit].length >= 1);
    return game.stock.length === 0 && allTableauFaceUp && allAcesPlaced;
  }, [game.foundations, game.stock.length, game.tableau, won]);
  const tableauMinHeight = useMemo(() => {
    const tallestPile = Math.max(...game.tableau.map((pile) => pile.length), 1);
    return Math.max(220, 8 + (tallestPile - 1) * CARD_STACK_OFFSET + FACE_CARD_MAX_HEIGHT + 8);
  }, [game.tableau]);
  const tableauPileMinHeight = Math.max(200, tableauMinHeight - 20);

  useEffect(() => {
    if (!wonInitRef.current) {
      prevWonRef.current = won;
      wonInitRef.current = true;
      return;
    }
    if (!prevWonRef.current && won) {
      const id = setTimeout(() => {
        setStats(recordHarpanWin());
      }, 0);
      prevWonRef.current = won;
      return () => clearTimeout(id);
    }
    prevWonRef.current = won;
  }, [won]);

  useEffect(() => {
    try {
      localStorage.setItem(HARPAN_STATE_KEY, JSON.stringify(game));
    } catch {
      // ignore persistence issues
    }
  }, [game]);
  const displayNotice =
    isOpen && autoFinishReady && !won
      ? "Autofinish: lägger korten i esshögarna..."
      : notice;

  useEffect(() => {
    if (!isOpen || !autoFinishReady || won) return undefined;
    const id = setTimeout(() => {
      setSelected(null);
      setGame((prev) => applyAutoFinishStep(prev));
    }, 120);
    return () => clearTimeout(id);
  }, [isOpen, autoFinishReady, won, game]);

  function clearSelection() {
    setSelected(null);
  }

  function restartGame() {
    if (!won) {
      setStats((prev) => {
        if (prev.currentStreak === 0) return prev;
        return resetHarpanStreak();
      });
    }
    setGame(initGame());
    setSelected(null);
    prevWonRef.current = false;
    setNotice("Ny omgång startad.");
  }

  function drawFromStock() {
    setGame((prev) => {
      if (prev.stock.length > 0) {
        const stock = [...prev.stock];
        const card = { ...stock.pop(), faceUp: true };
        return {
          ...prev,
          stock,
          waste: [...prev.waste, card],
        };
      }
      if (prev.waste.length === 0) return prev;
      const stock = prev.waste.map((c) => ({ ...c, faceUp: false })).reverse();
      return { ...prev, stock, waste: [] };
    });
    clearSelection();
  }

  function tryMoveSelectedToFoundation(suitKey) {
    if (!selected) return;
    setGame((prev) => {
      const foundationPile = prev.foundations[suitKey];
      if (selected.type === "waste") {
        const card = prev.waste[prev.waste.length - 1];
        if (!canPlaceOnFoundation(card, foundationPile, suitKey)) return prev;
        const foundations = { ...prev.foundations, [suitKey]: [...foundationPile, card] };
        return { ...prev, waste: prev.waste.slice(0, -1), foundations };
      }
      if (selected.type === "tableau") {
        const source = prev.tableau[selected.pile];
        if (!source?.length) return prev;
        const card = source[selected.index];
        if (!card || source.length - 1 !== selected.index) return prev;
        if (!canPlaceOnFoundation(card, foundationPile, suitKey)) return prev;
        const nextTableau = prev.tableau.map((pile, i) => (i === selected.pile ? pile.slice(0, -1) : [...pile]));
        const movedFrom = nextTableau[selected.pile];
        if (movedFrom.length > 0 && !movedFrom[movedFrom.length - 1].faceUp) {
          movedFrom[movedFrom.length - 1] = { ...movedFrom[movedFrom.length - 1], faceUp: true };
        }
        const foundations = { ...prev.foundations, [suitKey]: [...foundationPile, card] };
        return { ...prev, tableau: nextTableau, foundations };
      }
      if (selected.type === "foundation") return prev;
      return prev;
    });
    clearSelection();
  }

  function tryMoveSelectedToTableau(targetPileIndex) {
    if (!selected) return;
    setGame((prev) => {
      const targetPile = prev.tableau[targetPileIndex];
      if (selected.type === "waste") {
        const card = prev.waste[prev.waste.length - 1];
        if (!canPlaceOnTableau(card, targetPile)) return prev;
        const nextTableau = prev.tableau.map((pile, i) =>
          i === targetPileIndex ? [...pile, card] : [...pile]
        );
        return { ...prev, waste: prev.waste.slice(0, -1), tableau: nextTableau };
      }
      if (selected.type === "tableau") {
        if (selected.pile === targetPileIndex) return prev;
        const source = prev.tableau[selected.pile];
        const moving = source.slice(selected.index);
        if (!isValidRun(moving)) return prev;
        if (!canPlaceOnTableau(moving[0], targetPile)) return prev;

        const nextTableau = prev.tableau.map((pile) => [...pile]);
        nextTableau[selected.pile] = nextTableau[selected.pile].slice(0, selected.index);
        nextTableau[targetPileIndex] = [...nextTableau[targetPileIndex], ...moving];
        const newTop = nextTableau[selected.pile][nextTableau[selected.pile].length - 1];
        if (newTop && !newTop.faceUp) {
          nextTableau[selected.pile][nextTableau[selected.pile].length - 1] = {
            ...newTop,
            faceUp: true,
          };
        }
        return { ...prev, tableau: nextTableau };
      }
      if (selected.type === "foundation") {
        const source = prev.foundations[selected.suit];
        const card = source[source.length - 1];
        if (!card) return prev;
        if (!canPlaceOnTableau(card, targetPile)) return prev;
        const foundations = { ...prev.foundations, [selected.suit]: source.slice(0, -1) };
        const nextTableau = prev.tableau.map((pile, i) =>
          i === targetPileIndex ? [...pile, { ...card, faceUp: true }] : [...pile]
        );
        return { ...prev, foundations, tableau: nextTableau };
      }
      return prev;
    });
    clearSelection();
  }

  function handleFoundationClick(suitKey) {
    const pile = game.foundations[suitKey];
    const top = pile[pile.length - 1];
    if (selected) {
      if (selected.type === "foundation" && selected.suit === suitKey) {
        clearSelection();
        return;
      }
      tryMoveSelectedToFoundation(suitKey);
      return;
    }
    if (!top) return;
    setSelected({ type: "foundation", suit: suitKey });
  }

  function handleTableauCardClick(pileIndex, cardIndex) {
    const pile = game.tableau[pileIndex];
    const card = pile[cardIndex];
    if (!card) return;

    if (!card.faceUp && cardIndex === pile.length - 1) {
      setGame((prev) => {
        const nextTableau = prev.tableau.map((p) => [...p]);
        const top = nextTableau[pileIndex][nextTableau[pileIndex].length - 1];
        if (!top || top.faceUp) return prev;
        nextTableau[pileIndex][nextTableau[pileIndex].length - 1] = { ...top, faceUp: true };
        return { ...prev, tableau: nextTableau };
      });
      clearSelection();
      return;
    }
    if (!card.faceUp) return;

    if (selected) {
      tryMoveSelectedToTableau(pileIndex);
      return;
    }
    const run = pile.slice(cardIndex);
    if (!isValidRun(run)) return;
    setSelected({ type: "tableau", pile: pileIndex, index: cardIndex });
  }

  function handleWasteClick() {
    if (game.waste.length === 0) return;
    if (selected?.type === "waste") {
      clearSelection();
      return;
    }
    setSelected({ type: "waste" });
  }

  return (
    <>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOpenSignal(closeSignal);
            setOpen(true);
          }}
          title="Öppna Harpan"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,.5)",
            background: "rgba(9,15,28,.9)",
            color: "#dbeafe",
            fontWeight: 900,
            display: "grid",
            placeItems: "center",
            fontSize: 15,
            boxShadow: "0 8px 22px rgba(2,6,23,.44)",
            cursor: "pointer",
          }}
        >
          ♠
        </button>
      </div>

      {isOpen && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.72)",
            display: "grid",
            placeItems: "center",
            padding: 12,
            zIndex: 95,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 100%)",
              maxHeight: "88vh",
              overflow: "auto",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,.35)",
              background: "linear-gradient(180deg, rgba(8,16,20,.985), rgba(5,12,18,.985))",
              boxShadow: "0 22px 58px rgba(2,6,23,.62)",
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Harpan</div>
                <div
                  style={{
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.72)",
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#cbd5e1",
                  }}
                >
                  {`Streak: ${stats.currentStreak}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowStats(true)}
                  title="Statistik"
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.85)",
                    color: "#e2e8f0",
                    fontWeight: 700,
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                >
                  Statistik
                </button>
                <button
                  type="button"
                  onClick={() => setShowRules(true)}
                  title="Regler"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.85)",
                    color: "#e2e8f0",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  i
                </button>
                <button
                  type="button"
                  onClick={restartGame}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.85)",
                    color: "#e2e8f0",
                    fontWeight: 700,
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                >
                  Nytt spel
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(15,23,42,.85)",
                    color: "#e2e8f0",
                    fontWeight: 700,
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                >
                  Stäng
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                color: won ? "#86efac" : "var(--muted)",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {won ? "Snyggt, du vann Harpan! Poäng sparad i räknaren." : displayNotice}
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              <div style={{ gridColumn: "span 2", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <button
                  type="button"
                  onClick={drawFromStock}
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,.42)",
                    background:
                      game.stock.length > 0
                        ? cardBackImage
                        : "rgba(15,23,42,.4)",
                    backgroundSize:
                      game.stock.length > 0
                        ? "34px 34px, 16px 16px, 100% 100%"
                        : undefined,
                    backgroundPosition:
                      game.stock.length > 0
                        ? "center center, 0 0, 0 0"
                        : undefined,
                    backgroundRepeat:
                      game.stock.length > 0
                        ? "no-repeat, repeat, no-repeat"
                        : undefined,
                    color: "var(--muted)",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {game.stock.length > 0 ? "" : "↺"}
                </button>
                <button
                  type="button"
                  onClick={handleWasteClick}
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    borderRadius: 12,
                    border:
                      selected?.type === "waste"
                        ? "2px solid #67e8f9"
                        : "1px solid rgba(15,23,42,.35)",
                    background: game.waste.length
                      ? "linear-gradient(180deg, #ffffff, #f8fafc)"
                      : "rgba(2,6,23,.78)",
                    color: game.waste.length ? cardColor(game.waste[game.waste.length - 1]) : "var(--muted)",
                    fontWeight: 900,
                    fontSize: 22,
                    cursor: game.waste.length ? "pointer" : "default",
                    boxShadow: game.waste.length ? "0 3px 8px rgba(2,6,23,.16)" : "none",
                    display: "grid",
                    gridTemplateRows: "1fr auto 1fr",
                    alignItems: "start",
                  }}
                >
                  {game.waste.length ? (
                    <FaceCard card={game.waste[game.waste.length - 1]} compact />
                  ) : (
                    "—"
                  )}
                </button>
              </div>

              {SUITS.map((suit) => {
                const top = game.foundations[suit][game.foundations[suit].length - 1];
                const isSelected =
                  selected?.type === "foundation" && selected.suit === suit;
                return (
                  <button
                    key={suit}
                    type="button"
                    onClick={() => handleFoundationClick(suit)}
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      justifySelf: "end",
                      borderRadius: 12,
                      border: isSelected
                        ? "2px solid #67e8f9"
                        : "1px solid rgba(15,23,42,.35)",
                      background: top
                        ? "linear-gradient(180deg, #ffffff, #f8fafc)"
                        : "rgba(2,6,23,.75)",
                      color: top ? cardColor(top) : "var(--muted)",
                      fontWeight: 900,
                      fontSize: top ? 22 : 20,
                      cursor: "pointer",
                      boxShadow: top
                        ? isSelected
                          ? "0 0 0 1px rgba(103,232,249,.4), 0 3px 8px rgba(2,6,23,.16)"
                          : "0 3px 8px rgba(2,6,23,.16)"
                        : "none",
                    }}
                    title={
                      top
                        ? `Esshög ${SUIT_SYMBOL[suit]} - klicka för att välja översta kortet`
                        : `Esshög ${SUIT_SYMBOL[suit]}`
                    }
                  >
                    {top ? (
                      <div style={{ display: "grid", gridTemplateRows: "1fr auto 1fr", alignItems: "start" }}>
                        <FaceCard card={top} compact />
                      </div>
                    ) : (
                      SUIT_SYMBOL[suit]
                    )}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gap: 6,
                alignItems: "start",
                minHeight: tableauMinHeight,
              }}
            >
              {game.tableau.map((pile, pileIndex) => (
                <div
                  key={pileIndex}
                  onClick={() => {
                    if (selected) tryMoveSelectedToTableau(pileIndex);
                  }}
                  style={{
                    position: "relative",
                    minHeight: tableauPileMinHeight,
                    borderRadius: 12,
                    border: "1px dashed rgba(148,163,184,.24)",
                    background: "rgba(15,23,42,.24)",
                  }}
                >
                  {pile.length === 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        color: "rgba(148,163,184,.5)",
                        fontWeight: 800,
                      }}
                    >
                      K
                    </div>
                  )}
                  {pile.map((card, cardIndex) => {
                    const isSelected =
                      selected?.type === "tableau" &&
                      selected.pile === pileIndex &&
                      cardIndex >= selected.index;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTableauCardClick(pileIndex, cardIndex);
                        }}
                        style={{
                          position: "absolute",
                          left: 2,
                          right: 2,
                          top: 8 + cardIndex * CARD_STACK_OFFSET,
                          height: CARD_HEIGHT,
                          borderRadius: 11,
                          border: isSelected
                            ? "2px solid #67e8f9"
                            : "1px solid rgba(15,23,42,.3)",
                          background: card.faceUp
                            ? "linear-gradient(180deg, #ffffff, #f8fafc)"
                            : cardBackImage,
                          backgroundSize: card.faceUp ? undefined : "34px 34px, 16px 16px, 100% 100%",
                          backgroundPosition: card.faceUp ? undefined : "center center, 0 0, 0 0",
                          backgroundRepeat: card.faceUp ? undefined : "no-repeat, repeat, no-repeat",
                          color: card.faceUp ? cardColor(card) : "transparent",
                          fontWeight: 900,
                          fontSize: 22,
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(103,232,249,.4), 0 3px 8px rgba(2,6,23,.16)"
                            : "0 3px 8px rgba(2,6,23,.14)",
                          display: "grid",
                          gridTemplateRows: "1fr auto 1fr",
                          alignItems: "start",
                        }}
                        >
                          {card.faceUp ? (
                          <FaceCard card={card} />
                        ) : (
                          <span />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {showRules && (
              <div
                onClick={() => setShowRules(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,.62)",
                  display: "grid",
                  placeItems: "center",
                  padding: 12,
                  zIndex: 96,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "min(560px, 100%)",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(8,12,20,.98)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>Regler - Harpan</div>
                    <button
                      type="button"
                      onClick={() => setShowRules(false)}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.35)",
                        background: "rgba(15,23,42,.85)",
                        color: "#e2e8f0",
                        fontWeight: 700,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Stäng
                    </button>
                  </div>
                  <div style={{ color: "var(--text)", fontWeight: 650, fontSize: 14, lineHeight: 1.45 }}>
                    Målet är att bygga fyra esshögar (en per färg) från ess till kung.
                    Dra kort från högen till vänster, flytta kort mellan kolumner i fallande ordning
                    och med växlande färg (röd/svart). Endast kung får flyttas till en tom kolumn.
                    Kort i esshögar byggs upp i samma färg.
                  </div>
                </div>
              </div>
            )}

            {showStats && (
              <div
                onClick={() => setShowStats(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,.62)",
                  display: "grid",
                  placeItems: "center",
                  padding: 12,
                  zIndex: 96,
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "min(460px, 100%)",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.35)",
                    background: "rgba(8,12,20,.98)",
                    padding: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900 }}>Statistik - Harpan</div>
                    <button
                      type="button"
                      onClick={() => setShowStats(false)}
                      style={{
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,.35)",
                        background: "rgba(15,23,42,.85)",
                        color: "#e2e8f0",
                        fontWeight: 700,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Stäng
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
                    }}
                  >
                    {[
                      { label: "Nuvarande streak", value: stats.currentStreak },
                      { label: "Bästa streak", value: stats.bestStreak },
                      { label: "Totala vinster", value: stats.wins },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,.25)",
                          background: "rgba(15,23,42,.5)",
                          padding: "12px 10px",
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
                          {item.label}
                        </div>
                        <div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 900 }}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.45, fontWeight: 650 }}>
                    Du kan nu klicka på ett översta kort i esshögarna och flytta tillbaka det till en giltig kolumn om du vill ångra ett drag.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
