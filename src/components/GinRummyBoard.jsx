import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_SYMBOL = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const DEFAULT_TARGET_SCORE = 100;

function makeDeck() {
  const deck = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({ id: `gin-${suit}-${rank}-${id++}`, suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankLabel(rank) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function cardLabel(card) {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

function isRedSuit(suit) {
  return suit === "hearts" || suit === "diamonds";
}

function deadwoodValue(card) {
  if (card.rank === 1) return 1;
  return Math.min(card.rank, 10);
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.id.localeCompare(b.id);
  });
}

function sortCardsByRank(cards) {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return a.id.localeCompare(b.id);
  });
}

function sortMeldCards(meld) {
  if (meld.type === "run") {
    return sortCardsByRank(meld.cards);
  }
  return [...meld.cards].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return a.id.localeCompare(b.id);
  });
}

function compareMelds(a, b) {
  if (a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
  if (a.type !== b.type) return a.type === "set" ? -1 : 1;
  const aFirst = a.cards[0];
  const bFirst = b.cards[0];
  if ((aFirst?.rank ?? 0) !== (bFirst?.rank ?? 0)) return (aFirst?.rank ?? 0) - (bFirst?.rank ?? 0);
  return String(aFirst?.id ?? "").localeCompare(String(bFirst?.id ?? ""));
}

function combinations(items, size) {
  const result = [];
  function walk(start, combo) {
    if (combo.length === size) {
      result.push(combo);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      walk(i + 1, [...combo, items[i]]);
    }
  }
  walk(0, []);
  return result;
}

function findAllMelds(cards) {
  const melds = [];
  const byRank = new Map();
  const bySuit = new Map();

  cards.forEach((card, index) => {
    const rankEntries = byRank.get(card.rank) ?? [];
    rankEntries.push({ card, index });
    byRank.set(card.rank, rankEntries);

    const suitEntries = bySuit.get(card.suit) ?? [];
    suitEntries.push({ card, index });
    bySuit.set(card.suit, suitEntries);
  });

  byRank.forEach((group) => {
    if (group.length < 3) return;
    combinations(group, 3).forEach((combo) => {
      melds.push({
        type: "set",
        indexes: combo.map((entry) => entry.index),
        cards: combo.map((entry) => entry.card),
      });
    });
    if (group.length === 4) {
      melds.push({
        type: "set",
        indexes: group.map((entry) => entry.index),
        cards: group.map((entry) => entry.card),
      });
    }
  });

  bySuit.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.card.rank - b.card.rank);
    for (let start = 0; start < sorted.length; start += 1) {
      let run = [sorted[start]];
      for (let index = start + 1; index < sorted.length; index += 1) {
        const prev = run[run.length - 1];
        const next = sorted[index];
        if (next.card.rank === prev.card.rank) continue;
        if (next.card.rank !== prev.card.rank + 1) break;
        run.push(next);
        if (run.length >= 3) {
          for (let size = 3; size <= run.length; size += 1) {
            const slice = run.slice(run.length - size);
            melds.push({
              type: "run",
              indexes: slice.map((entry) => entry.index),
              cards: slice.map((entry) => entry.card),
            });
          }
        }
      }
    }
  });

  const seen = new Set();
  return melds.filter((meld) => {
    const key = `${meld.type}:${[...meld.indexes].sort((a, b) => a - b).join("-")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evaluateHand(cards) {
  const melds = findAllMelds(cards);
  let best = {
    deadwood: cards.reduce((sum, card) => sum + deadwoodValue(card), 0),
    deadwoodCards: cards,
    melds: [],
  };

  function walk(start, usedIndexes, chosenMelds) {
    const deadwoodCards = cards.filter((_, index) => !usedIndexes.has(index));
    const deadwood = deadwoodCards.reduce((sum, card) => sum + deadwoodValue(card), 0);
    const usedCardCount = usedIndexes.size;
    const bestUsedCardCount = best.melds.reduce((sum, meld) => sum + meld.cards.length, 0);
    if (
      deadwood < best.deadwood ||
      (deadwood === best.deadwood && usedCardCount > bestUsedCardCount) ||
      (
        deadwood === best.deadwood &&
        usedCardCount === bestUsedCardCount &&
        chosenMelds.length > best.melds.length
      )
    ) {
      best = {
        deadwood,
        deadwoodCards,
        melds: chosenMelds.map((meld) => ({
          ...meld,
          cards: sortMeldCards(meld),
        })),
      };
    }
    for (let index = start; index < melds.length; index += 1) {
      const meld = melds[index];
      if (meld.indexes.some((item) => usedIndexes.has(item))) continue;
      const nextUsed = new Set(usedIndexes);
      meld.indexes.forEach((item) => nextUsed.add(item));
      walk(index + 1, nextUsed, [...chosenMelds, meld]);
    }
  }

  walk(0, new Set(), []);

  return {
    ...best,
    melds: best.melds.sort(compareMelds),
    deadwoodCards: sortCardsByRank(best.deadwoodCards),
  };
}

function canLayOff(card, meld) {
  if (meld.type === "set") {
    const rank = meld.cards[0]?.rank;
    const suits = new Set(meld.cards.map((entry) => entry.suit));
    return card.rank === rank && !suits.has(card.suit);
  }
  const sorted = [...meld.cards].sort((a, b) => a.rank - b.rank);
  const sameSuit = sorted.every((entry) => entry.suit === sorted[0]?.suit);
  if (!sameSuit || card.suit !== sorted[0]?.suit) return false;
  return card.rank === sorted[0].rank - 1 || card.rank === sorted[sorted.length - 1].rank + 1;
}

function calculateLayoffDeadwood(cards, melds) {
  const remaining = [...cards].sort((a, b) => deadwoodValue(b) - deadwoodValue(a));
  const mutableMelds = melds.map((meld) => ({
    ...meld,
    cards: [...meld.cards].sort((a, b) => a.rank - b.rank),
  }));
  let total = 0;

  remaining.forEach((card) => {
    const targetIndex = mutableMelds.findIndex((meld) => canLayOff(card, meld));
    if (targetIndex === -1) {
      total += deadwoodValue(card);
      return;
    }
    mutableMelds[targetIndex].cards.push(card);
    mutableMelds[targetIndex].cards.sort((a, b) => a.rank - b.rank);
  });

  return total;
}

function nextPlayerId(playerOrder, playerId) {
  if (!Array.isArray(playerOrder) || playerOrder.length !== 2) return null;
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex === -1) return playerOrder[0] ?? null;
  return playerOrder[(currentIndex + 1) % playerOrder.length] ?? null;
}

function buildPlayerMap(roomPlayers) {
  return new Map(
    (roomPlayers ?? []).map((player) => [
      player.id,
      {
        id: player.id,
        name: player.name || "Spelare",
      },
    ])
  );
}

function createMatchState(playerOrder, roomPlayers, previousScores = {}, handNumber = 1, dealerPlayerId = null) {
  const playerMeta = buildPlayerMap(roomPlayers);
  const deck = makeDeck();
  const players = {};
  playerOrder.forEach((id) => {
    players[id] = {
      id,
      name: playerMeta.get(id)?.name ?? "Spelare",
      score: Number(previousScores[id]) || 0,
      hand: [],
    };
  });

  for (let i = 0; i < 10; i += 1) {
    playerOrder.forEach((id) => {
      players[id].hand.push(deck.pop());
    });
  }

  const resolvedDealer = dealerPlayerId && playerOrder.includes(dealerPlayerId)
    ? dealerPlayerId
    : playerOrder[1];
  const startingPlayerId = nextPlayerId(playerOrder, resolvedDealer);

  return {
    gameType: "gin",
    status: "playing",
    targetScore: DEFAULT_TARGET_SCORE,
    playerOrder,
    players: Object.fromEntries(
      playerOrder.map((id) => [
        id,
        {
          ...players[id],
          hand: sortCards(players[id].hand),
        },
      ])
    ),
    dealerPlayerId: resolvedDealer,
    currentPlayerId: startingPlayerId,
    stock: deck,
    discard: [deck.pop()],
    phase: "draw",
    handNumber,
    revealHands: false,
    winnerId: null,
    roundSummary: null,
    message: `${playerMeta.get(startingPlayerId)?.name ?? "Spelare"} börjar. Dra från högen eller ta översta slängkortet.`,
    updatedAt: new Date().toISOString(),
  };
}

function resolveRound(match, actorId, mode) {
  const playerOrder = match.playerOrder ?? [];
  const opponentId = playerOrder.find((id) => id !== actorId) ?? null;
  if (!actorId || !opponentId) return match;

  const actor = match.players?.[actorId];
  const opponent = match.players?.[opponentId];
  if (!actor || !opponent) return match;

  const actorEval = evaluateHand(actor.hand ?? []);
  const opponentEval = evaluateHand(opponent.hand ?? []);

  let awardedTo = actorId;
  let points = 0;
  let detail = "";

  if (mode === "gin") {
    points = 25 + opponentEval.deadwood;
    detail = `${actor.name} gick gin och fick 25 bonus + ${opponentEval.deadwood} i motståndarens dödved.`;
  } else if (actorEval.deadwood < opponentEval.deadwood) {
    const laidOffDeadwood = calculateLayoffDeadwood(opponentEval.deadwoodCards, actorEval.melds);
    if (laidOffDeadwood <= actorEval.deadwood) {
      awardedTo = opponentId;
      points = 10 + (actorEval.deadwood - laidOffDeadwood);
      detail = `${opponent.name} undercutade efter layoff och tog 10 bonus + ${
        actorEval.deadwood - laidOffDeadwood
      }.`;
    } else {
      points = laidOffDeadwood - actorEval.deadwood;
      detail = `${actor.name} knackade hem handen med ${points} poäng efter layoff.`;
    }
  } else {
    awardedTo = opponentId;
    points = 10 + (opponentEval.deadwood - actorEval.deadwood);
    detail = `${opponent.name} undercutade och tog 10 bonus + ${
      opponentEval.deadwood - actorEval.deadwood
    }.`;
  }

  const nextPlayers = {};
  playerOrder.forEach((id) => {
    const player = match.players[id];
    nextPlayers[id] = {
      ...player,
      score: (Number(player.score) || 0) + (id === awardedTo ? points : 0),
    };
  });
  const winnerId = playerOrder.find(
    (id) => (Number(nextPlayers[id]?.score) || 0) >= (match.targetScore || DEFAULT_TARGET_SCORE)
  ) ?? null;

  return {
    ...match,
    players: nextPlayers,
    status: winnerId ? "gameOver" : "roundOver",
    revealHands: true,
    winnerId,
    roundSummary: {
      actorId,
      opponentId,
      awardedTo,
      mode,
      points,
      actorDeadwood: actorEval.deadwood,
      opponentDeadwood: opponentEval.deadwood,
      actorMelds: actorEval.melds,
      opponentMelds: opponentEval.melds,
      detail,
    },
    message: winnerId
      ? `${nextPlayers[winnerId]?.name ?? "Spelare"} vann matchen på ${
          nextPlayers[winnerId]?.score ?? 0
        } poäng.`
      : detail,
    updatedAt: new Date().toISOString(),
  };
}

function dealNextHand(match, roomPlayers) {
  const scores = Object.fromEntries(
    (match.playerOrder ?? []).map((id) => [id, Number(match.players?.[id]?.score) || 0])
  );
  const nextDealerId = nextPlayerId(match.playerOrder ?? [], match.dealerPlayerId);
  return createMatchState(
    match.playerOrder ?? [],
    roomPlayers,
    scores,
    Number(match.handNumber || 1) + 1,
    nextDealerId
  );
}

function CardToken({
  card,
  hidden = false,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  disabled = false,
  accent = false,
  compact = false,
  dragging = false,
  draggable = false,
  dragTarget = false,
  melded = false,
}) {
  const isRed = isRedSuit(card.suit);
  const suppressNativeDisable = draggable && disabled;
  const isVisuallyDisabled = disabled && !draggable;
  const width = compact ? "clamp(28px, 6vw, 42px)" : "clamp(30px, 7vw, 56px)";
  const height = compact ? "clamp(42px, 9vw, 60px)" : "clamp(44px, 10vw, 78px)";
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable && !isVisuallyDisabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      disabled={isVisuallyDisabled}
      aria-disabled={disabled ? "true" : undefined}
      style={{
        width,
        height,
        borderRadius: "clamp(8px, 1.6vw, 12px)",
        border: dragTarget
          ? "2px solid rgba(34,197,94,.92)"
          : dragging
          ? "2px solid rgba(96,165,250,.92)"
          : accent
          ? "2px solid rgba(250,204,21,.85)"
          : "1px solid rgba(148,163,184,.26)",
        background: hidden
          ? "linear-gradient(145deg, rgba(22,101,52,.95), rgba(6,78,59,.95))"
          : melded
          ? "linear-gradient(180deg, rgba(254,249,195,.98), rgba(240,253,244,.95))"
          : "linear-gradient(180deg, rgba(255,255,255,.98), rgba(241,245,249,.94))",
        color: hidden ? "rgba(255,255,255,.86)" : isRed ? "#b91c1c" : "#0f172a",
        fontWeight: 900,
        fontSize: compact ? "clamp(10px, 2vw, 14px)" : "clamp(10px, 2.1vw, 16px)",
        cursor: isVisuallyDisabled ? "not-allowed" : draggable || onClick ? "pointer" : "default",
        opacity: isVisuallyDisabled ? 0.55 : suppressNativeDisable ? 0.9 : 1,
        boxShadow: hidden
          ? "inset 0 1px 0 rgba(255,255,255,.16), 0 10px 20px rgba(2,6,23,.22)"
          : dragTarget
          ? "0 0 0 3px rgba(34,197,94,.22), 0 12px 24px rgba(15,23,42,.18)"
          : dragging
          ? "0 0 0 2px rgba(96,165,250,.25), 0 10px 20px rgba(15,23,42,.14)"
          : melded
          ? "0 0 0 2px rgba(250,204,21,.18), 0 10px 22px rgba(15,23,42,.16)"
          : "0 10px 20px rgba(15,23,42,.14)",
        flex: "0 1 auto",
        minWidth: 0,
        padding: 0,
        transform: dragTarget ? "translateY(-4px) scale(1.03)" : dragging ? "scale(0.97)" : "none",
        transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
      }}
    >
      {hidden ? "12:an" : cardLabel(card)}
    </button>
  );
}

function PlaceholderCards({ count = 10, compact = false }) {
  return (
    <div style={{ display: "flex", gap: compact ? 4 : 6, flexWrap: "nowrap", minWidth: 0 }}>
      {Array.from({ length: count }).map((_, index) => (
        <CardToken
          key={`placeholder-${compact ? "small" : "large"}-${index}`}
          card={{ suit: "spades", rank: 1 }}
          hidden
          compact={compact}
        />
      ))}
    </div>
  );
}

function pickBestDiscard(hand) {
  if (!Array.isArray(hand) || hand.length === 0) return null;
  let best = null;
  hand.forEach((card) => {
    const remaining = sortCards(hand.filter((entry) => entry.id !== card.id));
    const evaluation = evaluateHand(remaining);
    const score = evaluation.deadwood * 100 + deadwoodValue(card);
    if (!best || score < best.score) {
      best = { card, evaluation, score };
    }
  });
  return best?.card ?? hand[hand.length - 1] ?? null;
}

function evaluateAfterDiscard(hand, discardCardId) {
  const remaining = sortCards((hand ?? []).filter((card) => card.id !== discardCardId));
  return {
    hand: remaining,
    evaluation: evaluateHand(remaining),
  };
}

function buildAutoOrderedIds(hand) {
  const cards = sortCards(hand ?? []);
  const evaluation = evaluateHand(cards);
  const meldOrder = [];
  evaluation.melds.forEach((meld) => {
    meld.cards.forEach((card) => {
      if (!meldOrder.includes(card.id)) meldOrder.push(card.id);
    });
  });
  const deadwoodOrder = sortCardsByRank(evaluation.deadwoodCards).map((card) => card.id);
  return [...meldOrder, ...deadwoodOrder];
}

function orderHandByIds(hand, orderedIds) {
  const cards = hand ?? [];
  const orderMap = new Map((orderedIds ?? []).map((id, index) => [id, index]));
  return [...cards].sort((a, b) => {
    const ai = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
    const bi = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return sortCardsByRank([a, b])[0].id === a.id ? -1 : 1;
  });
}

export default function GinRummyBoard({
  onBack,
  roomCode,
  roomPlayers,
  roomState,
  playerId,
  isHost,
  friends,
  sentInvites,
  onSendRoomInvite,
  onShareRoom,
  onSyncMatchState,
  onAddBot,
  onRemoveBot,
  onOpenChat,
  chatUnread = 0,
}) {
  const botTurnHandledRef = useRef("");
  const [showRules, setShowRules] = useState(false);
  const [handOrder, setHandOrder] = useState([]);
  const [draggedCardId, setDraggedCardId] = useState(null);
  const [dragTargetCardId, setDragTargetCardId] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [pendingFinishMode, setPendingFinishMode] = useState(null);
  const roundCounts = roomState?.round_counts ?? {};
  const match = roundCounts.__gin_match ?? null;
  const targetScore = Number(roundCounts.__gin_target_score) || DEFAULT_TARGET_SCORE;
  const seatedPlayers = useMemo(() => roomPlayers ?? [], [roomPlayers]);
  const seatedPlayerIds = seatedPlayers.map((player) => player.id);
  const me = seatedPlayers.find((player) => player.id === playerId) ?? null;
  const inRoom = Boolean(me);
  const playerCount = seatedPlayers.length;
  const lobbyReady = playerCount === 2;
  const tooManyPlayers = playerCount > 2;
  const botPlayer = seatedPlayers.find((player) => String(player.device_id ?? "").startsWith("bot:")) ?? null;
  const hasBot = Boolean(botPlayer);
  const currentPlayer = match?.currentPlayerId ? match.players?.[match.currentPlayerId] : null;
  const myMatchPlayer = match?.players?.[playerId] ?? null;
  const isMyTurn = Boolean(match && match.currentPlayerId === playerId);
  const myEvaluation = useMemo(
    () => (myMatchPlayer?.hand ? evaluateHand(myMatchPlayer.hand) : null),
    [myMatchPlayer]
  );
  const myMeldCardIds = useMemo(() => {
    const ids = new Set();
    myEvaluation?.melds?.forEach((meld) => {
      meld.cards.forEach((card) => ids.add(card.id));
    });
    return ids;
  }, [myEvaluation]);
  const finishCandidates = useMemo(() => {
    const hand = myMatchPlayer?.hand ?? [];
    const knockIds = [];
    const ginIds = [];
    hand.forEach((card) => {
      const result = evaluateAfterDiscard(hand, card.id);
      if (result.evaluation.deadwood === 0) ginIds.push(card.id);
      if (result.evaluation.deadwood <= 10) knockIds.push(card.id);
    });
    return { knockIds, ginIds };
  }, [myMatchPlayer]);
  const canAct = Boolean(match && match.status === "playing" && isMyTurn);
  const canGin = Boolean(canAct && match.phase === "discard" && finishCandidates.ginIds.length > 0);
  const canKnock = Boolean(canAct && match.phase === "discard" && finishCandidates.knockIds.length > 0);
  const topSeat = match?.playerOrder?.[1]
    ? match.players?.[match.playerOrder[1]]
    : seatedPlayers[1]
      ? {
          id: seatedPlayers[1].id,
          name: seatedPlayers[1].name,
          score: 0,
          hand: [],
        }
      : null;
  const bottomSeat = match?.playerOrder?.[0]
    ? match.players?.[match.playerOrder[0]]
    : seatedPlayers[0]
      ? {
          id: seatedPlayers[0].id,
          name: seatedPlayers[0].name,
          score: 0,
          hand: [],
        }
      : me
        ? { id: me.id, name: me.name, score: 0, hand: [] }
        : null;
  const topIsMe = topSeat?.id === playerId;
  const bottomIsMe = bottomSeat?.id === playerId;
  const topHandCards = match
    ? (match.revealHands ? topSeat?.hand ?? [] : (topSeat?.hand ?? []).map((card) => ({ ...card, hidden: true })))
    : [];
  const effectiveHandOrder = useMemo(() => {
    const ids = (myMatchPlayer?.hand ?? []).map((card) => card.id);
    const kept = handOrder.filter((id) => ids.includes(id));
    const appended = ids.filter((id) => !kept.includes(id));
    return [...kept, ...appended];
  }, [myMatchPlayer, handOrder]);
  const orderedMyHand = useMemo(
    () => orderHandByIds(myMatchPlayer?.hand ?? [], effectiveHandOrder),
    [myMatchPlayer, effectiveHandOrder]
  );
  const bottomHandCards = match ? (bottomIsMe ? orderedMyHand : bottomSeat?.hand ?? []) : [];

  const syncRoom = useCallback((nextMatch, extra = {}) => {
    if (typeof onSyncMatchState !== "function") return;
    onSyncMatchState({
      ...nextMatch,
      targetScore,
      updatedAt: new Date().toISOString(),
    }, extra);
  }, [onSyncMatchState, targetScore]);

  function startMatch() {
    if (!isHost || !lobbyReady || tooManyPlayers) return;
    const nextMatch = createMatchState(seatedPlayerIds.slice(0, 2), seatedPlayers, {}, 1, seatedPlayerIds[1]);
    syncRoom(nextMatch, {
      started: true,
      turn_player_id: nextMatch.currentPlayerId,
      turn_order: nextMatch.playerOrder,
    });
  }

  function drawFromStock() {
    if (!canAct || match.phase !== "draw" || !match.stock?.length) return;
    setPendingFinishMode(null);
    setSelectedCardId(null);
    const drawn = match.stock[match.stock.length - 1];
    const nextHand = sortCards([...(myMatchPlayer?.hand ?? []), drawn]);
    const nextStock = match.stock.slice(0, -1);
    const nextMatch = {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...myMatchPlayer,
          hand: nextHand,
        },
      },
      stock: nextStock,
      phase: "discard",
      message: `${myMatchPlayer?.name ?? "Spelare"} drog från högen. Kasta ett kort.`,
    };
    if (nextStock.length <= 2) {
      const resetMatch = dealNextHand(
        {
          ...match,
          players: {
            ...match.players,
            [playerId]: {
              ...myMatchPlayer,
              hand: nextHand,
            },
          },
          stock: nextStock,
        },
        seatedPlayers
      );
      resetMatch.message = "Giv avbröts eftersom draghögen blev för liten. Ny giv utdelad.";
      syncRoom(resetMatch, {
        started: true,
        turn_player_id: resetMatch.currentPlayerId,
        turn_order: resetMatch.playerOrder,
      });
      return;
    }
    syncRoom(nextMatch);
  }

  function drawFromDiscard() {
    if (!canAct || !match.discard?.length) return;
    if (match.phase === "draw") {
      setPendingFinishMode(null);
      setSelectedCardId(null);
      const drawn = match.discard[match.discard.length - 1];
      const nextMatch = {
        ...match,
        players: {
          ...match.players,
          [playerId]: {
            ...myMatchPlayer,
            hand: sortCards([...(myMatchPlayer?.hand ?? []), drawn]),
          },
        },
        discard: match.discard.slice(0, -1),
        phase: "discard",
        message: `${myMatchPlayer?.name ?? "Spelare"} tog slängkortet ${cardLabel(drawn)}.`,
      };
      syncRoom(nextMatch);
      return;
    }

    if (match.phase === "discard" && selectedCardId) {
      if (pendingFinishMode) {
        finishRound(pendingFinishMode, selectedCardId);
        return;
      }
      discardCard(selectedCardId);
    }
  }

  function discardCard(cardId) {
    if (!canAct || match.phase !== "discard") return;
    setPendingFinishMode(null);
    setSelectedCardId(null);
    const hand = myMatchPlayer?.hand ?? [];
    const card = hand.find((entry) => entry.id === cardId);
    if (!card) return;
    const nextHand = sortCards(hand.filter((entry) => entry.id !== cardId));
    const nextTurnId = nextPlayerId(match.playerOrder, playerId);
    const nextMatch = {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...myMatchPlayer,
          hand: nextHand,
        },
      },
      discard: [...(match.discard ?? []), card],
      currentPlayerId: nextTurnId,
      phase: "draw",
      revealHands: false,
      message: `${myMatchPlayer?.name ?? "Spelare"} kastade ${cardLabel(card)}. Turen gick vidare till ${
        match.players?.[nextTurnId]?.name ?? "Spelare"
      }.`,
    };
    syncRoom(nextMatch, { turn_player_id: nextTurnId });
  }

  function finishRound(mode, discardCardId) {
    if (!canAct || match.phase !== "discard") return;
    const hand = myMatchPlayer?.hand ?? [];
    const discardCard = hand.find((card) => card.id === discardCardId);
    if (!discardCard) return;
    const result = evaluateAfterDiscard(hand, discardCard.id);
    if (mode === "gin" && result.evaluation.deadwood !== 0) return;
    if (mode === "knock" && result.evaluation.deadwood > 10) return;
    const adjustedMatch = {
      ...match,
      players: {
        ...match.players,
        [playerId]: {
          ...myMatchPlayer,
          hand: result.hand,
        },
      },
      discard: [...(match.discard ?? []), discardCard],
    };
    setPendingFinishMode(null);
    setSelectedCardId(null);
    const resolved = resolveRound(adjustedMatch, playerId, mode);
    syncRoom(resolved, { turn_player_id: null });
  }

  function nextHand() {
    if (!isHost || !match || match.status !== "roundOver") return;
    const nextMatch = dealNextHand(match, seatedPlayers);
    syncRoom(nextMatch, {
      started: true,
      turn_player_id: nextMatch.currentPlayerId,
      turn_order: nextMatch.playerOrder,
    });
  }

  function restartMatch() {
    if (!isHost || playerCount < 2 || tooManyPlayers) return;
    const nextMatch = createMatchState(seatedPlayerIds.slice(0, 2), seatedPlayers, {}, 1, seatedPlayerIds[1]);
    syncRoom(nextMatch, {
      started: true,
      turn_player_id: nextMatch.currentPlayerId,
      turn_order: nextMatch.playerOrder,
    });
  }

  const inviteCandidates = (friends ?? []).filter(
    (friend) => !sentInvites?.[friend.id]
  );

  function handleAutoSort() {
    setPendingFinishMode(null);
    setDraggedCardId(null);
    setDragTargetCardId(null);
    setSelectedCardId(null);
    setHandOrder(buildAutoOrderedIds(myMatchPlayer?.hand ?? []));
  }

  function handleHandCardPress(cardId) {
    if (!bottomIsMe) return;
    if (pendingFinishMode || (canAct && match?.phase === "discard")) {
      setSelectedCardId((current) => (current === cardId ? null : cardId));
    }
  }

  function handleHandCardDragStart(cardId) {
    if (!bottomIsMe || pendingFinishMode) return;
    setDraggedCardId(cardId);
    setDragTargetCardId(null);
  }

  function handleHandCardDrop(targetCardId) {
    if (!draggedCardId || draggedCardId === targetCardId || pendingFinishMode) {
      setDraggedCardId(null);
      setDragTargetCardId(null);
      return;
    }
    setHandOrder((current) => {
      const base = current.length ? [...current] : [...effectiveHandOrder];
      const next = [...base];
      const fromIndex = next.indexOf(draggedCardId);
      const toIndex = next.indexOf(targetCardId);
      if (fromIndex === -1 || toIndex === -1) return current.length ? current : base;
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
    setDraggedCardId(null);
    setDragTargetCardId(null);
  }

  function handleHandCardDragEnd() {
    setDraggedCardId(null);
    setDragTargetCardId(null);
  }

  useEffect(() => {
    if (!isHost || !match || match.status !== "playing" || !botPlayer) return;
    if (match.currentPlayerId !== botPlayer.id) return;
    const botState = match.players?.[botPlayer.id];
    if (!botState) return;
    const turnKey = `${match.updatedAt ?? "na"}:${match.currentPlayerId}:${match.phase}`;
    if (botTurnHandledRef.current === turnKey) return;

    const timeoutId = setTimeout(() => {
      if (botTurnHandledRef.current === turnKey) return;
      botTurnHandledRef.current = turnKey;
      const botHand = botState.hand ?? [];
      if (match.phase === "draw") {
        const stockCard = match.stock?.[match.stock.length - 1] ?? null;
        const discardCardTop = match.discard?.[match.discard.length - 1] ?? null;
        const stockDeadwood = stockCard
          ? evaluateHand(sortCards([...botHand, stockCard])).deadwood
          : Number.POSITIVE_INFINITY;
        const discardDeadwood = discardCardTop
          ? evaluateHand(sortCards([...botHand, discardCardTop])).deadwood
          : Number.POSITIVE_INFINITY;

        if (discardCardTop && discardDeadwood <= stockDeadwood) {
          const nextMatch = {
            ...match,
            players: {
              ...match.players,
              [botPlayer.id]: {
                ...botState,
                hand: sortCards([...botHand, discardCardTop]),
              },
            },
            discard: match.discard.slice(0, -1),
            phase: "discard",
            message: `${botState.name} tog slängkortet ${cardLabel(discardCardTop)}.`,
          };
          syncRoom(nextMatch);
          return;
        }

        if (!stockCard) return;
        const nextHand = sortCards([...botHand, stockCard]);
        const nextStock = match.stock.slice(0, -1);
        const nextMatch = {
          ...match,
          players: {
            ...match.players,
            [botPlayer.id]: {
              ...botState,
              hand: nextHand,
            },
          },
          stock: nextStock,
          phase: "discard",
          message: `${botState.name} drog från högen.`,
        };
        if (nextStock.length <= 2) {
          const resetMatch = dealNextHand(
            {
              ...match,
              players: {
                ...match.players,
                [botPlayer.id]: {
                  ...botState,
                  hand: nextHand,
                },
              },
              stock: nextStock,
            },
            seatedPlayers
          );
          resetMatch.message = "Giv avbröts eftersom draghögen blev för liten. Ny giv utdelad.";
          syncRoom(resetMatch, {
            started: true,
            turn_player_id: resetMatch.currentPlayerId,
            turn_order: resetMatch.playerOrder,
          });
          return;
        }
        syncRoom(nextMatch);
        return;
      }

      if (match.phase === "discard") {
        let bestKnock = null;
        let bestGin = null;
        botHand.forEach((card) => {
          const result = evaluateAfterDiscard(botHand, card.id);
          const candidate = { card, ...result };
          if (result.evaluation.deadwood === 0 && !bestGin) bestGin = candidate;
          if (result.evaluation.deadwood <= 10) {
            if (!bestKnock || result.evaluation.deadwood < bestKnock.evaluation.deadwood) {
              bestKnock = candidate;
            }
          }
        });

        if (bestGin) {
          const adjustedMatch = {
            ...match,
            players: {
              ...match.players,
              [botPlayer.id]: {
                ...botState,
                hand: bestGin.hand,
              },
            },
            discard: [...(match.discard ?? []), bestGin.card],
          };
          const resolved = resolveRound(adjustedMatch, botPlayer.id, "gin");
          syncRoom(resolved, { turn_player_id: null });
          return;
        }

        if (bestKnock) {
          const opponentMatchPlayer = match.players?.[nextPlayerId(match.playerOrder, botPlayer.id)];
          const opponentEval = evaluateHand(opponentMatchPlayer?.hand ?? []);
          const laidOff = calculateLayoffDeadwood(opponentEval.deadwoodCards, bestKnock.evaluation.melds);
          if (laidOff > bestKnock.evaluation.deadwood) {
            const adjustedMatch = {
              ...match,
              players: {
                ...match.players,
                [botPlayer.id]: {
                  ...botState,
                  hand: bestKnock.hand,
                },
              },
              discard: [...(match.discard ?? []), bestKnock.card],
            };
            const resolved = resolveRound(adjustedMatch, botPlayer.id, "knock");
            syncRoom(resolved, { turn_player_id: null });
            return;
          }
        }

        const discard = pickBestDiscard(botHand);
        if (!discard) return;
        const nextHand = sortCards(botHand.filter((entry) => entry.id !== discard.id));
        const nextTurnId = nextPlayerId(match.playerOrder, botPlayer.id);
        const nextMatch = {
          ...match,
          players: {
            ...match.players,
            [botPlayer.id]: {
              ...botState,
              hand: nextHand,
            },
          },
          discard: [...(match.discard ?? []), discard],
          currentPlayerId: nextTurnId,
          phase: "draw",
          revealHands: false,
          message: `${botState.name} kastade ${cardLabel(discard)}.`,
        };
        syncRoom(nextMatch, { turn_player_id: nextTurnId });
      }
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [botPlayer, isHost, match, seatedPlayers, syncRoom]);

  return (
    <Card style={{ padding: 20, display: "grid", gap: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#fcd34d", fontWeight: 900, letterSpacing: 0.3 }}>Gin Rummy Online</div>
          <div style={{ color: "var(--muted)", fontWeight: 700 }}>
            Rumskod: <b>{roomCode?.toUpperCase() || "------"}</b> · 2 spelare
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" style={{ width: "auto" }} onClick={onOpenChat}>
            Chat{chatUnread > 0 ? ` (${chatUnread})` : ""}
          </Button>
          {isHost && !hasBot && playerCount < 2 && (
            <Button variant="ghost" style={{ width: "auto" }} onClick={onAddBot}>
              Lägg till bot
            </Button>
          )}
          {isHost && hasBot && (
            <Button variant="ghost" style={{ width: "auto" }} onClick={onRemoveBot}>
              Ta bort bot
            </Button>
          )}
          <Button variant="ghost" style={{ width: "auto" }} onClick={onShareRoom}>
            Dela rum
          </Button>
          <Button variant="ghost" style={{ width: "auto" }} onClick={onBack}>
            Tillbaka
          </Button>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          borderRadius: 26,
          padding: "18px clamp(12px, 3vw, 28px)",
          border: "1px solid rgba(250,204,21,.18)",
          background: [
            "radial-gradient(circle at top, rgba(250,204,21,.08), transparent 35%)",
            "radial-gradient(circle at bottom, rgba(255,255,255,.06), transparent 35%)",
            "linear-gradient(180deg, rgba(12,74,50,.98), rgba(7,56,42,.98))",
          ].join(", "),
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 24px 60px rgba(2,6,23,.28)",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            justifySelf: "center",
            width: "min(100%, 720px)",
            borderRadius: 18,
            padding: 14,
            border: topSeat
              ? match?.currentPlayerId === topSeat.id
                ? "1px solid rgba(250,204,21,.55)"
                : "1px solid rgba(255,255,255,.12)"
              : "1px dashed rgba(255,255,255,.18)",
            background: topSeat ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.025)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>{topSeat?.name ?? "Väntar på motståndare"}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {topSeat ? (topIsMe ? "Du" : "Motståndare") : "Säte 2"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 22 }}>{Number(topSeat?.score) || 0}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>poäng</div>
            </div>
          </div>
          {topSeat ? (
            topHandCards.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", justifyContent: "center", minWidth: 0 }}>
                {topHandCards.map((card) => (
                  <CardToken key={card.id} card={card} hidden={Boolean(card.hidden)} compact />
                ))}
              </div>
            ) : (
              <PlaceholderCards compact />
            )
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", fontWeight: 700, padding: "10px 0" }}>
              Dela rumskoden eller skicka en inbjudan så fylls sätet direkt.
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            gap: 16,
            alignItems: "center",
            minHeight: 150,
          }}
        >
          <div
            style={{
              justifySelf: "center",
              display: "grid",
              gap: 8,
              textAlign: "center",
            }}
          >
            <div style={{ color: "rgba(255,255,255,.72)", fontWeight: 800, letterSpacing: 0.3 }}>
              Draghög
            </div>
            <CardToken
              card={{ suit: "spades", rank: 1 }}
              hidden
              accent={canAct && match?.phase === "draw"}
              disabled={!canAct || match?.phase !== "draw" || !(match?.stock?.length > 0)}
              onClick={match ? drawFromStock : undefined}
            />
            <div style={{ color: "rgba(255,255,255,.62)", fontSize: 12 }}>
              {match ? `${match.stock?.length ?? 0} kort kvar` : "52 kort redo"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 999,
              padding: "14px 18px",
              background: "rgba(3,24,19,.55)",
              border: "1px solid rgba(250,204,21,.2)",
              textAlign: "center",
              minWidth: 200,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
            }}
          >
            <div style={{ color: "#fcd34d", fontWeight: 900, letterSpacing: 0.4 }}>
              {match ? `Hand ${match.handNumber}` : "Lobby"}
            </div>
            <div style={{ marginTop: 6, fontWeight: 800 }}>
              {tooManyPlayers
                ? "För många spelare"
                : match
                ? currentPlayer?.name ?? "Väntar"
                : lobbyReady
                ? "Klar att starta"
                : "Väntar på spelare"}
            </div>
            <div style={{ marginTop: 4, color: "rgba(255,255,255,.68)", fontSize: 13, lineHeight: 1.4 }}>
              {match
                ? match.message
                : tooManyPlayers
                ? "Gin Rummy-rummet stöder exakt 2 spelare."
                : lobbyReady
                ? "Bordet är uppdukat. Värden kan starta direkt."
                : hasBot
                ? "Bordet är uppdukat med en testbot så att du kan prova mekaniken direkt."
                : "Du är redan inne på spelbordet. Nu saknas bara en motståndare."}
            </div>
          </div>

          <div
            style={{
              justifySelf: "center",
              display: "grid",
              gap: 8,
              textAlign: "center",
            }}
          >
            <div style={{ color: "rgba(255,255,255,.72)", fontWeight: 800, letterSpacing: 0.3 }}>
              Slänghög
            </div>
            {match?.discard?.length ? (
              <CardToken
                card={match.discard[match.discard.length - 1]}
                accent={
                  (canAct && match.phase === "draw") ||
                  (canAct && match.phase === "discard" && Boolean(selectedCardId))
                }
                disabled={!canAct || (match.phase === "discard" && !selectedCardId)}
                onClick={drawFromDiscard}
              />
            ) : (
              <CardToken card={{ suit: "hearts", rank: 12 }} disabled />
            )}
            <div style={{ color: "rgba(255,255,255,.62)", fontSize: 12 }}>
              {match?.discard?.length ? "Ta översta kortet" : "Tom tills matchen startar"}
            </div>
          </div>
        </div>

        <div
          style={{
            justifySelf: "center",
            width: "min(100%, 760px)",
            borderRadius: 18,
            padding: 14,
            border: bottomSeat
              ? match?.currentPlayerId === bottomSeat.id
                ? "1px solid rgba(250,204,21,.55)"
                : "1px solid rgba(255,255,255,.12)"
              : "1px dashed rgba(255,255,255,.18)",
            background: bottomSeat ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.025)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900 }}>{bottomSeat?.name ?? "Tom plats"}</div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {bottomSeat ? (bottomIsMe ? "Du" : "Spelare 1") : "Din plats"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 22 }}>{Number(bottomSeat?.score) || 0}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>poäng</div>
            </div>
          </div>
          {bottomSeat ? (
            bottomHandCards.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", justifyContent: "center", minWidth: 0 }}>
                {bottomHandCards.map((card) => (
                  <CardToken
                    key={card.id}
                    card={card}
                    accent={selectedCardId === card.id}
                    melded={myMeldCardIds.has(card.id)}
                    disabled={!bottomIsMe}
                    draggable={bottomIsMe && !pendingFinishMode}
                    dragging={draggedCardId === card.id}
                    dragTarget={dragTargetCardId === card.id}
                    onDragStart={() => handleHandCardDragStart(card.id)}
                    onDragEnd={handleHandCardDragEnd}
                    onDragOver={(event) => {
                      if (!pendingFinishMode) event.preventDefault();
                    }}
                    onDragEnter={() => {
                      if (!pendingFinishMode && draggedCardId && draggedCardId !== card.id) {
                        setDragTargetCardId(card.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragTargetCardId === card.id) {
                        setDragTargetCardId(null);
                      }
                    }}
                    onDrop={() => handleHandCardDrop(card.id)}
                    onClick={bottomIsMe ? () => handleHandCardPress(card.id) : undefined}
                  />
                ))}
              </div>
            ) : (
              <PlaceholderCards />
            )
          ) : (
            <div style={{ color: "var(--muted)", textAlign: "center", fontWeight: 700, padding: "12px 0" }}>
              Din plats blir aktiv direkt när du är med i rummet.
            </div>
          )}
        </div>
      </div>

      {!match && (
        <div
          style={{
            borderRadius: 14,
            padding: 14,
            border: "1px solid rgba(148,163,184,.24)",
            background: "rgba(15,23,42,.32)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 800 }}>
            {tooManyPlayers
              ? "Det finns för många spelare i rummet för Gin Rummy."
              : lobbyReady
              ? "Lobbyn är klar. Värden kan starta matchen."
              : "Bjud in en motståndare eller dela rumskoden för att börja."}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            Matchen spelas online mellan exakt 2 spelare, med samma rumssystem som 12:an.
          </div>
          {isHost && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={startMatch} disabled={!lobbyReady || tooManyPlayers}>
                Starta match
              </Button>
            </div>
          )}
        </div>
      )}

      {!match && inviteCandidates.length > 0 && (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,.18)",
            background: "rgba(255,255,255,.03)",
            padding: 14,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 800 }}>Bjud in en vän</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {inviteCandidates.slice(0, 8).map((friend) => (
              <Button
                key={friend.id}
                variant="ghost"
                style={{ width: "auto" }}
                onClick={() => onSendRoomInvite?.(friend.id)}
              >
                {friend.display_name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {match && (
        <>
          {(match.status === "playing" || match.status === "roundOver" || match.status === "gameOver") && (
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900 }}>Din hand</div>
                    <div style={{ color: "var(--muted)", fontSize: 13 }}>
                      Dödved: {myEvaluation?.deadwood ?? "-"} · Melds: {myEvaluation?.melds.length ?? 0} · Mål: {targetScore} poäng
                    </div>
                    {!pendingFinishMode && (
                      <div style={{ color: "#93c5fd", fontSize: 12, fontWeight: 700 }}>
                        Dra kort i huvudraden på bordet för att byta plats. Klicka på ett kort där och klicka sedan på slänghögen för att kasta.
                      </div>
                    )}
                    {pendingFinishMode && (
                      <div style={{ color: "#fcd34d", fontSize: 12, fontWeight: 700 }}>
                        Markera vilket kort du vill slänga och klicka sedan på slänghögen för att {pendingFinishMode === "gin" ? "gå gin" : "knacka"}.
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="ghost" style={{ width: "auto" }} onClick={handleAutoSort}>
                      Autosortera
                    </Button>
                    <Button
                      variant={pendingFinishMode === "knock" ? "primary" : "ghost"}
                      style={{ width: "auto" }}
                      disabled={!canKnock}
                      onClick={() => {
                        setDraggedCardId(null);
                        setSelectedCardId(null);
                        setPendingFinishMode((current) => (current === "knock" ? null : "knock"));
                      }}
                    >
                      Knacka
                    </Button>
                    <Button
                      variant={pendingFinishMode === "gin" ? "primary" : "ghost"}
                      style={{ width: "auto" }}
                      disabled={!canGin}
                      onClick={() => {
                        setDraggedCardId(null);
                        setSelectedCardId(null);
                        setPendingFinishMode((current) => (current === "gin" ? null : "gin"));
                      }}
                    >
                      Gin
                    </Button>
                    <Button
                      variant="ghost"
                      style={{ width: "auto" }}
                      onClick={() => setShowRules((value) => !value)}
                    >
                      {showRules ? "Dölj regler" : "Visa regler"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(match.status === "roundOver" || match.status === "gameOver") && match.roundSummary && (
            <div
              style={{
                borderRadius: 16,
                border: "1px solid rgba(250,204,21,.35)",
                background: "linear-gradient(180deg, rgba(250,204,21,.12), rgba(15,23,42,.4))",
                padding: 16,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: 20 }}>
                  {match.status === "gameOver" ? "Match klar" : "Hand klar"}
                </div>
                <div style={{ color: "var(--muted)" }}>{match.roundSummary.detail}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {match.playerOrder.map((id) => {
                  const player = match.players[id];
                  const info =
                    id === match.roundSummary.actorId
                      ? {
                          deadwood: match.roundSummary.actorDeadwood,
                          melds: match.roundSummary.actorMelds,
                        }
                      : {
                          deadwood: match.roundSummary.opponentDeadwood,
                          melds: match.roundSummary.opponentMelds,
                        };
                  return (
                    <div
                      key={id}
                      style={{
                        borderRadius: 14,
                        border: "1px solid rgba(148,163,184,.22)",
                        background: "rgba(255,255,255,.04)",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 900 }}>{player?.name ?? "Spelare"}</div>
                        <div style={{ fontWeight: 900 }}>{player?.score ?? 0} p</div>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>Dödved: {info.deadwood}</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {info.melds.length === 0 && (
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>Inga melds</div>
                        )}
                        {info.melds.map((meld, index) => (
                          <div
                            key={`${id}-${meld.type}-${index}`}
                            style={{ display: "flex", gap: 6, flexWrap: "nowrap", minWidth: 0 }}
                          >
                            {meld.cards.map((card) => (
                              <CardToken key={card.id} card={card} compact />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {isHost && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {match.status === "roundOver" && <Button onClick={nextHand}>Nästa giv</Button>}
                  {match.status === "gameOver" && <Button onClick={restartMatch}>Ny match</Button>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showRules && (
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,.18)",
            background: "rgba(255,255,255,.03)",
            padding: 14,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 800 }}>Regler</div>
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
            Varje spelare får 10 kort. På din tur drar du 1 kort och slänger sedan 1 kort. Tretal,
            fyrtal och stegar i samma färg är melds, och ett kort får bara användas i en enda meld.
            När du vill knacka eller gå gin väljer du först läget och sedan vilket kort som ska slängas.
            Vid knock får vinnaren mellanskillnaden i dödved efter layoff. Om motståndaren undercutar får den
            10 bonuspoäng plus mellanskillnaden. Gin ger 25 bonuspoäng plus motståndarens återstående dödved.
            Först till 100 poäng vinner matchen.
          </div>
          {!inRoom && (
            <div style={{ color: "#fca5a5", fontWeight: 700, fontSize: 13 }}>
              Du är inte registrerad som spelare i det här rummet just nu.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
