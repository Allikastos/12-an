import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_SYMBOL = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  joker: "★",
};

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buildDeck() {
  const cards = [];
  let id = 0;
  for (let deckNo = 0; deckNo < 2; deckNo += 1) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank += 1) {
        cards.push({ id: `c-${deckNo}-${suit}-${rank}-${id++}`, suit, rank, joker: false });
      }
    }
  }
  for (let j = 0; j < 4; j += 1) {
    cards.push({ id: `j-${j}-${id++}`, suit: "joker", rank: 0, joker: true });
  }
  return shuffle(cards);
}

function rankLabel(rank) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 0) return "Joker";
  return String(rank);
}

function cardLabel(card) {
  if (!card) return "—";
  if (card.joker) return "Joker ★";
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

function isRedThree(card) {
  return !card.joker && card.rank === 3 && (card.suit === "hearts" || card.suit === "diamonds");
}

function isBlackThree(card) {
  return !card.joker && card.rank === 3 && (card.suit === "spades" || card.suit === "clubs");
}

function isWild(card) {
  return card.joker || card.rank === 2;
}

function cardPoints(card) {
  if (card.joker) return 50;
  if (card.rank === 2) return 25;
  if (card.rank === 1) return 25;
  if (card.rank >= 8 && card.rank <= 13) return 10;
  if (card.rank >= 4 && card.rank <= 7) return 5;
  if (card.rank === 3 && (card.suit === "spades" || card.suit === "clubs")) return -100;
  return 0;
}

function openingRequirement(total) {
  if (total < 1500) return 60;
  if (total < 3000) return 90;
  if (total < 5000) return 120;
  return "canasta";
}

function drawOneWithRedThreeRule(state, playerIndex) {
  const stock = [...state.stock];
  const players = state.players.map((p) => ({ ...p, hand: [...p.hand], redThrees: [...p.redThrees] }));
  while (stock.length > 0) {
    const next = stock.pop();
    if (isRedThree(next)) {
      players[playerIndex].redThrees.push(next);
      continue;
    }
    players[playerIndex].hand.push(next);
    return { ...state, stock, players };
  }
  return { ...state, stock, players };
}

function seatPosition(index, total) {
  const map = {
    2: [
      { top: "6%", left: "50%" },
      { top: "92%", left: "50%" },
    ],
    3: [
      { top: "7%", left: "50%" },
      { top: "76%", left: "14%" },
      { top: "76%", left: "86%" },
    ],
    4: [
      { top: "7%", left: "50%" },
      { top: "34%", left: "93%" },
      { top: "92%", left: "50%" },
      { top: "34%", left: "7%" },
    ],
    5: [
      { top: "6%", left: "50%" },
      { top: "24%", left: "90%" },
      { top: "79%", left: "82%" },
      { top: "79%", left: "18%" },
      { top: "24%", left: "10%" },
    ],
    6: [
      { top: "6%", left: "50%" },
      { top: "22%", left: "89%" },
      { top: "80%", left: "89%" },
      { top: "92%", left: "50%" },
      { top: "80%", left: "11%" },
      { top: "22%", left: "11%" },
    ],
  };
  return map[total]?.[index] ?? { top: "50%", left: "50%" };
}

function meldZonePlacement(anchorIndex, total, zoneCount) {
  const anchor = seatPosition(anchorIndex, total);
  const leftPct = Number.parseFloat(String(anchor.left).replace("%", ""));
  const topPct = Number.parseFloat(String(anchor.top).replace("%", ""));
  const baseWidth = zoneCount >= 5 ? 164 : zoneCount === 4 ? 176 : 192;

  let x = leftPct + 14;
  let y = topPct;
  // Requested layout:
  // - Left-side player: zone below
  // - Right-side player: zone above
  // - Top player: zone to the left
  if (topPct <= 14) {
    x = leftPct - 24;
    y = topPct + 2;
  } else if (leftPct <= 24) {
    x = leftPct + 4;
    y = topPct + 22;
  } else if (leftPct >= 76) {
    x = leftPct - 4;
    y = topPct - 22;
  } else if (topPct >= 84) {
    x = leftPct + 24;
    y = topPct - 2;
  }

  const clampedX = Math.max(9, Math.min(94, x));
  const clampedY = Math.max(10, Math.min(90, y));
  return { left: clampedX, top: clampedY, width: baseWidth };
}

function buildMeldPreviewCards(title, meld) {
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

function TeamMelds({ title, redThreeCount, melds }) {
  function getMeldCardMetrics(meld, totalMelds) {
    let density = 0;
    if ((meld?.cards?.length ?? 0) > 7) density += 1;
    if ((meld?.cards?.length ?? 0) > 9) density += 1;
    if (totalMelds > 4) density += 1;
    if (totalMelds > 6) density += 1;

    if (density >= 3) return { w: 19, h: 29, step: 5 };
    if (density >= 2) return { w: 21, h: 32, step: 6 };
    if (density >= 1) return { w: 24, h: 36, step: 7 };
    return { w: 27, h: 40, step: 8 };
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(191,219,254,.32)",
        background: "linear-gradient(180deg, rgba(2,6,23,.34), rgba(2,6,23,.22))",
        backdropFilter: "blur(2px)",
        padding: 10,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 12 }}>{title}</div>
      {redThreeCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: Math.min(4, redThreeCount) }, (_, idx) => (
            <span
              key={`${title}-r3-${idx}`}
              style={{
                width: 18,
                height: 24,
                borderRadius: 4,
                border: "1px solid rgba(15,23,42,.25)",
                background: "#fff",
                color: "#b91c1c",
                display: "grid",
                placeItems: "center",
                fontWeight: 800,
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              3♥
            </span>
          ))}
          {redThreeCount > 4 ? (
            <span style={{ color: "#fecaca", fontWeight: 800, fontSize: 11 }}>+{redThreeCount - 4}</span>
          ) : null}
        </div>
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}>
        {melds.map((m, idx) => {
          const preview = buildMeldPreviewCards(title, m).slice(0, 7);
          const metrics = getMeldCardMetrics(m, melds.length);
          return (
            <div key={`${title}-${m.rank}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  position: "relative",
                  height: metrics.h,
                  width: Math.min(7, preview.length) * metrics.step + metrics.w - metrics.step,
                }}
              >
                {preview.map((c, cardIdx) => (
                  <div
                    key={c.id}
                    style={{
                      position: "absolute",
                      left: cardIdx * metrics.step,
                      top: 0,
                      zIndex: 100 - cardIdx,
                      width: metrics.w,
                      height: metrics.h,
                      borderRadius: 5,
                      overflow: "hidden",
                      boxShadow: "0 4px 8px rgba(2,6,23,.35)",
                      border: "1px solid rgba(15,23,42,.28)",
                      background: "#fff",
                    }}
                  >
                    <CanastaFace card={c} compact />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const PIP_LAYOUT = {
  1: [[50, 50]],
  2: [[50, 22], [50, 78]],
  3: [[50, 20], [50, 50], [50, 80]],
  4: [[32, 24], [68, 24], [32, 76], [68, 76]],
  5: [[32, 24], [68, 24], [50, 50], [32, 76], [68, 76]],
  6: [[32, 20], [68, 20], [32, 50], [68, 50], [32, 80], [68, 80]],
  7: [[32, 20], [68, 20], [50, 36], [32, 50], [68, 50], [32, 80], [68, 80]],
  8: [[32, 18], [68, 18], [32, 38], [68, 38], [32, 62], [68, 62], [32, 82], [68, 82]],
  9: [[32, 18], [68, 18], [32, 38], [68, 38], [50, 50], [32, 62], [68, 62], [32, 82], [68, 82]],
  10: [[32, 16], [68, 16], [50, 30], [32, 40], [68, 40], [32, 60], [68, 60], [50, 70], [32, 84], [68, 84]],
};

function CanastaFace({ card, compact = false }) {
  if (!card) return <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span>;
  const suit = card.joker ? "★" : SUIT_SYMBOL[card.suit];
  const rank = card.joker ? "Joker" : rankLabel(card.rank);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const ink = card.joker ? "#1d4ed8" : isRed ? "#b91c1c" : "#111827";
  const pips = !card.joker && card.rank <= 10 ? PIP_LAYOUT[card.rank] ?? [] : [];
  const isFace = !card.joker && card.rank >= 11;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: compact ? 8 : 9,
        border: "1px solid rgba(15,23,42,.28)",
        background: "linear-gradient(180deg, #ffffff, #fbfdff)",
        color: ink,
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.8), 0 1px 3px rgba(2,6,23,.22)",
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div style={{ position: "absolute", left: compact ? 5 : 6, top: compact ? 4 : 5, lineHeight: 1, textAlign: "center" }}>
        <div style={{ fontSize: compact ? 11 : 13, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: compact ? 10 : 12 }}>{suit}</div>
      </div>
      <div
        style={{
          position: "absolute",
          right: compact ? 5 : 6,
          bottom: compact ? 4 : 5,
          lineHeight: 1,
          textAlign: "center",
          transform: "rotate(180deg)",
        }}
      >
        <div style={{ fontSize: compact ? 11 : 13, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: compact ? 10 : 12 }}>{suit}</div>
      </div>

      {card.joker ? (
        <div style={{ position: "absolute", inset: "26% 16%", display: "grid", placeItems: "center", gap: 2 }}>
          <div style={{ fontSize: compact ? 16 : 20, lineHeight: 1 }}>★</div>
          <div style={{ fontSize: compact ? 9 : 11, fontWeight: 700, letterSpacing: ".04em" }}>JOKER</div>
        </div>
      ) : isFace ? (
        <div
          style={{
            position: "absolute",
            inset: "24% 22%",
            borderRadius: 6,
            border: "1px solid color-mix(in srgb, currentColor 30%, transparent)",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(180deg, rgba(255,255,255,.86), rgba(241,245,249,.74))",
          }}
        >
          <div style={{ fontSize: compact ? 16 : 21, fontWeight: 700, lineHeight: 1 }}>{rank}</div>
          <div style={{ fontSize: compact ? 12 : 16, lineHeight: 1 }}>{suit}</div>
        </div>
      ) : (
        <div style={{ position: "absolute", inset: compact ? "15% 14%" : "14% 13%" }}>
          {pips.map(([x, y], idx) => (
            <span
              key={`${card.id}-pip-${idx}`}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) ${y > 50 ? "rotate(180deg)" : ""}`,
                fontSize: compact ? 11 : 15,
                lineHeight: 1,
              }}
            >
              {suit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function makeGame({ names, mode }) {
  const stock = buildDeck();
  const playerCount = names.length;
  const teamCount = mode === "team" ? (playerCount === 6 ? 3 : 2) : 0;
  const players = names.map((name, idx) => ({
    id: `p${idx + 1}`,
    name: name.trim() || (mode === "single" && idx > 0 ? `Bot ${idx}` : `Spelare ${idx + 1}`),
    teamId: mode === "single" ? `solo-${idx + 1}` : `team-${(idx % teamCount) + 1}`,
    isBot: mode === "single" && idx > 0,
    hand: [],
    redThrees: [],
  }));

  const teams = {};
  for (const p of players) {
    if (!teams[p.teamId]) teams[p.teamId] = { opened: false, melds: [] };
  }

  let state = {
    mode,
    stock,
    discard: [],
    players,
    teams,
    turnIndex: 0,
    phase: "draw",
    roundEnded: false,
    winnerPlayerId: null,
    winnerTeamId: null,
    notice: "Canasta startad.",
  };

  for (let r = 0; r < 11; r += 1) {
    for (let p = 0; p < players.length; p += 1) {
      state = drawOneWithRedThreeRule(state, p);
    }
  }

  while (state.stock.length > 0) {
    const top = state.stock[state.stock.length - 1];
    state.stock = state.stock.slice(0, -1);
    if (!isRedThree(top)) {
      state.discard = [top];
      break;
    }
  }

  return state;
}

function teamCanastaCount(team) {
  if (!team?.melds?.length) return 0;
  return team.melds.filter((m) => m.cards.length >= 7).length;
}

function drawTwoState(state) {
  if (!state || state.roundEnded || state.phase !== "draw") return state;
  let next = state;
  next = drawOneWithRedThreeRule(next, next.turnIndex);
  next = drawOneWithRedThreeRule(next, next.turnIndex);
  return { ...next, phase: "discard", notice: `${next.players[next.turnIndex].name} drog 2 kort.` };
}

function canTakeDiscard(state) {
  const top = state.discard[state.discard.length - 1];
  if (!top || top.joker || isBlackThree(top)) return false;
  const hand = state.players[state.turnIndex].hand;
  const naturals = hand.filter((c) => !isWild(c) && c.rank === top.rank).length;
  return naturals >= 2;
}

function takeDiscardStackState(state) {
  if (!state || state.roundEnded || state.phase !== "draw") return state;
  if (!canTakeDiscard(state)) return { ...state, notice: "Du kan inte ta slänghögen nu." };
  const takeCount = Math.min(10, state.discard.length);
  const taken = state.discard.slice(state.discard.length - takeCount);
  const next = {
    ...state,
    discard: state.discard.slice(0, state.discard.length - takeCount),
    players: state.players.map((p) => ({ ...p, hand: [...p.hand], redThrees: [...p.redThrees] })),
  };
  for (const card of taken) {
    if (isRedThree(card)) next.players[next.turnIndex].redThrees.push(card);
    else next.players[next.turnIndex].hand.push(card);
  }
  return {
    ...next,
    phase: "discard",
    notice: `${next.players[next.turnIndex].name} tog ${takeCount} kort från slänghögen.`,
  };
}

function pickBotMeldCardIds(state) {
  const player = state.players[state.turnIndex];
  const team = state.teams[player.teamId];
  if (!player || !team) return null;
  const hand = player.hand;

  for (const meld of team.melds) {
    const candidate = hand.find((c) => (meld.rank === 0 ? c.joker : (isWild(c) || c.rank === meld.rank)));
    if (candidate) return [candidate.id];
  }

  const byRank = new Map();
  const wilds = [];
  for (const c of hand) {
    if (isWild(c)) wilds.push(c);
    else {
      const arr = byRank.get(c.rank) ?? [];
      arr.push(c);
      byRank.set(c.rank, arr);
    }
  }

  let bestRank = null;
  let bestCount = 0;
  byRank.forEach((arr, rank) => {
    if (rank === 3) return;
    if (arr.length > bestCount) {
      bestCount = arr.length;
      bestRank = rank;
    }
  });

  if (bestRank != null && bestCount >= 3) {
    return byRank.get(bestRank).slice(0, 3).map((c) => c.id);
  }

  if (bestRank != null && bestCount >= 2 && wilds.length > 0) {
    const naturals = byRank.get(bestRank).slice(0, 2).map((c) => c.id);
    return [...naturals, wilds[0].id];
  }

  const jokers = hand.filter((c) => c.joker);
  if (jokers.length >= 3) return jokers.slice(0, 3).map((c) => c.id);

  return null;
}

function pickDiscardCardId(player) {
  const candidates = player.hand.filter((c) => !isRedThree(c));
  if (!candidates.length) return null;
  candidates.sort((a, b) => cardPoints(a) - cardPoints(b));
  return candidates[0].id;
}

function discardState(state, cardId) {
  if (!state || state.roundEnded || state.phase !== "discard") return state;
  const player = state.players[state.turnIndex];
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return state;
  const card = player.hand[idx];
  if (isRedThree(card)) return state;

  const isFinalDiscard = player.hand.length === 1;
  if (isFinalDiscard) {
    const team = state.teams[player.teamId];
    if (teamCanastaCount(team) < 2) {
      return { ...state, notice: "Ni måste ha minst 2 canastor för att få gå ut." };
    }
  }

  const hand = [...player.hand];
  hand.splice(idx, 1);
  const players = state.players.map((p, i) =>
    i === state.turnIndex ? { ...p, hand } : { ...p, hand: [...p.hand], redThrees: [...p.redThrees] }
  );
  const nextTurn = (state.turnIndex + 1) % state.players.length;
  const nextState = {
    ...state,
    players,
    discard: [...state.discard, card],
    turnIndex: nextTurn,
    phase: "draw",
    notice: `${player.name} slängde ${cardLabel(card)}.`,
  };

  if (isFinalDiscard) {
    return {
      ...nextState,
      roundEnded: true,
      winnerPlayerId: player.id,
      winnerTeamId: player.teamId,
      notice: `${player.name} gick ut genom att lägga allt och slänga sista kortet.`,
    };
  }
  return nextState;
}

function applyMeld(state, cardIds, totals) {
  const player = state.players[state.turnIndex];
  const teamId = player.teamId;
  const team = state.teams[teamId];
  const existingByRank = new Map((team?.melds ?? []).map((m, i) => [m.rank, i]));
  const selectedCards = player.hand.filter((c) => cardIds.includes(c.id));
  if (selectedCards.length < 1) return { state, error: "Välj minst 1 kort." };
  if (selectedCards.some((c) => c.rank === 3 && !c.joker)) {
    return { state, error: "Treor kan inte meldas här." };
  }

  const naturals = selectedCards.filter((c) => !isWild(c));
  let rank = null;
  let existingIndex = -1;
  if (naturals.length > 0) {
    rank = naturals[0].rank;
    if (naturals.some((c) => c.rank !== rank)) return { state, error: "Naturliga kort måste ha samma valör." };
    if (rank === 3) return { state, error: "Treor kan inte meldas." };
    existingIndex = existingByRank.has(rank) ? existingByRank.get(rank) : -1;
    if (existingIndex < 0 && naturals.length < 2) {
      return { state, error: "Ny meld kräver minst 2 naturliga kort." };
    }
  } else {
    const addTo = team.melds.findIndex((m) => m.rank !== 0);
    if (addTo >= 0 && selectedCards.every((c) => isWild(c))) {
      rank = team.melds[addTo].rank;
      existingIndex = addTo;
    }
    const onlyJokers = selectedCards.every((c) => c.joker);
    if (rank == null) {
      if (!onlyJokers) return { state, error: "Ren jolle-meld får bara innehålla jokrar." };
      rank = 0;
      existingIndex = existingByRank.has(0) ? existingByRank.get(0) : -1;
    }
  }

  if (existingIndex < 0 && selectedCards.length < 3) {
    return { state, error: "Ny meld kräver minst 3 kort." };
  }

  const nextTeams = { ...state.teams, [teamId]: { ...team, melds: team.melds.map((m) => ({ ...m, cards: [...m.cards] })) } };

  let mergedCards = [];
  if (existingIndex >= 0) {
    mergedCards = [...nextTeams[teamId].melds[existingIndex].cards, ...selectedCards];
    nextTeams[teamId].melds[existingIndex].cards = mergedCards;
  } else {
    mergedCards = [...selectedCards];
    nextTeams[teamId].melds.push({ rank, cards: mergedCards });
  }

  if (rank !== 0 && mergedCards.length >= 7) {
    const mergedNaturals = mergedCards.filter((c) => !isWild(c));
    const mergedWilds = mergedCards.filter((c) => isWild(c));
    if (mergedWilds.length > 0 && mergedNaturals.length < 4) {
      return { state, error: "Oren canasta måste ha minst 4 naturliga kort." };
    }
  }

  const teamTotal =
    state.mode === "single"
      ? Number(totals[state.turnIndex] || 0)
      : state.players
          .map((p, i) => ({ p, i }))
          .filter((x) => x.p.teamId === teamId)
          .reduce((acc, x) => acc + Number(totals[x.i] || 0), 0);

  if (!team.opened) {
    const req = openingRequirement(teamTotal);
    const selectionPoints = selectedCards.reduce((acc, c) => acc + Math.max(0, cardPoints(c)), 0);
    const makesCanasta = mergedCards.length >= 7;
    if (req === "canasta" && !makesCanasta) {
      return { state, error: "Öppningskravet är canasta för laget just nu." };
    }
    if (req !== "canasta" && selectionPoints < req) {
      return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
    }
    nextTeams[teamId].opened = true;
  }

  const hand = player.hand.filter((c) => !cardIds.includes(c.id));
  const nextPlayers = state.players.map((p, i) =>
    i === state.turnIndex ? { ...p, hand, redThrees: [...p.redThrees] } : { ...p, hand: [...p.hand], redThrees: [...p.redThrees] }
  );

  return {
    state: {
      ...state,
      players: nextPlayers,
      teams: nextTeams,
      notice: `${player.name} la ut ${selectedCards.length} kort (${rank === 0 ? "jolle" : rankLabel(rank)}).`,
    },
    error: null,
  };
}

function applyMeldMany(state, cardIds, totals) {
  if (!state || !cardIds?.length) return { state, error: "Välj minst 1 kort." };
  const player = state.players[state.turnIndex];
  const selectedCards = player.hand.filter((c) => cardIds.includes(c.id));
  if (selectedCards.length < 1) return { state, error: "Välj minst 1 kort." };
  if (selectedCards.some((c) => c.rank === 3 && !c.joker)) {
    return { state, error: "Treor kan inte meldas här." };
  }

  const naturals = selectedCards.filter((c) => !isWild(c));
  const wilds = selectedCards.filter((c) => isWild(c));
  const ranks = [...new Set(naturals.map((c) => c.rank))];

  // If selection naturally represents one meld, use existing logic unchanged.
  if (ranks.length <= 1) return applyMeld(state, cardIds, totals);

  // Opening check must validate the entire batch, not each stick individually.
  const teamId = player.teamId;
  const team = state.teams[teamId];
  const teamTotal =
    state.mode === "single"
      ? Number(totals[state.turnIndex] || 0)
      : state.players
          .map((p, i) => ({ p, i }))
          .filter((x) => x.p.teamId === teamId)
          .reduce((acc, x) => acc + Number(totals[x.i] || 0), 0);
  const req = openingRequirement(teamTotal);
  const selectionPoints = selectedCards.reduce((acc, c) => acc + Math.max(0, cardPoints(c)), 0);

  const existingByRank = new Map((team?.melds ?? []).map((m, i) => [m.rank, i]));
  const groups = new Map();
  for (const rank of ranks) groups.set(rank, naturals.filter((c) => c.rank === rank).map((c) => c.id));

  if (wilds.length > 0) {
    let targetRank = null;
    let targetCount = -1;
    let tie = false;
    groups.forEach((ids, rank) => {
      if (ids.length > targetCount) {
        targetRank = rank;
        targetCount = ids.length;
        tie = false;
      } else if (ids.length === targetCount) {
        tie = true;
      }
    });
    if (tie || targetRank == null) {
      return {
        state,
        error: "Välj en tydlig huvudvalör för jokrar/tvåor vid multi-läggning (eller lägg utan trumpf).",
      };
    }
    groups.set(targetRank, [...(groups.get(targetRank) ?? []), ...wilds.map((c) => c.id)]);
  }

  const groupEntries = [...groups.entries()];
  const makesCanasta = groupEntries.some(([rank, ids]) => {
    const existingIndex = existingByRank.has(rank) ? existingByRank.get(rank) : -1;
    const existingLen = existingIndex >= 0 ? (team.melds[existingIndex]?.cards?.length ?? 0) : 0;
    return existingLen + ids.length >= 7;
  });

  if (!team.opened) {
    if (req === "canasta" && !makesCanasta) {
      return { state, error: "Öppningskravet är canasta för laget just nu." };
    }
    if (req !== "canasta" && selectionPoints < req) {
      return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
    }
  }

  let next = state;
  if (!team.opened) {
    // Mark opened once aggregate opening check passes, then apply each stick.
    next = {
      ...state,
      teams: { ...state.teams, [teamId]: { ...state.teams[teamId], opened: true } },
    };
  }

  for (const [, idsForRank] of groupEntries) {
    const result = applyMeld(next, idsForRank, totals);
    if (result.error) return result;
    next = result.state;
  }

  return { state: next, error: null };
}

function shouldUseMeldPlanner(state, cardIds) {
  if (!state || !cardIds?.length) return false;
  const player = state.players[state.turnIndex];
  if (!player) return false;
  const selected = player.hand.filter((c) => cardIds.includes(c.id));
  const ranks = [...new Set(selected.filter((c) => !isWild(c)).map((c) => c.rank))];
  const wildCount = selected.filter((c) => isWild(c)).length;
  return ranks.length > 1 || wildCount > 0;
}

function createMeldPlan(state, cardIds) {
  const player = state.players[state.turnIndex];
  const selected = player.hand.filter((c) => cardIds.includes(c.id));
  const naturals = selected.filter((c) => !isWild(c));
  const wilds = selected.filter((c) => isWild(c));
  const team = state.teams[player.teamId];
  const naturalRanks = [...new Set(naturals.map((c) => c.rank))];
  const existingRanks = [...new Set((team?.melds ?? []).map((m) => m.rank).filter((r) => r !== 0))];
  const targetRanksBase = [...new Set([...naturalRanks, ...existingRanks])].sort((a, b) => a - b);
  const targetRanks = targetRanksBase.length > 0 ? targetRanksBase : [1];
  const defaultRank = naturalRanks[0] ?? targetRanks[0];
  const assignments = {};
  for (const c of selected) assignments[c.id] = isWild(c) ? defaultRank : c.rank;
  return {
    selectedIds: [...cardIds],
    targetRanks,
    assignments,
    activeCardId: wilds[0]?.id ?? selected[0]?.id ?? null,
    error: "",
  };
}

function resolvePlannedGroups(state, plan) {
  const player = state.players[state.turnIndex];
  const selected = player.hand.filter((c) => plan.selectedIds.includes(c.id));
  if (!selected.length) return { groups: [], error: "Inga kort valda." };
  const byRank = new Map();
  for (const card of selected) {
    const target = Number(plan.assignments?.[card.id]);
    if (!Number.isFinite(target)) {
      return { groups: [], error: "Välj stick för alla markerade kort." };
    }
    if (!isWild(card) && target !== card.rank) {
      return { groups: [], error: `${cardLabel(card)} kan bara ligga i stick ${rankLabel(card.rank)}.` };
    }
    const arr = byRank.get(target) ?? [];
    arr.push(card.id);
    byRank.set(target, arr);
  }
  const groups = [...byRank.values()].filter((ids) => ids.length > 0);
  if (groups.length === 0) return { groups: [], error: "Ingen giltig gruppering vald." };
  return { groups, error: null };
}

function applyMeldGroups(state, groupIdsList, selectedIds, totals) {
  if (!state || !groupIdsList?.length) return { state, error: "Ingen gruppering vald." };
  const player = state.players[state.turnIndex];
  const teamId = player.teamId;
  const team = state.teams[teamId];
  const selectedCards = player.hand.filter((c) => selectedIds.includes(c.id));
  if (selectedCards.some((c) => c.rank === 3 && !c.joker)) {
    return { state, error: "Treor kan inte meldas här." };
  }

  const teamTotal =
    state.mode === "single"
      ? Number(totals[state.turnIndex] || 0)
      : state.players
          .map((p, i) => ({ p, i }))
          .filter((x) => x.p.teamId === teamId)
          .reduce((acc, x) => acc + Number(totals[x.i] || 0), 0);
  const req = openingRequirement(teamTotal);
  const selectionPoints = selectedCards.reduce((acc, c) => acc + Math.max(0, cardPoints(c)), 0);

  if (!team.opened) {
    if (req !== "canasta" && selectionPoints < req) {
      return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
    }
    if (req === "canasta") {
      let probe = {
        ...state,
        teams: { ...state.teams, [teamId]: { ...state.teams[teamId], opened: true } },
      };
      for (const ids of groupIdsList) {
        const step = applyMeld(probe, ids, totals);
        if (step.error) return step;
        probe = step.state;
      }
      const oldCanastas = teamCanastaCount(state.teams[teamId]);
      const newCanastas = teamCanastaCount(probe.teams[teamId]);
      if (newCanastas <= oldCanastas) {
        return { state, error: "Öppningskravet är canasta för laget just nu." };
      }
    }
  }

  let next = state;
  if (!team.opened) {
    next = {
      ...state,
      teams: { ...state.teams, [teamId]: { ...state.teams[teamId], opened: true } },
    };
  }
  for (const ids of groupIdsList) {
    const step = applyMeld(next, ids, totals);
    if (step.error) return step;
    next = step.state;
  }
  return { state: next, error: null };
}

export default function CanastaBoard({
  onBack,
  settings: externalSettings = null,
  setSettings: setExternalSettings = null,
  themes = [],
  applyTheme = null,
}) {
  const [stage, setStage] = useState("setup");
  const [mode, setMode] = useState("single");
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(["", "", "", "", "", ""]);
  const [totals, setTotals] = useState([0, 0, 0, 0, 0, 0]);
  const [game, setGame] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [handOrder, setHandOrder] = useState([]);
  const [dragCardId, setDragCardId] = useState(null);
  const [hoverCardId, setHoverCardId] = useState(null);
  const [handDropSide, setHandDropSide] = useState(null);
  const [meldPlan, setMeldPlan] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vibrateOnTurn, setVibrateOnTurn] = useState(true);
  const [turnFlash, setTurnFlash] = useState(false);
  const [inactiveFlash, setInactiveFlash] = useState(false);
  const prevTurnRef = useRef(null);
  const turnFlashTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  const activePlayer = game ? game.players[game.turnIndex] : null;
  const localPlayerIndex = useMemo(() => {
    if (!game?.players?.length) return 0;
    const firstHuman = game.players.findIndex((p) => !p.isBot);
    return firstHuman >= 0 ? firstHuman : 0;
  }, [game]);
  const myPlayer = game ? game.players[localPlayerIndex] : null;
  const topDiscard = game?.discard?.[game.discard.length - 1] ?? null;
  const isBotTurn = Boolean(activePlayer?.isBot);
  const isMyTurn = Boolean(game && game.turnIndex === localPlayerIndex && !game.roundEnded);

  const teamTotals = useMemo(() => {
    if (!game) return {};
    const byTeam = {};
    for (let i = 0; i < game.players.length; i += 1) {
      const t = game.players[i].teamId;
      byTeam[t] = (byTeam[t] ?? 0) + Number(totals[i] || 0);
    }
    return byTeam;
  }, [game, totals]);

  const teamZones = useMemo(() => {
    if (!game) return [];
    const map = new Map();
    game.players.forEach((p, idx) => {
      const team = map.get(p.teamId) ?? { teamId: p.teamId, playerNames: [], anchorIndex: idx };
      team.playerNames.push(p.name);
      if (idx < team.anchorIndex) team.anchorIndex = idx;
      map.set(p.teamId, team);
    });
    let order = 1;
    return [...map.values()].map((team) => {
      const teamState = game.teams[team.teamId];
      const teamPlayers = game.players.filter((p) => p.teamId === team.teamId);
      const label =
        game.mode === "single"
          ? team.playerNames[0]
          : `Lag ${order++}`;
      return {
        teamId: team.teamId,
        label,
        opened: Boolean(teamState?.opened),
        melds: teamState?.melds ?? [],
        anchorIndex: team.anchorIndex,
        redThreeCount: teamPlayers.reduce((acc, p) => acc + (p.redThrees?.length ?? 0), 0),
      };
    });
  }, [game]);
  const teamLabelById = useMemo(
    () => Object.fromEntries(teamZones.map((z) => [z.teamId, z.label])),
    [teamZones]
  );
  const openingByPlayer = useMemo(() => {
    if (!game) return [];
    return game.players.map((p, i) => {
      const totalForReq = game.mode === "single" ? Number(totals[i] || 0) : Number(teamTotals[p.teamId] || 0);
      return openingRequirement(totalForReq);
    });
  }, [game, totals, teamTotals]);

  const orderedHand = useMemo(() => {
    if (!myPlayer) return [];
    const byId = new Map(myPlayer.hand.map((c) => [c.id, c]));
    const ordered = handOrder.map((id) => byId.get(id)).filter(Boolean);
    for (const c of myPlayer.hand) {
      if (!ordered.some((x) => x.id === c.id)) ordered.push(c);
    }
    return ordered;
  }, [myPlayer, handOrder]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("canasta_settings_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.vibrateOnTurn === "boolean") setVibrateOnTurn(parsed.vibrateOnTurn);
    } catch {
      // Ignore broken local settings.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("canasta_settings_v1", JSON.stringify({ vibrateOnTurn }));
    } catch {
      // Ignore persistence errors.
    }
  }, [vibrateOnTurn]);

  function start() {
    const playerCount = Number(count);
    if (playerCount < 2 || playerCount > 6) return;
    if (mode === "team" && playerCount !== 4 && playerCount !== 6) return;
    const activeNames = names.slice(0, playerCount);
    const next = makeGame({ names: activeNames, mode });
    setGame(next);
    setSelectedIds([]);
    setHandOrder([]);
    setStage("game");
  }

  function drawTwo() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => drawTwoState(prev));
  }

  function takeDiscardStack() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => takeDiscardStackState(prev));
  }

  function discard(cardId) {
    if (!game || !isMyTurn || isBotTurn) return;
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => discardState(prev, cardId));
  }

  function moveHandCard(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    setHandOrder((prev) => {
      const base = prev.length ? [...prev] : orderedHand.map((c) => c.id);
      const from = base.indexOf(fromId);
      const to = base.indexOf(toId);
      if (from < 0 || to < 0) return base;
      const next = [...base];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
    setHoverCardId(null);
    setHandDropSide(null);
  }

  function tryDiscardSelected() {
    if (!game || !isMyTurn || isBotTurn || game.phase !== "discard" || game.roundEnded) return;
    if (selectedIds.length !== 1) {
      setGame((prev) => ({ ...prev, notice: "Markera exakt 1 kort för att slänga." }));
      return;
    }
    discard(selectedIds[0]);
  }

  function toggleSelect(cardId) {
    if (!game || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    setMeldPlan(null);
    setSelectedIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }

  function laySelected() {
    if (!game || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    if (shouldUseMeldPlanner(game, selectedIds)) {
      setMeldPlan(createMeldPlan(game, selectedIds));
      return;
    }
    const { state: next, error } = applyMeldMany(game, selectedIds, totals);
    if (error) {
      setGame({ ...game, notice: error });
      return;
    }
    setSelectedIds([]);
    setMeldPlan(null);
    setGame(next);
  }

  function applyPlannedMeld() {
    if (!game || !meldPlan) return;
    const { groups, error: groupError } = resolvePlannedGroups(game, meldPlan);
    if (groupError) {
      setMeldPlan((prev) => (prev ? { ...prev, error: groupError } : prev));
      return;
    }
    const { state: next, error } = applyMeldGroups(game, groups, meldPlan.selectedIds, totals);
    if (error) {
      setMeldPlan((prev) => (prev ? { ...prev, error } : prev));
      return;
    }
    setSelectedIds([]);
    setMeldPlan(null);
    setGame(next);
  }

  useEffect(() => {
    if (!game || game.roundEnded) return undefined;
    const bot = game.players[game.turnIndex];
    if (!bot?.isBot) return undefined;

    const id = setTimeout(() => {
      setGame((prev) => {
        if (!prev || prev.roundEnded) return prev;
        const active = prev.players[prev.turnIndex];
        if (!active?.isBot) return prev;
        let next = prev;

        if (next.phase === "draw") {
          next = canTakeDiscard(next) ? takeDiscardStackState(next) : drawTwoState(next);
        }

        if (next.phase === "discard") {
          for (let i = 0; i < 4; i += 1) {
            const ids = pickBotMeldCardIds(next);
            if (!ids || ids.length === 0) break;
            const result = applyMeld(next, ids, totals);
            if (result.error) break;
            next = result.state;
          }
          const discardId = pickDiscardCardId(next.players[next.turnIndex]);
          if (discardId) next = discardState(next, discardId);
        }

        return next;
      });
    }, 760);

    return () => clearTimeout(id);
  }, [game, totals]);

  useEffect(() => {
    if (!myPlayer) return;
    setMeldPlan(null);
    setHandOrder((prev) => {
      const currentIds = myPlayer.hand.map((c) => c.id);
      const keep = prev.filter((id) => currentIds.includes(id));
      const missing = currentIds.filter((id) => !keep.includes(id));
      return [...keep, ...missing];
    });
    setSelectedIds((prev) => prev.filter((id) => myPlayer.hand.some((c) => c.id === id)));
    setDragCardId(null);
    setHoverCardId(null);
    setHandDropSide(null);
  }, [myPlayer]);

  useEffect(() => {
    if (!game || game.roundEnded) return;
    const current = String(game.turnIndex);
    if (prevTurnRef.current == null) {
      prevTurnRef.current = current;
      return;
    }
    if (prevTurnRef.current !== current) {
      if (game.turnIndex === localPlayerIndex) {
        if (vibrateOnTurn && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([70, 45, 70]);
        }
        setSettingsOpen(false);
        setTurnFlash(true);
        if (turnFlashTimerRef.current) clearTimeout(turnFlashTimerRef.current);
        turnFlashTimerRef.current = setTimeout(() => setTurnFlash(false), 1450);
      }
    }
    prevTurnRef.current = current;
  }, [game, vibrateOnTurn, localPlayerIndex]);

  useEffect(
    () => () => {
      if (turnFlashTimerRef.current) clearTimeout(turnFlashTimerRef.current);
    },
    []
  );

  const markActiveNow = useCallback(() => {
    if (inactiveFlash) setInactiveFlash(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (!isMyTurn) return;
    inactivityTimerRef.current = setTimeout(() => {
      setInactiveFlash(true);
    }, 60000);
  }, [inactiveFlash, isMyTurn]);

  useEffect(() => {
    if (!isMyTurn) {
      setInactiveFlash(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }
    markActiveNow();
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [isMyTurn, markActiveNow]);

  useEffect(() => {
    const onActivity = () => markActiveNow();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [markActiveNow]);

  if (stage === "setup") {
    return (
      <Card style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Canasta</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant={mode === "single" ? "primary" : "ghost"} onClick={() => setMode("single")}>
              Singel
            </Button>
            <Button variant={mode === "team" ? "primary" : "ghost"} onClick={() => setMode("team")}>
              Lag (2v2 / 2v2v2)
            </Button>
          </div>

          <label style={{ color: "var(--muted)", fontWeight: 700 }}>Antal spelare (2-6)</label>
          <Input value={count} onChange={(e) => setCount(Math.max(2, Math.min(6, Number(e.target.value || 2))))} type="number" />

          {mode === "team" && (
            <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 12 }}>
              Lagläge stödjer 4 spelare (2v2) eller 6 spelare (2v2v2).
            </div>
          )}

          {Array.from({ length: count }, (_, i) => (
            <Input
              key={i}
              value={names[i] ?? ""}
              onChange={(e) =>
                setNames((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
              placeholder={`Spelare ${i + 1}`}
            />
          ))}

          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={start} disabled={mode === "team" && count !== 4 && count !== 6}>
              Starta Canasta
            </Button>
            <Button variant="ghost" onClick={onBack}>
              Tillbaka
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!game || !activePlayer || !myPlayer) return null;

  const canTakeDiscardNow = canTakeDiscard(game);
  const canSortHand = !game.roundEnded;
  const themeBgColor = externalSettings?.bgColor ?? "#0f172a";
  const themeGlow1 = externalSettings?.bgGlow1 ?? "#22c55e";
  const themeGlow2 = externalSettings?.bgGlow2 ?? "#38bdf8";
  const themeAccent = externalSettings?.accentColor ?? "#22c55e";
  const canCustomizeTheme = typeof setExternalSettings === "function";
  const settingsSectionStyle = {
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,.26)",
    background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.05)",
  };
  const settingsSectionTitleStyle = {
    color: "#c7d2fe",
    fontWeight: 900,
    marginBottom: 10,
    letterSpacing: 0.2,
    fontSize: 12,
    textTransform: "uppercase",
  };
  const settingsInlineRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(15,23,42,.36)",
  };
  const cardBackImage = [
    "url('/12-an-hemskarm-logotyp.png')",
    "repeating-linear-gradient(45deg, rgba(255,255,255,.11) 0 6px, rgba(255,255,255,0) 6px 12px)",
    "linear-gradient(180deg, #14532d, #052e16)",
  ].join(", ");
  const ids = orderedHand.map((c) => c.id);
  const handCount = Math.max(orderedHand.length, 1);
  const handCenter = (handCount - 1) / 2;
  const handStep = Math.min(46, handCount > 1 ? 680 / (handCount - 1) : 0);
  const dragIndex = dragCardId ? ids.indexOf(dragCardId) : -1;
  const hoverIndex = hoverCardId ? ids.indexOf(hoverCardId) : -1;
  const handOffsetAt = (i) => {
    let shift = 0;
    if (dragIndex >= 0 && hoverIndex >= 0 && i !== dragIndex) {
      if (hoverIndex > dragIndex && i > dragIndex && i <= hoverIndex) shift = -38;
      if (hoverIndex < dragIndex && i >= hoverIndex && i < dragIndex) shift = 38;
    }
    return (i - handCenter) * handStep + shift;
  };

  let dropMarkerX = null;
  if (dragIndex >= 0 && orderedHand.length > 0) {
    if (handDropSide === "left") {
      dropMarkerX = handOffsetAt(0) - handStep * 0.58;
    } else if (handDropSide === "right") {
      dropMarkerX = handOffsetAt(orderedHand.length - 1) + handStep * 0.58;
    } else if (hoverIndex >= 0) {
      if (hoverIndex > dragIndex) dropMarkerX = handOffsetAt(hoverIndex) + handStep * 0.5;
      else if (hoverIndex < dragIndex) dropMarkerX = handOffsetAt(hoverIndex) - handStep * 0.5;
      else dropMarkerX = handOffsetAt(hoverIndex);
    }
  }

  const selectedForPlan = meldPlan ? myPlayer.hand.filter((c) => meldPlan.selectedIds.includes(c.id)) : [];
  const planPreview = meldPlan ? resolvePlannedGroups(game, meldPlan) : { groups: [], error: null };
  const activePlanCard = meldPlan ? selectedForPlan.find((c) => c.id === meldPlan.activeCardId) ?? null : null;
  const activePlanTargets = activePlanCard
    ? isWild(activePlanCard)
      ? meldPlan.targetRanks
      : [activePlanCard.rank]
    : [];
  const planPreviewCards = planPreview.groups.map((ids) =>
    ids.map((id) => selectedForPlan.find((c) => c.id === id)).filter(Boolean)
  );
  const expandedTeam = expandedTeamId ? teamZones.find((z) => z.teamId === expandedTeamId) ?? null : null;

  return (
    <Card style={{ padding: 14, display: "grid", gap: 10 }}>
      <style>{`
        @keyframes canastaTurnBlink {
          0%, 100% { opacity: 0; }
          18%, 58% { opacity: .58; }
        }
        @keyframes canastaTurnText {
          0% { opacity: 0; transform: translate(-50%, -48%) scale(.9); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
          100% { opacity: 0; transform: translate(-50%, -52%) scale(1); }
        }
        @keyframes canastaIdleBlink {
          0%, 100% { opacity: 0; }
          50% { opacity: .52; }
        }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Canasta</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="ghost" onClick={() => setSettingsOpen((s) => !s)} style={{ width: "auto" }}>
            Inställningar
          </Button>
          <Button variant="ghost" onClick={onBack} style={{ width: "auto" }}>
            Avsluta
          </Button>
        </div>
      </div>

      <div style={{ color: "var(--muted)", fontWeight: 700 }}>{game.notice}</div>
      {isBotTurn && !game.roundEnded && (
        <div style={{ color: "#7dd3fc", fontWeight: 800 }}>Boten tänker...</div>
      )}
      {game.roundEnded && (
        <div
          style={{
            color: "#86efac",
            fontWeight: 900,
            border: "1px solid rgba(134,239,172,.45)",
            background: "rgba(22,101,52,.25)",
            borderRadius: 12,
            padding: "8px 10px",
          }}
        >
          Rundan är slut. Vinnare: {game.players.find((p) => p.id === game.winnerPlayerId)?.name ?? "okänd"} (
          {game.winnerTeamId})
        </div>
      )}

      <div
        style={{
          position: "relative",
          minHeight: 520,
          borderRadius: 24,
          border: `1px solid color-mix(in srgb, ${themeAccent} 55%, rgba(148,163,184,.35))`,
          backgroundImage: [
            `radial-gradient(90% 70% at 20% 18%, color-mix(in srgb, ${themeGlow1} 30%, transparent), transparent 70%)`,
            `radial-gradient(90% 70% at 80% 15%, color-mix(in srgb, ${themeGlow2} 28%, transparent), transparent 72%)`,
            `radial-gradient(95% 85% at 50% 50%, color-mix(in srgb, ${themeAccent} 14%, transparent), rgba(2,6,23,.68))`,
            `linear-gradient(180deg, color-mix(in srgb, ${themeBgColor} 80%, #020617), color-mix(in srgb, ${themeBgColor} 55%, #020617))`,
          ].join(", "),
          boxShadow: "inset 0 0 0 3px rgba(16,185,129,.2), 0 20px 50px rgba(2,6,23,.45)",
          overflow: "hidden",
        }}
      >
        {turnFlash && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "radial-gradient(circle at 50% 45%, rgba(56,189,248,.24), rgba(2,6,23,.48))",
                animation: "canastaTurnBlink 1.45s ease-in-out both",
                zIndex: 30,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                fontWeight: 900,
                letterSpacing: ".08em",
                fontSize: 30,
                color: "#e0f2fe",
                textShadow: "0 0 18px rgba(56,189,248,.88), 0 0 40px rgba(2,132,199,.5)",
                animation: "canastaTurnText 1.45s ease-out both",
                zIndex: 31,
              }}
            >
              DIN TUR
            </div>
          </>
        )}
        {inactiveFlash && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "radial-gradient(circle at 50% 45%, rgba(248,113,113,.22), rgba(2,6,23,.52))",
                animation: "canastaIdleBlink 1.2s ease-in-out infinite",
                zIndex: 29,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                fontWeight: 900,
                letterSpacing: ".08em",
                fontSize: 24,
                color: "#fecaca",
                textShadow: "0 0 14px rgba(248,113,113,.75)",
                zIndex: 30,
              }}
            >
              DIN TUR
            </div>
          </>
        )}

        {game.players.map((p, i) => {
          const pos = seatPosition(i, game.players.length);
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                transform: "translate(-50%, -50%)",
                minWidth: 108,
                padding: "8px 10px",
                borderRadius: 12,
                border: i === game.turnIndex ? "1px solid rgba(125,211,252,.8)" : "1px solid rgba(148,163,184,.35)",
                background: i === game.turnIndex ? "rgba(15,23,42,.8)" : "rgba(2,6,23,.62)",
                display: "grid",
                gap: 3,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 12 }}>{p.name}</div>
              <div style={{ color: "#a7f3d0", fontWeight: 800, fontSize: 11 }}>{teamLabelById[p.teamId] ?? p.teamId}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 2 }}>
                {Array.from({ length: Math.min(5, p.hand.length) }, (_, idx) => (
                  <span
                    key={`${p.id}-back-${idx}`}
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 14,
                      marginLeft: idx === 0 ? 0 : -4,
                      borderRadius: 2,
                      border: "1px solid rgba(15,23,42,.45)",
                      background: cardBackImage,
                      backgroundSize: "14px 14px, 8px 8px, 100% 100%",
                      backgroundRepeat: "no-repeat, repeat, no-repeat",
                      boxShadow: "0 1px 3px rgba(2,6,23,.35)",
                    }}
                  />
                ))}
                <span
                  style={{
                    marginLeft: 4,
                    minWidth: 16,
                    textAlign: "center",
                    borderRadius: 999,
                    background: "rgba(2,6,23,.62)",
                    border: "1px solid rgba(148,163,184,.35)",
                    color: "#e2e8f0",
                    fontWeight: 800,
                    fontSize: 10,
                    padding: "0 4px",
                  }}
                >
                  {p.hand.length}
                </span>
              </div>
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-150%, -52%)",
            width: 72,
            height: 98,
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,.4)",
            background: cardBackImage,
            backgroundSize: "30px 30px, 16px 16px, 100% 100%",
            backgroundPosition: "center center, 0 0, 0 0",
            backgroundRepeat: "no-repeat, repeat, no-repeat",
            boxShadow: "0 8px 18px rgba(2,6,23,.45)",
            opacity: game.stock.length > 0 ? 1 : 0.45,
            zIndex: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-150%, -56%)",
            width: 72,
            height: 98,
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,.3)",
            background: cardBackImage,
            backgroundSize: "30px 30px, 16px 16px, 100% 100%",
            backgroundPosition: "center center, 0 0, 0 0",
            backgroundRepeat: "no-repeat, repeat, no-repeat",
            opacity: game.stock.length > 2 ? 0.95 : 0.35,
            zIndex: 3,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-150%, -60%)",
            width: 72,
            height: 98,
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,.4)",
            background: cardBackImage,
            backgroundSize: "30px 30px, 16px 16px, 100% 100%",
            backgroundPosition: "center center, 0 0, 0 0",
            backgroundRepeat: "no-repeat, repeat, no-repeat",
            opacity: game.stock.length > 5 ? 1 : 0.5,
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-150%, 52px)",
            fontWeight: 900,
            fontSize: 12,
            color: "#dbeafe",
            zIndex: 5,
          }}
        >
          Talong: {game.stock.length}
        </div>

        <button
          type="button"
          onClick={tryDiscardSelected}
          onDragOver={(e) => {
            if (isBotTurn || game.phase !== "discard" || game.roundEnded) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (isBotTurn || game.phase !== "discard" || game.roundEnded) return;
            e.preventDefault();
            const id = e.dataTransfer.getData("text/plain") || dragCardId;
            if (id) discard(id);
            setHoverCardId(null);
          }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(78%, -52%)",
            width: 78,
            height: 106,
            borderRadius: 10,
            border: topDiscard ? "1px solid rgba(15,23,42,.38)" : "1px dashed rgba(148,163,184,.45)",
            background: topDiscard ? "#fffdf8" : "rgba(15,23,42,.58)",
            color: "#e2e8f0",
            fontWeight: 900,
            padding: "4px 4px",
            cursor: game.phase === "discard" && !isBotTurn && !game.roundEnded ? "pointer" : "not-allowed",
            opacity: game.phase === "discard" && !game.roundEnded ? 1 : 0.75,
            boxShadow: topDiscard ? "0 10px 18px rgba(2,6,23,.4), 0 1px 0 rgba(255,255,255,.75) inset" : "none",
            zIndex: 5,
          }}
        >
          <CanastaFace card={topDiscard} compact />
        </button>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(84%, 56px)",
            textAlign: "center",
            fontWeight: 800,
            fontSize: 12,
            color: "#dbeafe",
            zIndex: 5,
          }}
        >
          Slänghög: {game.discard.length}
        </div>

        {teamZones.map((zone) => {
          const placement = meldZonePlacement(zone.anchorIndex, game.players.length, teamZones.length);
          const meldCount = zone.melds?.length ?? 0;
          const dynamicWidth = Math.min(360, placement.width + Math.max(0, meldCount - 1) * 44);
          const isOwnZone = myPlayer?.teamId === zone.teamId;
          return (
            <div
              key={zone.teamId}
              role={isOwnZone ? "button" : undefined}
              tabIndex={isOwnZone ? 0 : undefined}
              onClick={isOwnZone ? () => setExpandedTeamId(zone.teamId) : undefined}
              onKeyDown={
                isOwnZone
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedTeamId(zone.teamId);
                      }
                    }
                  : undefined
              }
              style={{
                position: "absolute",
                left: `${placement.left}%`,
                top: `${placement.top}%`,
                transform: "translate(-50%, -50%)",
                width: dynamicWidth,
                maxWidth: "46%",
                zIndex: 2,
                cursor: isOwnZone ? "pointer" : "default",
              }}
            >
              <TeamMelds
                title={`${zone.label}${zone.opened ? " • öppnat" : ""}`}
                redThreeCount={zone.redThreeCount}
                melds={zone.melds}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
        <Button onClick={drawTwo} disabled={game.phase !== "draw" || game.roundEnded || isBotTurn || !isMyTurn}>
          Dra 2 kort
        </Button>
        <Button
          onClick={takeDiscardStack}
          disabled={game.phase !== "draw" || game.roundEnded || isBotTurn || !isMyTurn || !canTakeDiscardNow}
        >
          Ta slänghög (10)
        </Button>
        <Button
          onClick={laySelected}
          disabled={game.phase !== "discard" || selectedIds.length < 1 || game.roundEnded || isBotTurn || !isMyTurn}
        >
          Lägg markerade ({selectedIds.length})
        </Button>
      </div>

      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(148,163,184,.28)",
          background: "linear-gradient(180deg, rgba(2,6,23,.86), rgba(2,6,23,.96))",
          padding: 10,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800 }}>Din hand ({myPlayer.name})</div>
          <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Klicka för markering • Dra för ordning • Släng via slänghög</div>
        </div>

        <div
          style={{ position: "relative", height: 192 }}
          onDragOver={(e) => {
            if (!canSortHand) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const edge = Math.min(80, rect.width * 0.22);
            if (x <= edge) {
              setHandDropSide("left");
              setHoverCardId(null);
            } else if (x >= rect.width - edge) {
              setHandDropSide("right");
              setHoverCardId(null);
            } else {
              setHandDropSide(null);
            }
          }}
          onDragLeave={() => setHandDropSide(null)}
          onDrop={(e) => {
            if (!canSortHand) return;
            e.preventDefault();
            const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
            if (!fromId || orderedHand.length < 2) return;
            const targetId = handDropSide === "left" ? orderedHand[0]?.id : orderedHand[orderedHand.length - 1]?.id;
            if (targetId) moveHandCard(fromId, targetId);
          }}
        >
          {dropMarkerX != null && (
            <div
              style={{
                position: "absolute",
                left: `calc(50% + ${dropMarkerX}px)`,
                bottom: 10,
                transform: "translateX(-50%)",
                width: 4,
                height: 136,
                borderRadius: 999,
                background: "linear-gradient(180deg, rgba(34,211,238,.1), rgba(34,211,238,.95), rgba(34,211,238,.1))",
                boxShadow: "0 0 16px rgba(34,211,238,.9), 0 0 26px rgba(34,211,238,.55)",
                pointerEvents: "none",
                zIndex: 2000,
              }}
            />
          )}
          {orderedHand.map((c, i) => {
            const selected = selectedIds.includes(c.id);
            const prevSelected = i > 0 && selectedIds.includes(orderedHand[i - 1]?.id);
            const nextSelected = i < orderedHand.length - 1 && selectedIds.includes(orderedHand[i + 1]?.id);
            const offset = handOffsetAt(i);
            const rot = (i - handCenter) * 0.6;
            const isHoverTarget = hoverCardId === c.id && dragCardId && dragCardId !== c.id;
            const spreadAdjust = selected ? 0 : (prevSelected ? 8 : 0) - (nextSelected ? 8 : 0);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleSelect(c.id)}
                draggable={canSortHand}
                onDragStart={(e) => {
                  setDragCardId(c.id);
                  setHoverCardId(c.id);
                  setHandDropSide(null);
                  e.dataTransfer.setData("text/plain", c.id);
                }}
                onDragEnd={() => {
                  setDragCardId(null);
                  setHoverCardId(null);
                  setHandDropSide(null);
                }}
                onDragOver={(e) => {
                  if (!canSortHand) return;
                  e.preventDefault();
                  if (handDropSide) setHandDropSide(null);
                  if (hoverCardId !== c.id) setHoverCardId(c.id);
                }}
                onDrop={(e) => {
                  if (!canSortHand) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
                  moveHandCard(fromId, c.id);
                }}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${offset + spreadAdjust}px)`,
                  bottom: 6 + (selected ? 14 : 0) + (isHoverTarget ? 4 : 0),
                  transform: `translateX(-50%) rotate(${rot}deg)`,
                  width: 80,
                  height: 120,
                  borderRadius: 11,
                  border: isHoverTarget
                    ? "2px solid #22d3ee"
                    : selected
                      ? "2px solid #67e8f9"
                      : "1px solid rgba(15,23,42,.3)",
                  background: "#fffdf8",
                  color: "#0f172a",
                  fontWeight: 900,
                  fontSize: 13,
                  zIndex: 120 + i,
                  cursor: canSortHand ? "grab" : "not-allowed",
                  opacity: canSortHand ? 1 : 0.72,
                  boxShadow: selected
                    ? "0 0 0 1px rgba(103,232,249,.45), 0 12px 20px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.8)"
                    : "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.78)",
                  padding: 3,
                  transition: "left .14s ease, bottom .14s ease, transform .14s ease, border-color .12s ease",
                }}
              >
                <CanastaFace card={c} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        {game.players.map((p, i) => (
          <div key={`${p.id}-score`} style={{ display: "grid", gap: 4 }}>
            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>{p.name} totalpoäng</div>
            <Input
              value={totals[i]}
              onChange={(e) =>
                setTotals((prev) => {
                  const next = [...prev];
                  next[i] = Number(e.target.value || 0);
                  return next;
                })
              }
              type="number"
            />
            <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 11 }}>
              Öppning: {openingByPlayer[i] === "canasta" ? "Canasta" : openingByPlayer[i]}
            </div>
          </div>
        ))}
      </div>

      <div style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>
        Nästa steg: exakt utgångslogik (2 canastas), full rondsluträkning och leaderboard-poäng kopplad till Canasta-match.
      </div>
      {meldPlan && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMeldPlan(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1190,
            background: "rgba(2,6,23,.64)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(680px, 96vw)" }}>
            <Card
              style={{
                maxHeight: "88vh",
                overflow: "auto",
                padding: 18,
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Strukturera läggning</h3>
                <Button variant="ghost" onClick={() => setMeldPlan(null)} style={{ width: "auto" }}>
                  Stäng
                </Button>
              </div>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                  Markerade kort: {selectedForPlan.length}
                </div>
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
                  <div style={{ fontWeight: 800 }}>1) Välj kort</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedForPlan.map((c) => {
                      const isActive = c.id === meldPlan.activeCardId;
                      const assignedRank = meldPlan.assignments?.[c.id];
                      return (
                        <button
                          key={`plan-card-${c.id}`}
                          type="button"
                          onClick={() =>
                            setMeldPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    error: "",
                                    activeCardId: c.id,
                                  }
                                : prev
                            )
                          }
                          style={{
                            width: 54,
                            height: 80,
                            borderRadius: 10,
                            border: isActive ? "2px solid #67e8f9" : "1px solid rgba(148,163,184,.35)",
                            background: "rgba(15,23,42,.38)",
                            padding: 2,
                            cursor: "pointer",
                          }}
                        >
                          <CanastaFace card={c} compact />
                          <div style={{ marginTop: 2, color: "#bfdbfe", fontSize: 10, fontWeight: 800 }}>
                            → {assignedRank === 0 ? "J" : rankLabel(assignedRank)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
                  <div style={{ fontWeight: 800 }}>2) Klicka stick för valt kort</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {meldPlan.targetRanks.map((rank) => {
                      const disabled = activePlanCard ? !activePlanTargets.includes(rank) : true;
                      const pseudoCard = {
                        id: `plan-stick-${rank}`,
                        suit: rank === 0 ? "joker" : "hearts",
                        rank: rank === 0 ? 0 : rank,
                        joker: rank === 0,
                      };
                      return (
                        <button
                          key={`stick-target-${rank}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!meldPlan.activeCardId) return;
                            setMeldPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    error: "",
                                    assignments: { ...prev.assignments, [prev.activeCardId]: rank },
                                  }
                                : prev
                            );
                          }}
                          style={{
                            width: 58,
                            height: 84,
                            borderRadius: 10,
                            border: "1px solid rgba(148,163,184,.35)",
                            background: disabled ? "rgba(15,23,42,.25)" : "rgba(15,23,42,.5)",
                            opacity: disabled ? 0.45 : 1,
                            padding: 2,
                            cursor: disabled ? "not-allowed" : "pointer",
                          }}
                        >
                          <CanastaFace card={pseudoCard} compact />
                        </button>
                      );
                    })}
                  </div>
                  {activePlanCard ? (
                    <div style={{ color: "#c7d2fe", fontWeight: 700, fontSize: 12 }}>
                      Aktivt kort: {cardLabel(activePlanCard)}
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Välj ett kort först.</div>
                  )}
                </div>
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
                  <div style={{ fontWeight: 800 }}>Förhandsvisning</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {planPreviewCards.map((cards, idx) => (
                      <div key={`preview-group-${idx}`} style={{ display: "grid", gap: 4 }}>
                        <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 11 }}>Stick {idx + 1}</div>
                        <div
                          style={{
                            position: "relative",
                            width: Math.min(cards.length, 10) * 10 + 42,
                            height: 64,
                            borderRadius: 10,
                            border: "1px solid rgba(148,163,184,.3)",
                            background: "rgba(2,6,23,.32)",
                            padding: 6,
                          }}
                        >
                          {cards.slice(0, 10).map((card, cIdx) => (
                            <div
                              key={`preview-plan-card-${card.id}-${cIdx}`}
                              style={{
                                position: "absolute",
                                left: 6 + cIdx * 10,
                                top: 6,
                                width: 40,
                                height: 58,
                                borderRadius: 7,
                                overflow: "hidden",
                                border: "1px solid rgba(15,23,42,.35)",
                                background: "#fff",
                                zIndex: 100 - cIdx,
                              }}
                            >
                              <CanastaFace card={card} compact />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {planPreview.groups.length === 0 && (
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Ingen gruppering vald ännu.</div>
                  )}
                  {planPreview.groups.length > 0 && (
                    <div style={{ color: "#dbeafe", fontWeight: 700, fontSize: 12 }}>
                      Totalt stick: {planPreview.groups.length}
                    </div>
                  )}
                </div>
                {(meldPlan.error || planPreview.error) && (
                  <div style={{ color: "#fca5a5", fontWeight: 800, fontSize: 12 }}>{meldPlan.error || planPreview.error}</div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={applyPlannedMeld}>Lägg enligt plan</Button>
                  <Button variant="ghost" onClick={() => setMeldPlan(null)}>
                    Avbryt
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
      {expandedTeam && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpandedTeamId(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1180,
            background: "rgba(2,6,23,.64)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(860px, 96vw)" }}>
            <Card
              style={{
                maxHeight: "88vh",
                overflow: "auto",
                padding: 18,
                borderRadius: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>{expandedTeam.label} • Stick</h3>
                <Button variant="ghost" onClick={() => setExpandedTeamId(null)} style={{ width: "auto" }}>
                  Stäng
                </Button>
              </div>
              <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 14 }}>
                {expandedTeam.melds.length === 0 && (
                  <div style={{ color: "var(--muted)", fontWeight: 700 }}>Inga stick lagda ännu.</div>
                )}
                {expandedTeam.melds.map((m, idx) => {
                  const cards = buildMeldPreviewCards(expandedTeam.label, m);
                  return (
                    <div key={`expanded-meld-${m.rank}-${idx}`} style={{ display: "grid", gap: 6 }}>
                      <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 12 }}>
                        {m.rank === 0 ? "Jolle" : `Valör ${rankLabel(m.rank)}`} • {m.cards.length} kort
                      </div>
                      <div
                        style={{
                          position: "relative",
                          width: Math.min(cards.length, 12) * 16 + 68,
                          height: 94,
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,.28)",
                          background: "rgba(2,6,23,.34)",
                          padding: 8,
                        }}
                      >
                        {cards.slice(0, 12).map((c, cIdx) => (
                          <div
                            key={`expanded-card-${c.id}-${cIdx}`}
                            style={{
                              position: "absolute",
                              left: 8 + cIdx * 16,
                              top: 8,
                              width: 58,
                              height: 84,
                              borderRadius: 10,
                              overflow: "hidden",
                              border: "1px solid rgba(15,23,42,.35)",
                              boxShadow: "0 6px 14px rgba(2,6,23,.35)",
                              zIndex: 100 - cIdx,
                              background: "#fff",
                            }}
                          >
                            <CanastaFace card={c} compact />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSettingsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(2,6,23,.64)",
            backdropFilter: "blur(3px)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(960px, 96vw)" }}>
            <Card
              style={{
                maxHeight: "88vh",
                overflow: "auto",
                padding: 18,
                borderRadius: 16,
              }}
            >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>Inställningar</h3>
              <Button variant="ghost" onClick={() => setSettingsOpen(false)} style={{ width: "auto" }}>
                Stäng
              </Button>
            </div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div style={settingsSectionStyle}>
                <div style={settingsSectionTitleStyle}>Alert</div>
                <div style={settingsInlineRowStyle}>
                  <div style={{ fontWeight: 800 }}>Vibrera när turen byter</div>
                  <Button
                    variant={vibrateOnTurn ? "primary" : "ghost"}
                    onClick={() => setVibrateOnTurn((v) => !v)}
                    style={{ width: "auto" }}
                  >
                    {vibrateOnTurn ? "På" : "Av"}
                  </Button>
                </div>
              </div>
              {canCustomizeTheme && (
                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Tema</div>
                  {typeof applyTheme === "function" && themes.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginBottom: 10 }}>
                      {themes.map((t) => {
                        const key = t.key ?? t.name;
                        const selected = externalSettings?.themeKey === key;
                        return (
                          <Button key={key} variant={selected ? "primary" : "ghost"} onClick={() => applyTheme(t)}>
                            {t.name}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                    <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                      Bakgrund
                      <input
                        type="color"
                        value={themeBgColor}
                        onChange={(e) => setExternalSettings((s) => ({ ...s, bgColor: e.target.value }))}
                        style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                      Accent
                      <input
                        type="color"
                        value={themeAccent}
                        onChange={(e) =>
                          setExternalSettings((s) => ({ ...s, accentColor: e.target.value, checkColor: e.target.value, filledRingColor: e.target.value }))
                        }
                        style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                      Glow 1
                      <input
                        type="color"
                        value={themeGlow1}
                        onChange={(e) => setExternalSettings((s) => ({ ...s, bgGlow1: e.target.value }))}
                        style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 4, color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                      Glow 2
                      <input
                        type="color"
                        value={themeGlow2}
                        onChange={(e) => setExternalSettings((s) => ({ ...s, bgGlow2: e.target.value }))}
                        style={{ width: "100%", height: 34, borderRadius: 8, border: "1px solid rgba(148,163,184,.35)", background: "transparent" }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
            </Card>
          </div>
        </div>
      )}
    </Card>
  );
}
