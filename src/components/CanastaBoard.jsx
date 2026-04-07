import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const MOBILE_QUERY = "(max-width: 1024px), (pointer: coarse)";

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

function handSortWeight(card) {
  if (card.joker) return 0;
  if (card.rank === 2) return 1;
  if (card.rank === 1) return 2;
  if (card.rank === 13) return 3;
  if (card.rank === 12) return 4;
  if (card.rank === 11) return 5;
  return 20 + Number(card.rank || 0);
}

function suitSortWeight(card) {
  if (card.joker) return 0;
  if (card.suit === "spades") return 0;
  if (card.suit === "hearts") return 1;
  if (card.suit === "diamonds") return 2;
  if (card.suit === "clubs") return 3;
  return 4;
}

function sortHandCards(cards) {
  return [...(cards ?? [])].sort((a, b) => {
    const rankDiff = handSortWeight(a) - handSortWeight(b);
    if (rankDiff !== 0) return rankDiff;
    const suitDiff = suitSortWeight(a) - suitSortWeight(b);
    if (suitDiff !== 0) return suitDiff;
    return String(a.id).localeCompare(String(b.id));
  });
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

function getTeamTotalFromTotals(state, totals, teamId) {
  if (!state?.players?.length || !teamId) return 0;
  return state.players.reduce((best, player, index) => {
    if (player.teamId !== teamId) return best;
    return Math.max(best, Number(totals?.[index] || 0));
  }, 0);
}

function getPlayerOpeningTotal(state, totals, playerIndex) {
  if (!state?.players?.length) return 0;
  if (state.mode === "single") return Number(totals?.[playerIndex] || 0);
  const teamId = state.players[playerIndex]?.teamId;
  return getTeamTotalFromTotals(state, totals, teamId);
}

function findExistingNaturalMeld(team, rank) {
  return team?.melds?.find((meld) => meld.rank === rank && meld.rank !== 0) ?? null;
}

function meldBonus(meld) {
  if (!meld || (meld.cards?.length ?? 0) < 7) return 0;
  if (meld.rank === 0) return 1000;
  const wildCount = meld.cards.filter((card) => isWild(card)).length;
  return wildCount > 0 ? 300 : 500;
}

function sumCardPoints(cards) {
  return (cards ?? []).reduce((acc, card) => acc + cardPoints(card), 0);
}

function redThreeBonus(count, hasQualifiedMeld) {
  if (!count) return 0;
  const base = count * 100 + (count === 4 ? 400 : 0);
  return hasQualifiedMeld ? base : -base;
}

function computeRoundScore(state, teamId, wentOut = false) {
  const team = state?.teams?.[teamId];
  const teamPlayers = state?.players?.filter((player) => player.teamId === teamId) ?? [];
  const meldPoints = (team?.melds ?? []).reduce((acc, meld) => acc + sumCardPoints(meld.cards), 0);
  const meldBonuses = (team?.melds ?? []).reduce((acc, meld) => acc + meldBonus(meld), 0);
  const handPenalty = teamPlayers.reduce((acc, player) => acc + sumCardPoints(player.hand), 0);
  const redThreeCount = teamPlayers.reduce((acc, player) => acc + (player.redThrees?.length ?? 0), 0);
  const hasQualifiedMeld = Boolean((team?.melds?.length ?? 0) > 0);
  return (
    meldPoints +
    meldBonuses +
    redThreeBonus(redThreeCount, hasQualifiedMeld) +
    (wentOut ? 100 : 0) -
    handPenalty
  );
}

function computeRoundResults(state) {
  if (!state?.players?.length) return { scoresByTeam: {}, winnerTeamId: null };
  const scoresByTeam = {};
  const teamIds = [...new Set(state.players.map((player) => player.teamId))];
  for (const teamId of teamIds) {
    scoresByTeam[teamId] = computeRoundScore(state, teamId, state.winnerTeamId === teamId);
  }
  const winnerTeamId =
    state.winnerTeamId ??
    teamIds.sort((a, b) => (scoresByTeam[b] ?? 0) - (scoresByTeam[a] ?? 0))[0] ??
    null;
  return { scoresByTeam, winnerTeamId };
}

function updateTotalsAfterRound(state, totals) {
  if (!state?.players?.length) return totals;
  const { scoresByTeam } = computeRoundResults(state);
  const previous = Array.isArray(totals) ? [...totals] : [];
  if (state.mode === "single") {
    return state.players.map((player, index) => Number(previous[index] || 0) + Number(scoresByTeam[player.teamId] || 0));
  }

  const nextByTeam = {};
  for (const player of state.players) {
    if (nextByTeam[player.teamId] != null) continue;
    nextByTeam[player.teamId] =
      getTeamTotalFromTotals(state, previous, player.teamId) + Number(scoresByTeam[player.teamId] || 0);
  }
  return state.players.map((player) => nextByTeam[player.teamId] ?? 0);
}

function getMatchWinnerTeamId(state, totals, targetScore) {
  if (!state?.players?.length) return null;
  const teamIds = [...new Set(state.players.map((player) => player.teamId))];
  const qualified = teamIds.filter((teamId) => getTeamTotalFromTotals(state, totals, teamId) >= Number(targetScore || 0));
  if (qualified.length === 0) return null;
  return qualified.sort(
    (a, b) => getTeamTotalFromTotals(state, totals, b) - getTeamTotalFromTotals(state, totals, a)
  )[0];
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

function seatTemplateList(total, isMobile) {
  const desktop = {
    1: [
      { top: "92%", left: "50%", angle: 0 },
    ],
    2: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "9%", left: "50%", angle: 0 },
    ],
    3: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "14%", left: "24%", angle: 7 },
      { top: "14%", left: "76%", angle: -7 },
    ],
    4: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "9%", left: "50%", angle: 0 },
      { top: "34%", left: "90%", angle: -9 },
      { top: "34%", left: "10%", angle: 9 },
    ],
    5: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "10%", left: "50%", angle: 0 },
      { top: "20%", left: "82%", angle: -8 },
      { top: "52%", left: "86%", angle: -10 },
      { top: "52%", left: "14%", angle: 10 },
    ],
    6: [
      { top: "92%", left: "50%", angle: 0 },
      { top: "10%", left: "50%", angle: 0 },
      { top: "20%", left: "82%", angle: -8 },
      { top: "50%", left: "88%", angle: -11 },
      { top: "50%", left: "12%", angle: 11 },
      { top: "20%", left: "18%", angle: 8 },
    ],
  };

  const mobile = {
    1: [
      { top: "90%", left: "50%", angle: 0 },
    ],
    2: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
    ],
    3: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "46%", left: "90%", angle: 0 },
    ],
    4: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "46%", left: "90%", angle: 0 },
      { top: "46%", left: "14%", angle: 0 },
    ],
    5: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "30%", left: "90%", angle: 0 },
      { top: "62%", left: "90%", angle: 0 },
      { top: "46%", left: "14%", angle: 0 },
    ],
    6: [
      { top: "90%", left: "50%", angle: 0 },
      { top: "12%", left: "50%", angle: 0 },
      { top: "24%", left: "90%", angle: 0 },
      { top: "58%", left: "90%", angle: 0 },
      { top: "58%", left: "14%", angle: 0 },
      { top: "24%", left: "14%", angle: 0 },
    ],
  };

  return (isMobile ? mobile : desktop)[total] ?? [{ top: "50%", left: "50%", angle: 0 }];
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

