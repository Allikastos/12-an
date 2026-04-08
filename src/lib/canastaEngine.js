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

export function buildDeck() {
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

export function rankLabel(rank) {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 0) return "Joker";
  return String(rank);
}

function handSortWeight(card) {
  if (card.joker) return 14;
  if (card.rank === 1) return 12;
  if (card.rank === 2) return 13;
  if (card.rank === 13) return 11;
  return Number(card.rank || 0);
}

function suitSortWeight(card) {
  if (card.joker) return 0;
  if (card.suit === "spades") return 0;
  if (card.suit === "hearts") return 1;
  if (card.suit === "diamonds") return 2;
  if (card.suit === "clubs") return 3;
  return 4;
}

export function sortHandCards(cards) {
  return [...(cards ?? [])].sort((a, b) => {
    const rankDiff = handSortWeight(a) - handSortWeight(b);
    if (rankDiff !== 0) return rankDiff;
    const suitDiff = suitSortWeight(a) - suitSortWeight(b);
    if (suitDiff !== 0) return suitDiff;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function cardLabel(card) {
  if (!card) return "—";
  if (card.joker) return "Joker ★";
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function isRedThree(card) {
  return !card.joker && card.rank === 3 && (card.suit === "hearts" || card.suit === "diamonds");
}

export function isBlackThree(card) {
  return !card.joker && card.rank === 3 && (card.suit === "spades" || card.suit === "clubs");
}

export function isWild(card) {
  return card.joker || card.rank === 2;
}

export function cardPoints(card) {
  if (card.joker) return 50;
  if (card.rank === 2) return 25;
  if (card.rank === 1) return 25;
  if (card.rank >= 8 && card.rank <= 13) return 10;
  if (card.rank >= 4 && card.rank <= 7) return 5;
  if (card.rank === 3 && (card.suit === "spades" || card.suit === "clubs")) return -100;
  return 0;
}

export function openingRequirement(total) {
  if (total < 1500) return 60;
  if (total < 3000) return 90;
  if (total < 5000) return 120;
  return "canasta";
}

export function getTeamTotalFromTotals(state, totals, teamId) {
  if (!state?.players?.length || !teamId) return 0;
  return state.players.reduce((best, player, index) => {
    if (player.teamId !== teamId) return best;
    return Math.max(best, Number(totals?.[index] || 0));
  }, 0);
}

export function getPlayerOpeningTotal(state, totals, playerIndex) {
  if (!state?.players?.length) return 0;
  if (state.mode === "single") return Number(totals?.[playerIndex] || 0);
  const teamId = state.players[playerIndex]?.teamId;
  return getTeamTotalFromTotals(state, totals, teamId);
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
  return meldPoints + meldBonuses + redThreeBonus(redThreeCount, hasQualifiedMeld) + (wentOut ? 100 : 0) - handPenalty;
}

export function computeRoundResults(state) {
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

export function updateTotalsAfterRound(state, totals) {
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

export function getMatchWinnerTeamId(state, totals, targetScore) {
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

export function makeGame({ names, mode, playersConfig = null }) {
  const stock = buildDeck();
  const resolvedPlayers =
    Array.isArray(playersConfig) && playersConfig.length > 0
      ? playersConfig
      : names.map((name, idx) => ({ name, isBot: mode === "single" && idx > 0 }));
  const teamCount = mode === "team" ? 2 : 0;
  const players = resolvedPlayers.map((playerCfg, idx) => ({
    id: `p${idx + 1}`,
    name: playerCfg?.name?.trim() || (playerCfg?.isBot ? `Bot ${idx}` : `Spelare ${idx + 1}`),
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

export function drawTwoState(state) {
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

function getDiscardPickupSelection(state) {
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
  const pickupIds = getDiscardPickupSelection(state);
  if (!pickupIds?.length) return null;

  const taken = [...state.discard];
  const liftedState = {
    ...state,
    discard: [],
    discardFrozen: false,
    players: state.players.map((player, index) =>
      index === state.turnIndex
        ? { ...player, hand: [...player.hand, ...taken], redThrees: [...player.redThrees] }
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
    naturalsByRank.set(rank, [...cards].sort((a, b) => cardPoints(b) - cardPoints(a)));
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
    if (!bestPlan || cardCount < bestPlan.cardCount) {
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
      search(rankIndex + 1, availableWilds.slice(option.wildCount), [...groups, [...option.naturalIds, ...assignedWilds]]);
    }
  }

  search(0, wildPool, []);
  if (!bestPlan) return null;
  return { liftedState, groups: bestPlan.groups, selectedIds: bestPlan.selectedIds };
}

export function canTakeDiscard(state, totals = []) {
  const plan = buildDiscardPickupPlan(state, totals);
  if (!plan) return false;
  const preview = applyMeldGroups(plan.liftedState, plan.groups, plan.selectedIds, totals);
  return !preview.error;
}

export function takeDiscardStackState(state, totals = []) {
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

export function pickBotMeldCardIds(state) {
  const player = state.players[state.turnIndex];
  const team = state.teams[player.teamId];
  if (!player || !team) return null;
  const hand = player.hand;

  for (const meld of team.melds) {
    const candidate = hand.find((c) => (meld.rank === 0 ? c.joker : isWild(c) || c.rank === meld.rank));
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

export function pickDiscardCardId(player) {
  const candidates = player.hand.filter((c) => !isRedThree(c));
  if (!candidates.length) return null;
  candidates.sort((a, b) => cardPoints(a) - cardPoints(b));
  return candidates[0].id;
}

export function discardState(state, cardId) {
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

export function applyMeld(state, cardIds, totals) {
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
    if (existingIndex < 0 && naturals.length < 2) return { state, error: "Ny meld kräver minst 2 naturliga kort." };
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

  if (existingIndex < 0 && selectedCards.length < 3) return { state, error: "Ny meld kräver minst 3 kort." };

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
    if (req === "canasta" && !makesCanasta) return { state, error: "Öppningskravet är canasta för laget just nu." };
    if (req !== "canasta" && selectionPoints < req) return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
    nextTeams[teamId].opened = true;
  }

  const hand = player.hand.filter((c) => !cardIds.includes(c.id));
  const nextPlayers = state.players.map((p, i) =>
    i === state.turnIndex ? { ...p, hand, redThrees: [...p.redThrees] } : { ...p, hand: [...p.hand], redThrees: [...p.redThrees] }
  );

  if (hand.length === 0) {
    if (teamCanastaCount(nextTeams[teamId]) < 2) return { state, error: "Ni måste ha minst 2 canastor för att få gå ut." };
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

export function applyMeldMany(state, cardIds, totals) {
  if (!state || !cardIds?.length) return { state, error: "Välj minst 1 kort." };
  const player = state.players[state.turnIndex];
  const selectedCards = player.hand.filter((c) => cardIds.includes(c.id));
  if (selectedCards.length < 1) return { state, error: "Välj minst 1 kort." };
  if (selectedCards.some((c) => c.rank === 3 && !c.joker)) return { state, error: "Treor kan inte meldas här." };

  const naturals = selectedCards.filter((c) => !isWild(c));
  const wilds = selectedCards.filter((c) => isWild(c));
  const ranks = [...new Set(naturals.map((c) => c.rank))];
  if (ranks.length <= 1) return applyMeld(state, cardIds, totals);

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
      return { state, error: "Välj en tydlig huvudvalör för jokrar/tvåor vid multi-läggning (eller lägg utan trumpf)." };
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
    if (req === "canasta" && !makesCanasta) return { state, error: "Öppningskravet är canasta för laget just nu." };
    if (req !== "canasta" && selectionPoints < req) return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
  }

  let next = state;
  if (!team.opened) {
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
  if (naturalRanks.length > 0) return naturalRanks;

  return [...new Set((team?.melds ?? []).map((m) => m.rank).filter((r) => r !== 0))].sort((a, b) => a - b);
}

export function shouldUseMeldPlanner(state, cardIds) {
  if (!state || !cardIds?.length) return false;
  const player = state.players[state.turnIndex];
  if (!player) return false;
  const selected = player.hand.filter((c) => cardIds.includes(c.id));
  const targetRanks = getMeldPlanTargetRanks(state, selected);
  return targetRanks.length > 1;
}

export function createMeldPlan(state, cardIds) {
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

export function resolvePlannedGroups(state, plan) {
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

export function applyMeldGroups(state, groupIdsList, selectedIds, totals) {
  if (!state || !groupIdsList?.length) return { state, error: "Ingen gruppering vald." };
  const player = state.players[state.turnIndex];
  const teamId = player.teamId;
  const team = state.teams[teamId];
  const selectedCards = player.hand.filter((c) => selectedIds.includes(c.id));
  if (selectedCards.some((c) => c.rank === 3 && !c.joker)) return { state, error: "Treor kan inte meldas här." };

  const teamTotal = getPlayerOpeningTotal(state, totals, state.turnIndex);
  const req = openingRequirement(teamTotal);
  const selectionPoints = selectedCards.reduce((acc, c) => acc + Math.max(0, cardPoints(c)), 0);

  if (!team.opened) {
    if (req !== "canasta" && selectionPoints < req) return { state, error: `Öppning kräver ${req} poäng i samma läggning.` };
    if (req === "canasta") {
      let probe = { ...state, teams: { ...state.teams, [teamId]: { ...state.teams[teamId], opened: true } } };
      for (const ids of groupIdsList) {
        const step = applyMeld(probe, ids, totals);
        if (step.error) return step;
        probe = step.state;
      }
      const oldCanastas = teamCanastaCount(state.teams[teamId]);
      const newCanastas = teamCanastaCount(probe.teams[teamId]);
      if (newCanastas <= oldCanastas) return { state, error: "Öppningskravet är canasta för laget just nu." };
    }
  }

  let next = state;
  if (!team.opened) {
    next = { ...state, teams: { ...state.teams, [teamId]: { ...state.teams[teamId], opened: true } } };
  }
  for (const ids of groupIdsList) {
    const step = applyMeld(next, ids, totals);
    if (step.error) return step;
    next = step.state;
  }
  return { state: next, error: null };
}