function TeamMelds({
  title,
  redThreeCount,
  melds,
  orientation = "horizontal",
  compact = false,
  showStackLayers = true,
  noWrap = false,
}) {
  const canastaMelds = melds.filter((m) => (m.cards?.length ?? 0) >= 7);
  const activeMelds = melds.filter((m) => (m.cards?.length ?? 0) < 7);
  const canastaCount = canastaMelds.length;

  function getMeldCardMetrics(meld, totalMelds) {
    if (compact) {
      // Mobile readability: keep meld previews clearly visible.
      if ((meld?.cards?.length ?? 0) >= 10 || totalMelds >= 6) return { w: 28, h: 42, step: 7 };
      if ((meld?.cards?.length ?? 0) >= 8 || totalMelds >= 5) return { w: 30, h: 46, step: 8 };
      return { w: 32, h: 50, step: 9 };
    }

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 12 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
          {redThreeCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {Array.from({ length: Math.min(3, redThreeCount) }, (_, idx) => (
                <span
                  key={`${title}-r3-${idx}`}
                  style={{
                    width: 16,
                    height: 22,
                    borderRadius: 4,
                    border: "1px solid rgba(15,23,42,.25)",
                    background: "#fff",
                    color: "#b91c1c",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  3♥
                </span>
              ))}
              {redThreeCount > 3 ? (
                <span style={{ color: "#fecaca", fontWeight: 800, fontSize: 10 }}>+{redThreeCount - 3}</span>
              ) : null}
            </div>
          ) : null}
          {canastaCount > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {Array.from({ length: Math.min(3, canastaCount) }, (_, idx) => (
                <span
                  key={`${title}-canasta-${idx}`}
                  style={{
                    width: 16,
                    height: 22,
                    borderRadius: 4,
                    border: "1px solid rgba(15,23,42,.25)",
                    background: "#fff",
                    color: "#0f172a",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  C
                </span>
              ))}
              {canastaCount > 3 ? (
                <span style={{ color: "#bfdbfe", fontWeight: 800, fontSize: 10 }}>+{canastaCount - 3}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: noWrap ? "nowrap" : orientation === "vertical" ? "nowrap" : "wrap",
          flexDirection: orientation === "vertical" ? "column" : "row",
          gap: compact ? 6 : 10,
          alignItems: "flex-start",
          maxHeight: orientation === "vertical" ? (showStackLayers ? (compact ? 140 : 180) : "none") : "none",
          overflowY: orientation === "vertical" ? (showStackLayers ? "auto" : "visible") : "visible",
          overflowX: noWrap ? "visible" : "hidden",
          paddingRight: orientation === "vertical" ? 2 : 0,
        }}
      >
        {activeMelds.map((m, idx) => {
          const preview = buildMeldPreviewCards(title, m).slice(0, 7);
          const metrics = getMeldCardMetrics(m, activeMelds.length);
          const leadCard = preview[0] ?? m.cards?.[0] ?? null;
          const stacked = showStackLayers ? Math.min(3, Math.max(0, (m.cards?.length ?? 0) - 1)) : 0;
          return (
            <div key={`${title}-${m.rank}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
              <div
                style={{
                  position: "relative",
                  height: metrics.h + stacked * 2,
                  width: metrics.w + stacked * 3,
                }}
              >
                {Array.from({ length: stacked }, (_, cardIdx) => (
                  <div
                    key={`stack-${idx}-${cardIdx}`}
                    style={{
                      position: "absolute",
                      left: (stacked - cardIdx) * 3,
                      top: (stacked - cardIdx) * 2,
                      zIndex: 10 + cardIdx,
                      width: metrics.w,
                      height: metrics.h,
                      borderRadius: 5,
                      overflow: "hidden",
                      boxShadow: "0 3px 7px rgba(2,6,23,.3)",
                      border: "1px solid rgba(148,163,184,.45)",
                      background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
                    }}
                  />
                ))}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    zIndex: 30,
                    width: metrics.w,
                    height: metrics.h,
                    borderRadius: 5,
                    overflow: "hidden",
                    boxShadow: "0 4px 8px rgba(2,6,23,.35)",
                    border: "1px solid rgba(15,23,42,.28)",
                    background: "#fff",
                  }}
                >
                  <CanastaFace card={leadCard} compact minimal />
                </div>
                {(m.cards?.length ?? 0) > 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      right: -8,
                      bottom: -7,
                      zIndex: 40,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,.5)",
                      background: "rgba(2,6,23,.82)",
                      color: "#e2e8f0",
                      fontWeight: 900,
                      fontSize: 11,
                      display: "grid",
                      placeItems: "center",
                      padding: "0 4px",
                    }}
                  >
                    {m.cards.length}
                  </div>
                ) : null}
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

function CanastaFace({ card, compact = false, minimal = false }) {
  if (!card) return <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span>;
  const suit = card.joker ? "★" : SUIT_SYMBOL[card.suit];
  const rank = card.joker ? "Joker" : rankLabel(card.rank);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const ink = card.joker ? "#1d4ed8" : isRed ? "#b91c1c" : "#111827";
  const pips = !card.joker && card.rank <= 10 ? PIP_LAYOUT[card.rank] ?? [] : [];
  const isFace = !card.joker && card.rank >= 11;

  const cornerRankSize = compact ? (minimal ? 12 : 11) : 13;
  const cornerSuitSize = compact ? (minimal ? 11 : 10) : 12;

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
        <div style={{ fontSize: cornerRankSize, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: cornerSuitSize }}>{suit}</div>
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
        <div style={{ fontSize: cornerRankSize, fontWeight: 700 }}>{rank === "Joker" ? "J" : rank}</div>
        <div style={{ fontSize: cornerSuitSize }}>{suit}</div>
      </div>

      {minimal ? null : card.joker ? (
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

function makeGame({ names, mode, playersConfig = null }) {
  const stock = buildDeck();
  const resolvedPlayers =
    Array.isArray(playersConfig) && playersConfig.length > 0
      ? playersConfig
      : names.map((name, idx) => ({ name, isBot: mode === "single" && idx > 0 }));
  const teamCount = mode === "team" ? 2 : 0;
  const players = resolvedPlayers.map((playerCfg, idx) => ({
    id: `p${idx + 1}`,
    name:
      playerCfg?.name?.trim() ||
      (playerCfg?.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
    teamId: mode === "single" ? `solo-${idx + 1}` : `team-${(idx % teamCount) + 1}`,
    isBot: Boolean(playerCfg?.isBot),
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
    discardFrozen: false,
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
      state.discardFrozen = isWild(top) || isBlackThree(top);
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
  if (state.stock.length === 0) {
    const player = state.players[state.turnIndex];
    return {
      ...state,
      roundEnded: true,
      winnerPlayerId: null,
      winnerTeamId: null,
      notice: `${player?.name ?? "Spelaren"} avstod kasthögen. Rundan är slut.`,
    };
  }
  let next = state;
  next = drawOneWithRedThreeRule(next, next.turnIndex);
  next = drawOneWithRedThreeRule(next, next.turnIndex);
  return { ...next, phase: "discard", notice: `${next.players[next.turnIndex].name} drog 2 kort.` };
}

function getDiscardPickupSelection(state, totals = []) {
  if (!state || state.roundEnded || state.phase !== "draw") return null;
  const top = state.discard[state.discard.length - 1];
  const player = state.players[state.turnIndex];
  if (!top || !player || top.joker || isWild(top) || isBlackThree(top)) return null;

  const naturalMatches = player.hand.filter((card) => !isWild(card) && card.rank === top.rank);
  if (naturalMatches.length >= 2) {
    return [top.id, naturalMatches[0].id, naturalMatches[1].id];
  }
  return null;
}

function canAddWildToRankGroup(cards, addCount = 1) {
  const naturals = cards.filter((card) => !isWild(card)).length;
  const nextLength = cards.length + addCount;
  if (naturals < 2) return false;
  if (nextLength >= 7 && naturals < 4) return false;
  return true;
}

function buildRankGroupOptions(naturalCards, wildCountLimit, minNaturals) {
  if ((naturalCards?.length ?? 0) < minNaturals) return [];
  const options = [];
  for (let naturalCount = minNaturals; naturalCount <= naturalCards.length; naturalCount += 1) {
    const chosenNaturals = naturalCards.slice(0, naturalCount);
    const maxWilds = Math.min(wildCountLimit, naturalCount - 1);
    for (let wildCount = 0; wildCount <= maxWilds; wildCount += 1) {
      const totalCount = naturalCount + wildCount;
      if (totalCount < 3) continue;
      if (!canAddWildToRankGroup(chosenNaturals, wildCount)) continue;
      options.push({
        naturalIds: chosenNaturals.map((card) => card.id),
        points: sumCardPoints(chosenNaturals),
        wildCount,
        cardCount: totalCount,
      });
    }
  }

  options.sort((a, b) => {
    if (a.cardCount !== b.cardCount) return a.cardCount - b.cardCount;
    if (a.points !== b.points) return b.points - a.points;
    return a.wildCount - b.wildCount;
  });
  return options;
}

function buildDiscardPickupPlan(state, totals = []) {
  const pickupIds = getDiscardPickupSelection(state, totals);
  if (!pickupIds?.length) return null;

  const taken = [...state.discard];
  const liftedState = {
    ...state,
    discard: [],
    discardFrozen: false,
    players: state.players.map((player, index) =>
      index === state.turnIndex
        ? {
            ...player,
            hand: [...player.hand, ...taken],
            redThrees: [...player.redThrees],
          }
        : { ...player, hand: [...player.hand], redThrees: [...player.redThrees] }
    ),
  };

  const player = liftedState.players[liftedState.turnIndex];
  const team = liftedState.teams[player.teamId];
  const req = openingRequirement(getPlayerOpeningTotal(liftedState, totals, liftedState.turnIndex));

  if (team?.opened) {
    return { liftedState, groups: [[...pickupIds]], selectedIds: [...pickupIds] };
  }

  const top = state.discard[state.discard.length - 1];
  const selectedCards = player.hand.filter((card) => pickupIds.includes(card.id));
  const pickupRank = top?.rank ?? selectedCards.find((card) => !isWild(card))?.rank ?? null;
  if (!Number.isFinite(pickupRank)) return null;

  const used = new Set(pickupIds);
  const pickupNaturals = selectedCards
    .filter((card) => !isWild(card) && card.rank === pickupRank)
    .sort((a, b) => cardPoints(b) - cardPoints(a));
  const extraPickupNaturals = player.hand
    .filter((card) => !used.has(card.id) && !isWild(card) && card.rank === pickupRank)
    .sort((a, b) => cardPoints(b) - cardPoints(a));

  const naturalsByRank = new Map();
  for (const card of player.hand) {
    if (used.has(card.id) || isWild(card) || card.rank === 3 || card.rank === pickupRank) continue;
    const arr = naturalsByRank.get(card.rank) ?? [];
    arr.push(card);
    naturalsByRank.set(card.rank, arr);
  }

  naturalsByRank.forEach((cards, rank) => {
    naturalsByRank.set(
      rank,
      [...cards].sort((a, b) => cardPoints(b) - cardPoints(a))
    );
  });

  const wildPool = player.hand
    .filter((card) => !used.has(card.id) && isWild(card))
    .sort((a, b) => cardPoints(b) - cardPoints(a));

  const rankOrder = [pickupRank, ...[...naturalsByRank.keys()].sort((a, b) => a - b)];
  const optionsByRank = new Map();
  optionsByRank.set(
    pickupRank,
    buildRankGroupOptions([...pickupNaturals, ...extraPickupNaturals], wildPool.length, pickupNaturals.length)
  );
  for (const [rank, cards] of naturalsByRank.entries()) {
    const options = buildRankGroupOptions(cards, wildPool.length, 2);
    if (options.length > 0) optionsByRank.set(rank, options);
  }

  let bestPlan = null;

  function maybeStorePlan(groups) {
    const selectedIds = groups.flat();
    const preview = applyMeldGroups(liftedState, groups, selectedIds, totals);
    if (preview.error) return;

    if (req === "canasta") {
      const before = teamCanastaCount(liftedState.teams[player.teamId]);
      const after = teamCanastaCount(preview.state.teams[player.teamId]);
      if (after <= before) return;
    } else {
      const selectionPoints = player.hand
        .filter((card) => selectedIds.includes(card.id))
        .reduce((acc, card) => acc + Math.max(0, cardPoints(card)), 0);
      if (selectionPoints < req) return;
    }

    const cardCount = selectedIds.length;
    if (
      !bestPlan ||
      cardCount < bestPlan.cardCount ||
      (cardCount === bestPlan.cardCount && selectedIds.length < bestPlan.selectedIds.length)
    ) {
      bestPlan = { groups: groups.map((group) => [...group]), selectedIds: [...selectedIds], cardCount };
    }
  }

  function search(rankIndex, availableWilds, groups) {
    if (rankIndex >= rankOrder.length) {
      maybeStorePlan(groups);
      return;
    }

    const rank = rankOrder[rankIndex];
    const options = optionsByRank.get(rank) ?? [];
    const isPickupRank = rank === pickupRank;

    if (!isPickupRank) {
      search(rankIndex + 1, availableWilds, groups);
    }

    for (const option of options) {
      if (option.wildCount > availableWilds.length) continue;
      const assignedWilds = availableWilds.slice(0, option.wildCount).map((card) => card.id);
      search(
        rankIndex + 1,
        availableWilds.slice(option.wildCount),
        [...groups, [...option.naturalIds, ...assignedWilds]]
      );
    }
  }

  search(0, wildPool, []);
  if (!bestPlan) return null;
  return {
    liftedState,
    groups: bestPlan.groups,
    selectedIds: bestPlan.selectedIds,
  };
}

function canTakeDiscard(state, totals = []) {
  const plan = buildDiscardPickupPlan(state, totals);
  if (!plan) return false;
  const preview = applyMeldGroups(plan.liftedState, plan.groups, plan.selectedIds, totals);
  return !preview.error;
}

function takeDiscardStackState(state, totals = []) {
  if (!state || state.roundEnded || state.phase !== "draw") return state;
  const plan = buildDiscardPickupPlan(state, totals);
  if (!plan) return { ...state, notice: "Du kan inte ta kasthögen nu." };

  const meldResult = applyMeldGroups(plan.liftedState, plan.groups, plan.selectedIds, totals);
  if (meldResult.error) {
    return { ...state, notice: meldResult.error };
  }

  return {
    ...meldResult.state,
    phase: "discard",
    notice: `${meldResult.state.players[meldResult.state.turnIndex].name} tog hela kasthögen och öppnade direkt.`,
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
    discardFrozen: Boolean(state.discardFrozen || isWild(card) || isBlackThree(card)),
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

  const teamTotal = getPlayerOpeningTotal(state, totals, state.turnIndex);

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

  if (hand.length === 0) {
    if (teamCanastaCount(nextTeams[teamId]) < 2) {
      return { state, error: "Ni måste ha minst 2 canastor för att få gå ut." };
    }
    return {
      state: {
        ...state,
        players: nextPlayers,
        teams: nextTeams,
        roundEnded: true,
        winnerPlayerId: player.id,
        winnerTeamId: player.teamId,
        notice: `${player.name} gick ut genom att lägga sista korten.`,
      },
      error: null,
    };
  }

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
  const teamTotal = getPlayerOpeningTotal(state, totals, state.turnIndex);
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

function getMeldPlanTargetRanks(state, selected) {
  if (!state?.players?.length || !selected?.length) return [];
  const player = state.players[state.turnIndex];
  if (!player) return [];
  const team = state.teams?.[player.teamId];
  const naturals = selected.filter((c) => !isWild(c));
  const wilds = selected.filter((c) => isWild(c));
  if (wilds.length === 0) return [];

  const naturalRanks = [...new Set(naturals.map((c) => c.rank))].sort((a, b) => a - b);
  if (naturalRanks.length > 1) return naturalRanks;
  if (naturalRanks.length === 1) return naturalRanks;

  const existingRanks = [...new Set((team?.melds ?? []).map((m) => m.rank).filter((r) => r !== 0))].sort((a, b) => a - b);
  return existingRanks;
}

function shouldUseMeldPlanner(state, cardIds) {
  if (!state || !cardIds?.length) return false;
  const player = state.players[state.turnIndex];
  if (!player) return false;
  const selected = player.hand.filter((c) => cardIds.includes(c.id));
  const targetRanks = getMeldPlanTargetRanks(state, selected);
  return targetRanks.length > 1;
}

function createMeldPlan(state, cardIds) {
  const player = state.players[state.turnIndex];
  const selected = player.hand.filter((c) => cardIds.includes(c.id));
  const naturals = selected.filter((c) => !isWild(c));
  const wilds = selected.filter((c) => isWild(c));
  const targetRanks = getMeldPlanTargetRanks(state, selected);
  const fallbackNatural = naturals[0]?.rank ?? null;
  const defaultRank = targetRanks[0] ?? fallbackNatural;
  const assignments = {};
  for (const c of wilds) {
    if (Number.isFinite(defaultRank)) assignments[c.id] = defaultRank;
  }
  return {
    selectedIds: [...cardIds],
    targetRanks: targetRanks.length > 0 ? targetRanks : [defaultRank].filter((v) => Number.isFinite(v)),
    assignments,
    activeCardId: wilds[0]?.id ?? null,
    error: "",
  };
}

function resolvePlannedGroups(state, plan) {
  const player = state.players[state.turnIndex];
  const selected = player.hand.filter((c) => plan.selectedIds.includes(c.id));
  if (!selected.length) return { groups: [], error: "Inga kort valda." };
  const byRank = new Map();
  for (const card of selected) {
    const target = isWild(card) ? Number(plan.assignments?.[card.id]) : card.rank;
    if (!Number.isFinite(target)) return { groups: [], error: "Välj stick för alla joker/tvåor." };
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

  const teamTotal = getPlayerOpeningTotal(state, totals, state.turnIndex);
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
  initialPlayerName = "Spelare 1",
  onLeaderboardPointsAwarded = null,
  roomCode = "",
  friends = [],
  sentInvites = {},
  onSendRoomInvite = null,
  onShareRoom = null,
  isHost = true,
  hostName = "",
  roomPlayers = [],
  roomState = null,
  playerId = null,
  onAddBot = null,
  onRemoveBot = null,
  onUpdateLobbyConfig = null,
  onSyncMatchState = null,
}) {
  const [stage, setStage] = useState("setup");
  const [mode, setMode] = useState("single");
  const [targetScore, setTargetScore] = useState(10000);
  const [lobbyPlayers, setLobbyPlayers] = useState(() => [
    { id: "human-1", name: initialPlayerName || "Spelare 1", isBot: false },
  ]);
  const [totals, setTotals] = useState([0, 0, 0, 0, 0, 0]);
  const [game, setGame] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [handOrder, setHandOrder] = useState([]);
  const [dragCardId, setDragCardId] = useState(null);
  const [hoverCardId, setHoverCardId] = useState(null);
  const [handDropSide, setHandDropSide] = useState(null);
  const [mobileSortMode, setMobileSortMode] = useState(false);
  const [recentDrawnIds, setRecentDrawnIds] = useState([]);
  const [meldPlan, setMeldPlan] = useState(null);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [vibrateOnTurn, setVibrateOnTurn] = useState(true);
  const [themeCategory, setThemeCategory] = useState("standard");
  const [invitePanelOpen, setInvitePanelOpen] = useState(false);
  const [turnFlash, setTurnFlash] = useState(false);
  const [inactiveFlash, setInactiveFlash] = useState(false);
  const [roundLeaderboardPoints, setRoundLeaderboardPoints] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [nextRoundCountdown, setNextRoundCountdown] = useState(null);
  const [transitioningToGame, setTransitioningToGame] = useState(false);
  const [lobbyStatus, setLobbyStatus] = useState("");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false
  );
  const prevTurnRef = useRef(null);
  const turnFlashTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const handAreaRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressTapRef = useRef(false);
  const pointerStartRef = useRef(null);
  const pressedCardIdRef = useRef(null);
  const dragTargetRef = useRef({ side: null, targetId: null });
  const pointsAwardedRef = useRef(false);
  const roundScoreAppliedRef = useRef(false);
  const startTransitionTimerRef = useRef(null);
  const lobbyStatusTimerRef = useRef(null);
  const nextRoundTimerRef = useRef(null);
  const nextRoundIntervalRef = useRef(null);
  const previousLobbyIdsRef = useRef([]);
  const previousLobbyConfigRef = useRef({ mode: null, targetScore: null });
  const canastaMatchSyncRef = useRef("");
  const canastaMatchVersionRef = useRef(0);
  const prevHandIdsRef = useRef([]);

  const canastaStorageKey = useMemo(() => {
    if (!roomCode) return null;
    return `canasta_session_${roomCode.toUpperCase()}`;
  }, [roomCode]);

  const syncedLobbyPlayers = useMemo(() => {
    if (Array.isArray(roomPlayers) && roomPlayers.length > 0) {
      return roomPlayers.map((player, idx) => ({
        id: player.id,
        name: player.name?.trim() || `Spelare ${idx + 1}`,
        isBot: String(player.device_id ?? "").startsWith("bot:"),
      }));
    }
    return [{ id: "human-1", name: initialPlayerName || "Spelare 1", isBot: false }];
  }, [roomPlayers, initialPlayerName]);

  const roomRoundCounts = roomState?.round_counts ?? {};
  const sharedLobbyMode = roomRoundCounts?.__canasta_mode;
  const sharedTargetScore = Number(roomRoundCounts?.__canasta_target_score);
  const sharedCanastaMatch = roomRoundCounts?.__canasta_match ?? null;

  const activePlayer = game ? game.players[game.turnIndex] : null;
  const seatPlayers = useMemo(() => {
    if (Array.isArray(syncedLobbyPlayers) && syncedLobbyPlayers.length > 0) {
      return syncedLobbyPlayers;
    }
    if (game?.players?.length) {
      return game.players.map((player, idx) => ({
        id: player.id ?? `seat-${idx}`,
        name: player.name,
        isBot: Boolean(player.isBot),
      }));
    }
    return [];
  }, [syncedLobbyPlayers, game]);
  const localPlayerIndex = useMemo(() => {
    if (!game?.players?.length) return 0;
    if (playerId && seatPlayers.length > 0) {
      const roomIndex = seatPlayers.findIndex((p) => p.id === playerId);
      if (roomIndex >= 0 && roomIndex < game.players.length) return roomIndex;
    }
    const firstHuman = game.players.findIndex((p) => !p.isBot);
    return firstHuman >= 0 ? firstHuman : 0;
  }, [game, playerId, seatPlayers]);
  const myPlayer = game ? game.players[localPlayerIndex] : null;
  const topDiscard = game?.discard?.[game.discard.length - 1] ?? null;
  const isBotTurn = Boolean(activePlayer?.isBot);
  const activeSeatPlayerId = game && seatPlayers[game.turnIndex] ? seatPlayers[game.turnIndex].id : null;
  const localSeatPlayerId = seatPlayers[localPlayerIndex]?.id ?? null;
  const canAuthorMatchUpdate = Boolean(
    game &&
      (game.roundEnded
        ? isHost
        : (isBotTurn && isHost) ||
          (!isBotTurn && playerId && activeSeatPlayerId && String(activeSeatPlayerId) === String(playerId)) ||
          (!isBotTurn && !playerId && game.turnIndex === localPlayerIndex))
  );
  const isMyTurn = Boolean(
    game &&
      !game.roundEnded &&
      !isBotTurn &&
      ((playerId && activeSeatPlayerId && String(activeSeatPlayerId) === String(playerId)) ||
        (!playerId && game.turnIndex === localPlayerIndex) ||
        (!activeSeatPlayerId && localSeatPlayerId && game.turnIndex === localPlayerIndex))
  );
  const canSortHand = !game?.roundEnded;
  const handReorderEnabled = canSortHand && (!isMobile || mobileSortMode);
  const standardThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "standard"),
    [themes]
  );
  const specialThemes = useMemo(
    () => themes.filter((theme) => (theme.category ?? "standard") === "special"),
    [themes]
  );
  const visibleThemes = themeCategory === "special" ? specialThemes : standardThemes;

  const teamTotals = useMemo(() => {
    if (!game) return {};
    const byTeam = Object.fromEntries(
      [...new Set(game.players.map((player) => player.teamId))].map((teamId) => [
        teamId,
        getTeamTotalFromTotals(game, totals, teamId),
      ])
    );
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
  const visibleTeamZones = teamZones;
  const openingByPlayer = useMemo(() => {
    if (!game) return [];
    return game.players.map((_, i) => openingRequirement(getPlayerOpeningTotal(game, totals, i)));
  }, [game, totals]);
  const seatTemplates = useMemo(
    () => seatTemplateList(game?.players?.length ?? 0, isMobile),
    [game?.players?.length, isMobile]
  );

  const orderedHand = useMemo(() => {
    if (!myPlayer) return [];
    const byId = new Map(myPlayer.hand.map((c) => [c.id, c]));
    const ordered = handOrder.map((id) => byId.get(id)).filter(Boolean);
    for (const c of myPlayer.hand) {
      if (!ordered.some((x) => x.id === c.id)) ordered.push(c);
    }
    return ordered;
  }, [myPlayer, handOrder]);

  const ids = orderedHand.map((c) => c.id);
  const actualHandCount = orderedHand.length;
  const handCount = Math.max(actualHandCount, 1);
  const handCenter = (handCount - 1) / 2;
  const handCardWidth = isMobile
    ? actualHandCount >= 18
      ? 44
      : actualHandCount >= 15
      ? 48
      : actualHandCount >= 12
      ? 54
      : 64
    : actualHandCount >= 18
    ? 62
    : 80;
  const handCardHeight = Math.round(handCardWidth * 1.5);
  const handAreaHeight = isMobile ? (actualHandCount >= 15 ? 138 : 150) : 192;
  const handSpan = isMobile ? 320 : 680;
  const handStep = Math.min(isMobile ? 34 : 46, handCount > 1 ? handSpan / (handCount - 1) : 0);
  const resolveHandDropTarget = useCallback((clientX) => {
    const container = handAreaRef.current;
    if (!container || !orderedHand.length) return { side: null, targetId: null };
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const dragIdx = orderedHand.findIndex((c) => c.id === dragCardId);
    const centers = orderedHand.map((_, idx) => rect.width / 2 + (idx - handCenter) * handStep);
    const sideInset = Math.max(6, Math.min(isMobile ? 10 : 16, handStep * 0.28));

    if (x <= centers[0] - sideInset) {
      return { side: "left", targetId: orderedHand[0]?.id ?? null };
    }
    if (x >= centers[centers.length - 1] + sideInset) {
      return { side: "right", targetId: orderedHand[orderedHand.length - 1]?.id ?? null };
    }

    let targetIdx = centers.length - 1;
    for (let i = 0; i < centers.length - 1; i += 1) {
      const midpoint = (centers[i] + centers[i + 1]) / 2;
      if (x < midpoint) {
        targetIdx = i;
        break;
      }
      targetIdx = i + 1;
    }

    if (dragIdx >= 0) {
      if (targetIdx === dragIdx) {
        targetIdx = x >= centers[dragIdx]
          ? Math.min(orderedHand.length - 1, dragIdx + 1)
          : Math.max(0, dragIdx - 1);
      }
    }

    let targetId = orderedHand[targetIdx]?.id ?? null;
    if (targetId === dragCardId && dragIdx >= 0) {
      const fallbackIdx = x >= centers[dragIdx]
        ? Math.min(orderedHand.length - 1, dragIdx + 1)
        : Math.max(0, dragIdx - 1);
      targetId = orderedHand[fallbackIdx]?.id ?? null;
    }
    return { side: null, targetId };
  }, [orderedHand, dragCardId, handCenter, handStep, isMobile]);

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

  useEffect(() => {
    setLobbyPlayers(syncedLobbyPlayers);
  }, [syncedLobbyPlayers]);

  useEffect(() => {
    if (!canastaStorageKey || typeof window === "undefined") return;
    if (roomCode && typeof onSyncMatchState === "function") return;
    try {
      const raw = window.localStorage.getItem(canastaStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.stage === "game" && saved?.game) {
        setGame(saved.game);
        setTotals(Array.isArray(saved.totals) ? saved.totals : []);
        setSelectedIds([]);
        setHandOrder([]);
        setMobileSortMode(false);
        setMeldPlan(null);
        setExpandedTeamId(null);
        setStage("game");
      }
    } catch {
      // Ignore broken saved sessions.
    }
  }, [canastaStorageKey, roomCode, onSyncMatchState]);

  useEffect(() => {
    if (!canastaStorageKey || typeof window === "undefined") return;
    try {
      if (stage === "game" && game) {
        window.localStorage.setItem(
          canastaStorageKey,
          JSON.stringify({
            stage,
            mode,
            targetScore,
            totals,
            game,
            savedAt: Date.now(),
          })
        );
      } else {
        window.localStorage.removeItem(canastaStorageKey);
      }
    } catch {
      // Ignore persistence issues.
    }
  }, [canastaStorageKey, stage, mode, targetScore, totals, game]);

  useEffect(() => {
    if (sharedLobbyMode === "single" || sharedLobbyMode === "team") {
      setMode(sharedLobbyMode);
    }
  }, [sharedLobbyMode]);

  useEffect(() => {
    if (sharedTargetScore === 5000 || sharedTargetScore === 10000) {
      setTargetScore(sharedTargetScore);
    }
  }, [sharedTargetScore]);

  useEffect(() => {
    if (!sharedCanastaMatch?.game || sharedCanastaMatch?.stage !== "game") return;
    const incomingVersion = Number(sharedCanastaMatch.savedAt || 0);
    if (incomingVersion && incomingVersion < canastaMatchVersionRef.current) return;
    const serialized = JSON.stringify({
      stage: sharedCanastaMatch.stage,
      game: sharedCanastaMatch.game,
      totals: sharedCanastaMatch.totals ?? [],
    });
    if (serialized === canastaMatchSyncRef.current) return;
    if (incomingVersion) canastaMatchVersionRef.current = incomingVersion;
    canastaMatchSyncRef.current = serialized;
    const shouldAnimateStart = stage !== "game";
    if (shouldAnimateStart) {
      setTransitioningToGame(true);
      if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
      startTransitionTimerRef.current = setTimeout(() => setTransitioningToGame(false), 950);
      if (sharedCanastaMatch.updatedBy && playerId && String(sharedCanastaMatch.updatedBy) !== String(playerId)) {
        setLobbyStatus("Värden startade matchen.");
      }
    }
    setGame(sharedCanastaMatch.game);
    setTotals(Array.isArray(sharedCanastaMatch.totals) ? sharedCanastaMatch.totals : []);
    setSelectedIds([]);
    setHandOrder([]);
    setMobileSortMode(false);
    setMeldPlan(null);
    setExpandedTeamId(null);
    setStage("game");
  }, [sharedCanastaMatch, stage, playerId]);

  useEffect(() => {
    if (stage !== "game" || !game || typeof onSyncMatchState !== "function") return;
    if (!canAuthorMatchUpdate) return;
    const nextSavedAt = Date.now();
    if (nextSavedAt < canastaMatchVersionRef.current) return;
    const payload = {
      stage: "game",
      game,
      totals,
      mode,
      targetScore,
      updatedBy: playerId ?? null,
      turnOwnerId: activeSeatPlayerId ?? null,
      savedAt: nextSavedAt,
    };
    const serialized = JSON.stringify({
      stage: payload.stage,
      game: payload.game,
      totals: payload.totals,
    });
    if (serialized === canastaMatchSyncRef.current) return;
    canastaMatchVersionRef.current = nextSavedAt;
    canastaMatchSyncRef.current = serialized;
    void onSyncMatchState(payload);
  }, [stage, game, totals, mode, targetScore, playerId, onSyncMatchState, canAuthorMatchUpdate, activeSeatPlayerId]);

  useEffect(() => {
    const previous = previousLobbyConfigRef.current;
    if (previous.mode == null && previous.targetScore == null) {
      previousLobbyConfigRef.current = { mode, targetScore };
      return;
    }

    if (!isHost && previous.mode !== mode) {
      setLobbyStatus(`Värden ändrade spelläge till ${mode === "team" ? "Lag 2v2" : "Singel"}.`);
    } else if (!isHost && previous.targetScore !== targetScore) {
      setLobbyStatus(`Värden ändrade matchmålet till ${targetScore.toLocaleString("sv-SE")} poäng.`);
    }

    previousLobbyConfigRef.current = { mode, targetScore };
  }, [mode, targetScore, isHost]);

  function start() {
    if (!isHost) return;
    const playerCount = lobbyPlayers.length;
    if (playerCount < 1 || playerCount > 4) return;
    if (mode === "team" && playerCount !== 4) return;
    const playersConfig = lobbyPlayers.map((p, idx) => ({
      name: p.name?.trim() || (p.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
      isBot: Boolean(p.isBot),
    }));
    const next = makeGame({ names: playersConfig.map((p) => p.name), mode, playersConfig });
    setGame(next);
    setTotals(Array(playerCount).fill(0));
    setSelectedIds([]);
    setHandOrder([]);
    setTransitioningToGame(true);
    if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
    startTransitionTimerRef.current = setTimeout(() => {
      setStage("game");
      setTimeout(() => setTransitioningToGame(false), 260);
    }, 850);
  }

  function startNextRound() {
    if (!isHost || !game?.roundEnded) return;
    const playersConfig = game.players.map((player, idx) => ({
      name: player.name?.trim() || (player.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
      isBot: Boolean(player.isBot),
    }));
    const next = makeGame({ names: playersConfig.map((player) => player.name), mode: game.mode, playersConfig });
    pointsAwardedRef.current = false;
    roundScoreAppliedRef.current = false;
    setRoundLeaderboardPoints(null);
    setRoundResult(null);
    setNextRoundCountdown(null);
    setSelectedIds([]);
    setHandOrder([]);
    setMobileSortMode(false);
    setMeldPlan(null);
    setExpandedTeamId(null);
    setTurnFlash(false);
    setInactiveFlash(false);
    setGame(next);
  }

  function addBotToLobby() {
    if (typeof onAddBot === "function") {
      onAddBot();
    }
  }

  function removeLobbyPlayer(id) {
    if (!id) return;
    if (typeof onRemoveBot === "function") {
      onRemoveBot(id);
    }
  }

  useEffect(() => {
    if (!isHost || typeof onUpdateLobbyConfig !== "function") return;
    if (sharedLobbyMode === mode && sharedTargetScore === targetScore) return;
    onUpdateLobbyConfig({
      mode,
      targetScore,
    });
  }, [isHost, mode, targetScore, onUpdateLobbyConfig, sharedLobbyMode, sharedTargetScore]);

  useEffect(() => {
    if (stage !== "setup") return;
    const currentIds = syncedLobbyPlayers.map((p) => p.id);
    const previousIds = previousLobbyIdsRef.current;
    if (!previousIds.length) {
      previousLobbyIdsRef.current = currentIds;
      return;
    }

    if (currentIds.length > previousIds.length) {
      const joined = syncedLobbyPlayers.find((p) => !previousIds.includes(p.id));
      if (joined) {
        setLobbyStatus(`${joined.name} gick med i lobbyn.`);
      }
    } else if (currentIds.length < previousIds.length) {
      setLobbyStatus("En spelare lämnade lobbyn.");
    }

    previousLobbyIdsRef.current = currentIds;
  }, [stage, syncedLobbyPlayers]);

  useEffect(() => {
    if (!lobbyStatus) return;
    if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
    lobbyStatusTimerRef.current = setTimeout(() => setLobbyStatus(""), 2600);
    return () => {
      if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
    };
  }, [lobbyStatus]);

  useEffect(
    () => () => {
      if (startTransitionTimerRef.current) clearTimeout(startTransitionTimerRef.current);
      if (lobbyStatusTimerRef.current) clearTimeout(lobbyStatusTimerRef.current);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
    },
    []
  );

  const handleBack = useCallback(() => {
    if (canastaStorageKey && typeof window !== "undefined") {
      window.localStorage.removeItem(canastaStorageKey);
    }
    canastaMatchSyncRef.current = "";
    onBack?.();
  }, [canastaStorageKey, onBack]);

  function drawTwo() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => drawTwoState(prev));
  }

  function takeDiscardStack() {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => takeDiscardStackState(prev, totals));
  }

  function discard(cardId) {
    if (!game || !isMyTurn || isBotTurn) return;
    setMobileSortMode(false);
    setMeldPlan(null);
    setSelectedIds([]);
    setGame((prev) => discardState(prev, cardId));
  }

  const moveHandCard = useCallback((fromId, toId) => {
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
  }, [orderedHand]);

  function toggleMobileSortMode() {
    if (!isMobile || !canSortHand) return;
    setMobileSortMode((prev) => {
      const next = !prev;
      if (!next) {
        setDragCardId(null);
        setHoverCardId(null);
        setHandDropSide(null);
        suppressTapRef.current = false;
      }
      return next;
    });
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
    if (mobileSortMode) return;
    setMeldPlan(null);
    setSelectedIds((prev) => (prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]));
  }

  function laySelected() {
    if (!game || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
    if (mobileSortMode) return;
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
    if (!game || !meldPlan || !isMyTurn || isBotTurn || game.roundEnded || game.phase !== "discard") return;
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
    if (!game || game.roundEnded || !isHost) return undefined;
    const bot = game.players[game.turnIndex];
    if (!bot?.isBot) return undefined;

    const id = setTimeout(() => {
      setGame((prev) => {
        if (!prev || prev.roundEnded) return prev;
        const active = prev.players[prev.turnIndex];
        if (!active?.isBot) return prev;
        let next = prev;

        if (next.phase === "draw") {
          next = canTakeDiscard(next, totals) ? takeDiscardStackState(next, totals) : drawTwoState(next);
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
  }, [game, totals, isHost]);

  useEffect(() => {
    if (!myPlayer) return;
    setMeldPlan(null);
    setHandOrder((prev) => {
      const currentIds = myPlayer.hand.map((c) => c.id);
      if (isMobile && !mobileSortMode) {
        return sortHandCards(myPlayer.hand).map((card) => card.id);
      }
      const keep = prev.filter((id) => currentIds.includes(id));
      const missing = currentIds.filter((id) => !keep.includes(id));
      return [...keep, ...missing];
    });
    setSelectedIds((prev) => prev.filter((id) => myPlayer.hand.some((c) => c.id === id)));
    setDragCardId(null);
    setHoverCardId(null);
    setHandDropSide(null);
  }, [myPlayer, isMobile, mobileSortMode]);

  useEffect(() => {
    if (!myPlayer) {
      prevHandIdsRef.current = [];
      setRecentDrawnIds([]);
      return;
    }
    const currentIds = myPlayer.hand.map((card) => card.id);
    const previousIds = prevHandIdsRef.current;
    if (previousIds.length === 0) {
      setRecentDrawnIds([]);
    } else if (isMyTurn && game?.phase === "discard" && currentIds.length > previousIds.length) {
      setRecentDrawnIds(currentIds.filter((id) => !previousIds.includes(id)));
    } else if (!isMyTurn || game?.phase !== "discard") {
      setRecentDrawnIds([]);
    } else {
      setRecentDrawnIds((prev) => prev.filter((id) => currentIds.includes(id)));
    }
    prevHandIdsRef.current = currentIds;
  }, [myPlayer, game?.phase, isMyTurn]);

  useEffect(() => {
    if (!game?.roundEnded) {
      pointsAwardedRef.current = false;
      roundScoreAppliedRef.current = false;
      setRoundLeaderboardPoints(null);
      setRoundResult(null);
      setNextRoundCountdown(null);
      return;
    }

    const { scoresByTeam, winnerTeamId } = computeRoundResults(game);
    setRoundResult({ scoresByTeam, winnerTeamId });

    if (!roundScoreAppliedRef.current && canAuthorMatchUpdate) {
      roundScoreAppliedRef.current = true;
      setTotals((prev) => updateTotalsAfterRound(game, prev));
    }

    if (pointsAwardedRef.current) return;
    pointsAwardedRef.current = true;
    const winners = game.players.filter((player) => player.teamId === winnerTeamId);
    const humans = winners.filter((player) => !player.isBot).length;
    const bots = winners.filter((player) => player.isBot).length;
    const basePoints = humans * 4 + bots;
    const points = targetScore === 5000 ? basePoints / 2 : basePoints;
    const payload = {
      points,
      humans,
      bots,
      totalPlayers: game.players.length,
      teamId: winnerTeamId,
      roundScore: Number(scoresByTeam[winnerTeamId] || 0),
    };
    setRoundLeaderboardPoints(payload);
    if (typeof onLeaderboardPointsAwarded === "function" && points > 0) {
      onLeaderboardPointsAwarded(payload);
    }
  }, [game, onLeaderboardPointsAwarded, targetScore, canAuthorMatchUpdate]);

  useEffect(() => {
    if (!game?.roundEnded || !isHost) {
      setNextRoundCountdown(null);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      return;
    }

    const winnerTeamId = getMatchWinnerTeamId(game, totals, targetScore);
    if (winnerTeamId) {
      setNextRoundCountdown(null);
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      return;
    }

    const durationSeconds = 15;
    setNextRoundCountdown(durationSeconds);

    if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
    if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);

    nextRoundIntervalRef.current = setInterval(() => {
      setNextRoundCountdown((prev) => {
        if (prev == null) return prev;
        return prev > 0 ? prev - 1 : 0;
      });
    }, 1000);

    nextRoundTimerRef.current = setTimeout(() => {
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
      startNextRound();
    }, durationSeconds * 1000);

    return () => {
      if (nextRoundTimerRef.current) clearTimeout(nextRoundTimerRef.current);
      if (nextRoundIntervalRef.current) clearInterval(nextRoundIntervalRef.current);
    };
  }, [game, totals, targetScore, isHost]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

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

  useEffect(() => {
    if (!isMobile || !dragCardId || game?.roundEnded) return undefined;

    function updateHoverAndSide(clientX) {
      const resolved = resolveHandDropTarget(clientX);
      dragTargetRef.current = resolved;
      setHandDropSide(resolved.side);
      setHoverCardId(resolved.side ? null : resolved.targetId);
    }

    function onPointerMove(e) {
      updateHoverAndSide(e.clientX);
    }

    function onPointerUp(e) {
      const resolved = resolveHandDropTarget(e.clientX);
      dragTargetRef.current = resolved;
      const targetId = resolved.targetId;
      if (targetId && targetId !== dragCardId) moveHandCard(dragCardId, targetId);
      setDragCardId(null);
      setHoverCardId(null);
      setHandDropSide(null);
      dragTargetRef.current = { side: null, targetId: null };
      suppressTapRef.current = false;
    }

    function onPointerCancel() {
      setDragCardId(null);
      setHoverCardId(null);
      setHandDropSide(null);
      dragTargetRef.current = { side: null, targetId: null };
      suppressTapRef.current = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [isMobile, dragCardId, game?.roundEnded, moveHandCard, resolveHandDropTarget]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
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
      setMobileSortMode(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      pointerStartRef.current = null;
      pressedCardIdRef.current = null;
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

  useEffect(() => {
    if (!dragCardId) return;
    suppressTapRef.current = true;
  }, [dragCardId]);

  if (stage === "setup") {
    const lobbyCount = lobbyPlayers.length;
    const canStart = isHost && lobbyCount >= 1 && lobbyCount <= 4 && (mode === "single" || lobbyCount === 4);
    const humansInLobby = lobbyPlayers.filter((p) => !p.isBot).length;
    const botsInLobby = lobbyPlayers.filter((p) => p.isBot).length;
    const lobbySeats = seatTemplateList(4, isMobile);
    const seatPlayers = Array.from({ length: 4 }, (_, idx) => lobbyPlayers[idx] ?? null);
    const openSeatCount = Math.max(0, 4 - lobbyCount);
    return (
      <Card
        style={{
          position: "relative",
          padding: 20,
          background: "linear-gradient(180deg, rgba(8,12,20,.99), rgba(10,16,30,.985))",
          border: "1px solid rgba(148,163,184,.35)",
          boxShadow: "0 22px 56px rgba(2,6,23,.52)",
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 16,
              borderRadius: 18,
              border: "1px solid rgba(125,211,252,.22)",
              background:
                "radial-gradient(circle at top left, rgba(56,189,248,.16), transparent 42%), radial-gradient(circle at top right, rgba(34,197,94,.14), transparent 40%), rgba(255,255,255,.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <h2 style={{ margin: 0 }}>Canasta-lobby</h2>
                <div style={{ color: "var(--muted)", fontWeight: 700 }}>
                  Bygg bordet innan ni startar. Du kan spela solo, bjuda in vänner eller fylla ut med bottar.
                </div>
              </div>
              <div
                style={{
                  minWidth: 150,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,.24)",
                  background: "rgba(2,6,23,.42)",
                }}
              >
                <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Rumskod</div>
                <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1.4 }}>
                  {roomCode ? roomCode.toUpperCase() : "INGEN"}
                </div>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                minHeight: isMobile ? 300 : 360,
                borderRadius: isMobile ? 18 : 24,
                border: "1px solid rgba(34,197,94,.28)",
                backgroundImage: [
                  "radial-gradient(circle at 18% 18%, rgba(56,189,248,.18), transparent 34%)",
                  "radial-gradient(circle at 82% 12%, rgba(34,197,94,.14), transparent 30%)",
                  "linear-gradient(180deg, rgba(8,40,48,.96), rgba(3,20,34,.98))",
                ].join(", "),
                boxShadow: "inset 0 0 0 2px rgba(16,185,129,.16), 0 16px 40px rgba(2,6,23,.3)",
                overflow: "hidden",
              }}
            >
              {seatPlayers.map((player, idx) => {
                const seat = lobbySeats[idx] ?? lobbySeats[0] ?? { top: "90%", left: "50%" };
                const isOpenSeat = !player;
                return (
                  <div
                    key={player ? `seat-${player.id}` : `seat-open-${idx}`}
                    style={{
                      position: "absolute",
                      left: seat.left,
                      top: seat.top,
                      transform: "translate(-50%, -50%)",
                      minWidth: isMobile ? 104 : 132,
                      padding: isMobile ? "10px 10px" : "12px 12px",
                      borderRadius: 16,
                      border: isOpenSeat
                        ? "1px dashed rgba(148,163,184,.3)"
                        : idx === 0
                        ? "1px solid rgba(56,189,248,.55)"
                        : "1px solid rgba(148,163,184,.24)",
                      background: isOpenSeat
                        ? "linear-gradient(180deg, rgba(15,23,42,.28), rgba(5,12,18,.18))"
                        : idx === 0
                        ? "linear-gradient(180deg, rgba(8,47,73,.88), rgba(8,24,40,.92))"
                        : "linear-gradient(180deg, rgba(15,23,42,.88), rgba(5,12,18,.92))",
                      boxShadow: "0 10px 24px rgba(2,6,23,.34)",
                      textAlign: "center",
                      opacity: isOpenSeat ? 0.82 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: isMobile ? 14 : 15 }}>
                      {isOpenSeat ? "Ledig plats" : player.name || (player.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`)}
                    </div>
                    <div
                      style={{
                        color: isOpenSeat ? "rgba(191,219,254,.72)" : player.isBot ? "#fde68a" : "#93c5fd",
                        fontWeight: 800,
                        fontSize: 11,
                        marginTop: 4,
                      }}
                    >
                      {isOpenSeat
                        ? roomCode
                          ? "Joina via kod"
                          : "Väntar"
                        : idx === 0
                        ? (isHost ? "Värd" : "Du")
                        : player.isBot
                        ? "Bot"
                        : "Spelare"}
                    </div>
                  </div>
                );
              })}

              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: isMobile ? 128 : 170,
                  height: isMobile ? 88 : 112,
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,.18)",
                  background: "rgba(255,255,255,.03)",
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: isMobile ? 16 : 18 }}>Match till</div>
                <div style={{ color: "#fde68a", fontWeight: 900, fontSize: isMobile ? 22 : 28 }}>
                  {targetScore.toLocaleString("sv-SE")}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Spellage</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{mode === "team" ? "Lag 2v2" : "Singel"}</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Spelare</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{lobbyCount}/4</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Manniskor</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{humansInLobby}</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Bottar</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{botsInLobby}</div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Leaderboardbonus</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {targetScore === 5000 ? "Halv" : "Full"}
                </div>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: 14, background: "rgba(2,6,23,.34)", border: "1px solid rgba(148,163,184,.18)" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>Lediga platser</div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{openSeatCount}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant={mode === "single" ? "primary" : "ghost"} onClick={() => setMode("single")} disabled={!isHost}>
              Singel
            </Button>
            <Button variant={mode === "team" ? "primary" : "ghost"} onClick={() => setMode("team")} disabled={!isHost}>
              Lag (2v2)
            </Button>
            <Button onClick={addBotToLobby} disabled={!isHost || lobbyCount >= 4}>
              Lägg till bot
            </Button>
            <Button
              variant={targetScore === 5000 ? "primary" : "ghost"}
              onClick={() => setTargetScore(5000)}
              disabled={!isHost}
            >
              5 000 poäng
            </Button>
            <Button
              variant={targetScore === 10000 ? "primary" : "ghost"}
              onClick={() => setTargetScore(10000)}
              disabled={!isHost}
            >
              10 000 poäng
            </Button>
            <Button
              variant="ghost"
              onClick={() => onShareRoom?.()}
              disabled={!roomCode || typeof onShareRoom !== "function"}
              style={{ width: "auto" }}
            >
              Dela rum
            </Button>
          </div>

          {!isHost && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(250,204,21,.28)",
                background: "rgba(250,204,21,.08)",
                color: "#fde68a",
                fontWeight: 800,
              }}
            >
              {hostName ? `${hostName} är värd och startar matchen.` : "Värden startar matchen."}
            </div>
          )}

          {isHost && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(56,189,248,.24)",
                background: "rgba(56,189,248,.08)",
                color: "#bae6fd",
                fontWeight: 800,
              }}
            >
              Du är värd. Bjud in vänner med rumskoden eller fyll ut bordet med bottar innan du startar matchen.
            </div>
          )}

          {lobbyPlayers.some((p, idx) => idx > 0 && p?.isBot) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
                padding: 12,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,.2)",
                background: "rgba(255,255,255,.025)",
              }}
            >
              <div style={{ fontWeight: 900 }}>Bottar i lobbyn</div>
              {lobbyPlayers
                .filter((p, idx) => idx > 0 && p?.isBot)
                .map((bot) => (
                  <div
                    key={bot.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 999,
                      background: "rgba(2,6,23,.34)",
                      border: "1px solid rgba(148,163,184,.16)",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{bot.name}</div>
                    <Button
                      variant="ghost"
                      style={{ width: "auto", padding: "4px 8px" }}
                      onClick={() => removeLobbyPlayer(bot.id)}
                      disabled={!isHost}
                    >
                      Ta bort
                    </Button>
                  </div>
                ))}
            </div>
          )}

          {friends.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 14,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,.2)",
                background: "rgba(255,255,255,.025)",
              }}
            >
              <button
                type="button"
                onClick={() => setInvitePanelOpen((open) => !open)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  padding: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>Bjud in vänner</div>
                  <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Inbjudningar skickas till samma rumskod som visas ovan.
                  </div>
                </div>
                <div style={{ color: "#bfdbfe", fontWeight: 900, fontSize: 13 }}>
                  {invitePanelOpen ? "Dölj" : `Visa (${friends.length})`}
                </div>
              </button>
              {invitePanelOpen && (
                <div style={{ display: "grid", gap: 8 }}>
                  {friends.map((friend) => {
                    const sent = Boolean(sentInvites?.[friend.id]);
                    return (
                      <div
                        key={friend.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 12,
                          background: "rgba(2,6,23,.28)",
                          border: "1px solid rgba(148,163,184,.16)",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{friend.display_name}</div>
                        <Button
                          variant={sent ? "primary" : "ghost"}
                          onClick={() => onSendRoomInvite?.(friend.id)}
                          disabled={!roomCode || sent || typeof onSendRoomInvite !== "function" || lobbyCount >= 4}
                          style={{ width: "auto", padding: "6px 10px" }}
                        >
                          {sent ? "Skickat" : "Bjud in"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {mode === "team" && (
            <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 12 }}>
              Laglage kraver exakt 4 spelare. Singel kan startas direkt och fyllas pa senare.
            </div>
          )}
          {lobbyStatus && (
            <div style={{ color: "#93c5fd", fontWeight: 700, fontSize: 12 }}>
              {lobbyStatus}
            </div>
          )}
          {targetScore === 5000 && (
            <div style={{ color: "#bfdbfe", fontWeight: 700, fontSize: 12 }}>
              5 000-poängsmatch ger halva leaderboardbonusen jämfört med 10 000.
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isHost ? (
              <Button onClick={start} disabled={!canStart}>
                {lobbyCount < 2 ? "Skapa lobby" : "Starta match"}
              </Button>
            ) : (
              <Button variant="ghost" disabled>
                Väntar på värden
              </Button>
            )}
            <Button variant="ghost" onClick={handleBack}>
              Tillbaka
            </Button>
          </div>
        </div>
        {transitioningToGame && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              display: "grid",
              placeItems: "center",
              background: "radial-gradient(circle at 50% 45%, rgba(34,197,94,.18), rgba(2,6,23,.86))",
              borderRadius: 18,
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 20,
                border: "1px solid rgba(125,211,252,.28)",
                background: "rgba(8,12,20,.82)",
                boxShadow: "0 18px 40px rgba(2,6,23,.44)",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#e2e8f0", fontWeight: 900, fontSize: isMobile ? 24 : 30 }}>
                Match startar
              </div>
              <div style={{ color: "#93c5fd", fontWeight: 700, marginTop: 6 }}>
                Bordet förbereds...
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  }

  if (!game || !activePlayer || !myPlayer) return null;

  const canTakeDiscardNow = canTakeDiscard(game, totals);
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
  const wildForPlan = selectedForPlan.filter((c) => isWild(c));
  const planPreview = meldPlan ? resolvePlannedGroups(game, meldPlan) : { groups: [], error: null };
  const activePlanCard = meldPlan ? wildForPlan.find((c) => c.id === meldPlan.activeCardId) ?? null : null;
  const activePlanTargets = activePlanCard
    ? isWild(activePlanCard)
      ? meldPlan.targetRanks
      : [activePlanCard.rank]
    : [];
  const planPreviewCards = planPreview.groups.map((ids) =>
    ids.map((id) => selectedForPlan.find((c) => c.id === id)).filter(Boolean)
  );
  const expandedTeam = expandedTeamId ? teamZones.find((z) => z.teamId === expandedTeamId) ?? null : null;
  const matchWinnerTeamId = game?.roundEnded ? getMatchWinnerTeamId(game, totals, targetScore) : null;
  const matchWinnerLabel = matchWinnerTeamId
    ? teamZones.find((zone) => zone.teamId === matchWinnerTeamId)?.label ??
      game.players.find((player) => player.teamId === matchWinnerTeamId)?.name ??
      matchWinnerTeamId
    : null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: isMobile ? 34 : 42 }}>Canasta</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={() => setSettingsOpen((s) => !s)} style={{ width: "auto" }}>
            Inställningar
          </Button>
          <Button variant="ghost" onClick={handleBack} style={{ width: "auto" }}>
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
          {roundResult?.winnerTeamId
            ? `Rundan är slut. Vinnande sida: ${
                teamZones.find((zone) => zone.teamId === roundResult.winnerTeamId)?.label ??
                game.players.find((p) => p.teamId === roundResult.winnerTeamId)?.name ??
                roundResult.winnerTeamId
              }`
            : "Rundan är slut."}
          {roundResult ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Rondpoäng:{" "}
              {Object.entries(roundResult.scoresByTeam)
                .map(([teamId, score]) => {
                  const label =
                    teamZones.find((zone) => zone.teamId === teamId)?.label ??
                    game.players.find((p) => p.teamId === teamId)?.name ??
                    teamId;
                  return `${label} ${score >= 0 ? "+" : ""}${score}`;
                })
                .join(" • ")}
            </span>
          ) : null}
          {roundResult ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Nya totaler:{" "}
              {Object.entries(roundResult.scoresByTeam)
                .map(([teamId]) => {
                  const label =
                    teamZones.find((zone) => zone.teamId === teamId)?.label ??
                    game.players.find((p) => p.teamId === teamId)?.name ??
                    teamId;
                  const total = getTeamTotalFromTotals(game, totals, teamId);
                  return `${label} ${total >= 0 ? "" : "-"}${Math.abs(total).toLocaleString("sv-SE")}`;
                })
                .join(" • ")}
            </span>
          ) : null}
          {roundLeaderboardPoints ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Leaderboardpoäng: +{roundLeaderboardPoints.points} ({roundLeaderboardPoints.humans} vinnande spelare ×4
              {roundLeaderboardPoints.bots > 0 ? `, ${roundLeaderboardPoints.bots} vinnande bottar ×1` : ""})
            </span>
          ) : null}
          {matchWinnerLabel ? (
            <span style={{ display: "block", marginTop: 6 }}>
              Matchvinnare: {matchWinnerLabel} nådde {targetScore.toLocaleString("sv-SE")} poäng.
            </span>
          ) : null}
          {!matchWinnerTeamId && nextRoundCountdown != null ? (
            <span style={{ display: "block", marginTop: 8 }}>
              Nästa hand startar om {nextRoundCountdown} s.
            </span>
          ) : null}
          {matchWinnerTeamId ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {isHost && (
              <Button onClick={startNextRound} style={{ width: "auto" }}>
                Spela ny rond ändå
              </Button>
              )}
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          position: "relative",
          minHeight: isMobile ? 430 : 520,
          borderRadius: isMobile ? 16 : 24,
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
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: isMobile ? "translate(-110%, -52%)" : "translate(-150%, -52%)",
            width: isMobile ? 48 : 72,
            height: isMobile ? 70 : 98,
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
            transform: isMobile ? "translate(-110%, -56%)" : "translate(-150%, -56%)",
            width: isMobile ? 48 : 72,
            height: isMobile ? 70 : 98,
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
            transform: isMobile ? "translate(-110%, -60%)" : "translate(-150%, -60%)",
            width: isMobile ? 48 : 72,
            height: isMobile ? 70 : 98,
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
            transform: isMobile ? "translate(-110%, 36px)" : "translate(-150%, 52px)",
            fontWeight: 900,
            fontSize: isMobile ? 11 : 12,
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
            transform: isMobile ? "translate(34%, -52%)" : "translate(78%, -52%)",
            width: isMobile ? 56 : 78,
            height: isMobile ? 78 : 106,
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
            transform: isMobile ? "translate(42%, 38px)" : "translate(84%, 56px)",
            textAlign: "center",
            fontWeight: 800,
            fontSize: isMobile ? 11 : 12,
            color: "#dbeafe",
            zIndex: 5,
          }}
        >
          Kasthög: {game.discard.length}
        </div>

        {visibleTeamZones.map((zone) => {
          const seat = seatTemplates[zone.anchorIndex] ?? { top: "50%", left: "50%", angle: 0 };
          const canOpenZone = (zone.melds?.length ?? 0) > 0 || (zone.redThreeCount ?? 0) > 0;
          const leftPct = Number.parseFloat(String(seat.left).replace("%", ""));
          const topPct = Number.parseFloat(String(seat.top).replace("%", ""));
          const isSideSeat = leftPct <= 22 || leftPct >= 78;
          const isBottomSeat = topPct >= 82;
          const sideRotate = isSideSeat ? (leftPct <= 22 ? 90 : -90) : 0;
          const meldOrientation = isSideSeat ? "horizontal" : "horizontal";
          const sideLinearMode = isSideSeat;
          const zoneLeft = isMobile && isSideSeat ? (leftPct <= 22 ? "14%" : "86%") : seat.left;
          const zoneTop = isMobile && isSideSeat ? `${Math.max(20, Math.min(80, topPct))}%` : seat.top;
          return (
            <div
              key={zone.teamId}
              role={canOpenZone ? "button" : undefined}
              tabIndex={canOpenZone ? 0 : undefined}
              onClick={canOpenZone ? () => setExpandedTeamId(zone.teamId) : undefined}
              onKeyDown={
                canOpenZone
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
                left: zoneLeft,
                top: zoneTop,
                transform: `translate(-50%, -50%) rotate(${sideRotate}deg)`,
                width: isMobile
                  ? isBottomSeat
                    ? 210
                    : isSideSeat
                      ? 110
                      : 150
                  : 220,
                minHeight: isMobile
                  ? isBottomSeat
                    ? 96
                    : isSideSeat
                      ? 86
                      : 108
                  : 0,
                maxWidth: isMobile
                  ? isBottomSeat
                    ? "64%"
                    : isSideSeat
                      ? "30%"
                      : "38%"
                  : "42%",
                zIndex: isMobile ? 2 : 6,
                cursor: canOpenZone ? "pointer" : "default",
                pointerEvents: canOpenZone ? "auto" : "none",
              }}
            >
              <TeamMelds
                title={`${zone.label}${zone.opened ? " • öppnat" : ""}`}
                redThreeCount={zone.redThreeCount}
                melds={zone.melds}
                orientation={meldOrientation}
                compact={isMobile}
                showStackLayers={!sideLinearMode}
                noWrap={sideLinearMode}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))", gap: isMobile ? 6 : 8 }}>
        <Button onClick={drawTwo} disabled={game.phase !== "draw" || game.roundEnded || isBotTurn || !isMyTurn}>
          {game.stock.length === 0
            ? (isMobile ? "Avstå kasthög" : "Avstå kasthög (slut)")
            : (isMobile ? "Dra 2" : "Dra 2 kort")}
        </Button>
        <Button
          onClick={takeDiscardStack}
          disabled={game.phase !== "draw" || game.roundEnded || isBotTurn || !isMyTurn || !canTakeDiscardNow}
        >
          {isMobile ? "Ta kasthög" : "Ta hela kasthögen"}
        </Button>
        <Button
          onClick={laySelected}
          disabled={game.phase !== "discard" || selectedIds.length < 1 || game.roundEnded || isBotTurn || !isMyTurn}
        >
          {isMobile ? `Lägg (${selectedIds.length})` : `Lägg markerade (${selectedIds.length})`}
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
        {!isMobile && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 800 }}>Din hand ({myPlayer.name})</div>
            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Klicka för markering • Dra för ordning • Släng via slänghög</div>
          </div>
        )}
        {isMobile ? (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
            <Button
              variant={mobileSortMode ? "primary" : "ghost"}
              onClick={toggleMobileSortMode}
              disabled={!canSortHand}
              style={{ width: "auto", padding: "8px 10px", flexShrink: 0 }}
            >
              {mobileSortMode ? "Automatisk sortering" : "Sortera manuellt"}
            </Button>
          </div>
        ) : null}

        <div
          ref={handAreaRef}
          style={{
            position: "relative",
            height: handAreaHeight,
            touchAction: isMobile ? "none" : "auto",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onPointerMove={(e) => {
            if (!isMobile || !dragCardId || !handReorderEnabled) return;
            const resolved = resolveHandDropTarget(e.clientX);
            setHandDropSide(resolved.side);
            setHoverCardId(resolved.side ? null : resolved.targetId);
          }}
          onDragOver={(e) => {
            if (!handReorderEnabled) return;
            e.preventDefault();
            const resolved = resolveHandDropTarget(e.clientX);
            setHandDropSide(resolved.side);
            setHoverCardId(resolved.side ? null : resolved.targetId);
          }}
          onDragLeave={() => setHandDropSide(null)}
          onDrop={(e) => {
            if (!handReorderEnabled) return;
            e.preventDefault();
            const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
            if (!fromId || orderedHand.length < 2) return;
            const resolved = resolveHandDropTarget(e.clientX);
            const targetId =
              resolved.side === "left"
                ? orderedHand[0]?.id
                : resolved.side === "right"
                ? orderedHand[orderedHand.length - 1]?.id
                : resolved.targetId;
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
            const recentlyDrawn = recentDrawnIds.includes(c.id);
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
                onClick={() => {
                  if (suppressTapRef.current) {
                    suppressTapRef.current = false;
                    return;
                  }
                  toggleSelect(c.id);
                }}
                draggable={handReorderEnabled}
                onPointerDown={(e) => {
                  if (!isMobile || !handReorderEnabled) return;
                  if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  pointerStartRef.current = { x: e.clientX, y: e.clientY };
                  pressedCardIdRef.current = c.id;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  longPressTimerRef.current = setTimeout(() => {
                    suppressTapRef.current = true;
                    setDragCardId(c.id);
                    setHoverCardId(c.id);
                    setHandDropSide(null);
                  }, 180);
                }}
                onPointerMove={(e) => {
                  if (!isMobile || !handReorderEnabled || dragCardId || pressedCardIdRef.current !== c.id) return;
                  const start = pointerStartRef.current;
                  if (!start) return;
                  const dx = e.clientX - start.x;
                  const dy = e.clientY - start.y;
                  if (Math.hypot(dx, dy) < 14) return;
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  suppressTapRef.current = true;
                  setDragCardId(c.id);
                  setHoverCardId(c.id);
                  setHandDropSide(null);
                }}
                onPointerLeave={() => {
                  if (longPressTimerRef.current && !dragCardId) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onPointerUp={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  pointerStartRef.current = null;
                  pressedCardIdRef.current = null;
                }}
                onPointerCancel={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                  pointerStartRef.current = null;
                  pressedCardIdRef.current = null;
                }}
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
                  suppressTapRef.current = false;
                }}
                onDragOver={(e) => {
                  if (!handReorderEnabled) return;
                  e.preventDefault();
                  if (handDropSide) setHandDropSide(null);
                  if (hoverCardId !== c.id) setHoverCardId(c.id);
                }}
                onDrop={(e) => {
                  if (!handReorderEnabled) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const fromId = e.dataTransfer.getData("text/plain") || dragCardId;
                  moveHandCard(fromId, c.id);
                }}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${offset + spreadAdjust}px)`,
                  bottom: (isMobile ? 4 : 6) + (selected ? (isMobile ? 10 : 14) : 0) + (isHoverTarget ? 4 : 0),
                  transform: `translateX(-50%) rotate(${rot}deg)`,
                  width: handCardWidth,
                  height: handCardHeight,
                  borderRadius: 11,
                  border: isMobile && dragCardId === c.id
                    ? "2px solid #22d3ee"
                    : isHoverTarget
                    ? "2px solid #22d3ee"
                    : selected
                      ? "2px solid #67e8f9"
                      : "1px solid rgba(15,23,42,.3)",
                  background: recentlyDrawn ? "#efe8d4" : "#fffdf8",
                  color: "#0f172a",
                  fontWeight: 900,
                  fontSize: 13,
                  zIndex: 120 + i,
                  cursor: handReorderEnabled ? "grab" : "pointer",
                  opacity: canSortHand ? 1 : 0.72,
                  boxShadow: selected
                    ? "0 0 0 1px rgba(103,232,249,.45), 0 12px 20px rgba(2,6,23,.42), inset 0 1px 0 rgba(255,255,255,.8)"
                    : recentlyDrawn
                    ? "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.5), inset 0 0 0 999px rgba(15,23,42,.06)"
                    : "0 9px 16px rgba(2,6,23,.34), inset 0 1px 0 rgba(255,255,255,.78)",
                  padding: 3,
                  transition: "left .14s ease, bottom .14s ease, transform .14s ease, border-color .12s ease, background .16s ease, box-shadow .16s ease",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                <CanastaFace card={c} />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {(game.mode === "team"
          ? teamZones.map((zone) => ({
              key: zone.teamId,
              label: zone.label,
              total: teamTotals[zone.teamId] ?? 0,
              opening: openingRequirement(teamTotals[zone.teamId] ?? 0),
            }))
          : game.players.map((player, index) => ({
              key: player.id,
              label: player.name,
              total: Number(totals[index] || 0),
              opening: openingByPlayer[index],
            }))).map((entry) => (
          <div
            key={`${entry.key}-score`}
            style={{
              display: "grid",
              gap: 4,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,.25)",
              background: "rgba(15,23,42,.45)",
              padding: "10px 12px",
            }}
          >
            <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>{entry.label} totalpoäng</div>
            <div style={{ color: "#f8fafc", fontSize: 22, fontWeight: 900 }}>
              {Number(entry.total || 0).toLocaleString("sv-SE")}
            </div>
            <div style={{ color: "#fde68a", fontWeight: 700, fontSize: 11 }}>
              Öppning: {entry.opening === "canasta" ? "Canasta" : entry.opening}
            </div>
          </div>
        ))}
      </div>

      <div style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>
        Kasthögen tas nu i sin helhet, frusen hög hanteras separat och rondpoäng räknas automatiskt.
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
                  <div style={{ fontWeight: 800 }}>1) Välj joker/tvåa</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {wildForPlan.map((c) => {
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
                            → {Number.isFinite(Number(assignedRank)) ? rankLabel(assignedRank) : "?"}
                          </div>
                        </button>
                      );
                    })}
                    {wildForPlan.length === 0 ? (
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                        Inga joker/tvåor i denna läggning.
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.28)" }}>
                  <div style={{ fontWeight: 800 }}>2) Välj vad joker/tvåa ska räknas som</div>
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
                  <div>
                    <div style={{ fontWeight: 800 }}>Vibrera när turen byter</div>
                    <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                      Samma typ av turnotifiering som i 12:an.
                    </div>
                  </div>
                  <Button
                    variant={vibrateOnTurn ? "primary" : "ghost"}
                    onClick={() => setVibrateOnTurn((v) => !v)}
                    style={{ width: "auto" }}
                  >
                    {vibrateOnTurn ? "På" : "Av"}
                  </Button>
                </div>
              </div>
              <div style={settingsSectionStyle}>
                <div style={settingsSectionTitleStyle}>Lobby</div>
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,.18)",
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Rumskod</div>
                      <div style={{ fontWeight: 900, fontSize: 20, marginTop: 2 }}>
                        {roomCode ? roomCode.toUpperCase() : "Inte kopplad"}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,.18)",
                        background: "rgba(255,255,255,.03)",
                      }}
                    >
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Bord</div>
                      <div style={{ fontWeight: 900, fontSize: 20, marginTop: 2 }}>{lobbyPlayers.length}/4 spelare</div>
                    </div>
                  </div>
                  <div style={settingsInlineRowStyle}>
                    <div>
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Värd</div>
                      <div style={{ fontWeight: 800 }}>{hostName || lobbyPlayers[0]?.name || "Inte satt"}</div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => onShareRoom?.()}
                      disabled={!roomCode || typeof onShareRoom !== "function"}
                      style={{ width: "auto" }}
                    >
                      Dela
                    </Button>
                  </div>
                  <div style={settingsInlineRowStyle}>
                    <div>
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Spelläge</div>
                      <div style={{ fontWeight: 800 }}>{mode === "team" ? "Lag 2v2" : "Singel"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>Matchmål</div>
                      <div style={{ fontWeight: 800 }}>{targetScore.toLocaleString("sv-SE")} poäng</div>
                    </div>
                  </div>
                  <div style={{ color: "var(--muted)", fontWeight: 700, fontSize: 12 }}>
                    Max 4 spelare totalt. Har du ett rum kopplat kan du bjuda in vänner här eller låta andra joina via koden.
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {friends.length === 0 ? (
                      <div style={{ color: "var(--muted)" }}>Inga vänner att bjuda in just nu.</div>
                    ) : (
                      friends.map((friend) => {
                        const sent = Boolean(sentInvites?.[friend.id]);
                        return (
                          <div
                            key={friend.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              alignItems: "center",
                              gap: 10,
                              padding: 8,
                              borderRadius: 10,
                              border: "1px solid rgba(148,163,184,.2)",
                              background: "rgba(15,23,42,.28)",
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>{friend.display_name}</div>
                            <Button
                              variant={sent ? "primary" : "ghost"}
                              onClick={() => onSendRoomInvite?.(friend.id)}
                              disabled={!roomCode || sent || typeof onSendRoomInvite !== "function"}
                              style={{ width: "auto", padding: "6px 10px" }}
                            >
                              {sent ? "Skickat" : "Bjud in"}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
              {canCustomizeTheme && (
                <div style={settingsSectionStyle}>
                  <div style={settingsSectionTitleStyle}>Tema</div>
                  {typeof applyTheme === "function" && themes.length > 0 && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <Button
                          variant={themeCategory === "standard" ? "primary" : "ghost"}
                          onClick={() => setThemeCategory("standard")}
                          style={{ padding: "8px 12px" }}
                        >
                          Standard ({standardThemes.length})
                        </Button>
                        <Button
                          variant={themeCategory === "special" ? "primary" : "ghost"}
                          onClick={() => setThemeCategory("special")}
                          style={{ padding: "8px 12px" }}
                        >
                          Specials ({specialThemes.length})
                        </Button>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
                        {visibleThemes.map((t) => {
                        const key = t.key ?? t.name;
                        const selected = externalSettings?.themeKey === key;
                        return (
                            <Button
                              key={key}
                              variant={selected ? "primary" : "ghost"}
                              onClick={() => applyTheme(t)}
                              style={{ display: "grid", gap: 8, justifyItems: "center" }}
                            >
                              <div
                                style={{
                                  width: "100%",
                                  height: 46,
                                  borderRadius: 10,
                                  border: "1px solid rgba(148,163,184,.25)",
                                  backgroundImage: [
                                    `radial-gradient(120px 60px at 15% 20%, color-mix(in srgb, ${t.bgGlow1} 28%, transparent), transparent 70%)`,
                                    `radial-gradient(120px 60px at 85% 10%, color-mix(in srgb, ${t.bgGlow2} 24%, transparent), transparent 70%)`,
                                    `linear-gradient(180deg, #0a0f1b, ${t.bgColor})`,
                                  ].join(", "),
                                }}
                              />
                              <div style={{ fontWeight: 800, fontSize: 12 }}>{t.name}</div>
                            </Button>
                          );
                        })}
                      </div>
                    </>
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

export const __CANASTA_TESTING__ = {
  makeGame,
  drawTwoState,
  canTakeDiscard,
  takeDiscardStackState,
  pickBotMeldCardIds,
  discardState,
  applyMeld,
  applyMeldMany,
  computeRoundResults,
  updateTotalsAfterRound,
};
