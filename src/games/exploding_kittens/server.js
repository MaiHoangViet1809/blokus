import {
  buildEkRoomConfig,
  canFormCatPair,
  cardLabel,
  EK_BASE_SUPPLY,
  EK_CARD_META,
  EK_CAT_CARDS,
  EK_EXPANSION_SUPPLY,
  EXPLODING_KITTENS_GAME_TYPE,
  hasFeralCat,
  pairableGroups,
  playerLabel,
  resolveEkRuleset
} from "./shared.js";

export { EXPLODING_KITTENS_GAME_TYPE };

const MATCH_ACTIVE = "active";
const MATCH_FINISHED = "finished";
const MATCH_STARTING = "starting";

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function shuffle(input) {
  const items = [...input];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function repeat(cardId, count) {
  return Array.from({ length: count }, () => cardId);
}

function buildDeckSupply(ruleset) {
  const supply = { ...EK_BASE_SUPPLY };
  const expansion = EK_EXPANSION_SUPPLY[ruleset.ruleset];
  if (expansion) {
    for (const [cardId, count] of Object.entries(expansion)) {
      supply[cardId] = (supply[cardId] || 0) + count;
    }
  }
  return supply;
}

function takeCards(deck, cardId, count) {
  let remaining = count;
  const nextDeck = [];
  for (const entry of deck) {
    if (remaining > 0 && entry === cardId) {
      remaining -= 1;
    } else {
      nextDeck.push(entry);
    }
  }
  return nextDeck;
}

function buildInitialDeck(ruleset, playerCount) {
  const supply = buildDeckSupply(ruleset);
  let stash = [];
  if (ruleset.ruleset === "barking" && supply.tower_of_power) {
    supply.tower_of_power -= 1;
  }
  let deck = Object.entries(supply).flatMap(([cardId, count]) => repeat(cardId, count));
  deck = shuffle(deck);
  if (ruleset.ruleset === "barking") {
    stash = deck.splice(0, Math.min(6, deck.length));
    deck.push("tower_of_power");
    deck = shuffle(deck);
  }
  return {
    stash,
    actionDeck: takeCards(takeCards(deck, "defuse", playerCount), "exploding_kitten", playerCount - 1)
  };
}

function createInitialState(roomConfig) {
  return {
    ruleset: roomConfig.ruleset,
    modeLabel: roomConfig.modeLabel,
    drawPile: [],
    discardPile: [],
    turnIndex: 0,
    turnDirection: 1,
    pendingDraws: 1,
    reaction: null,
    prompt: null,
    sharedStash: [],
    zones: {},
    lastActionText: "Match ready.",
    implodingFaceUpIndex: null
  };
}

function parseState(boardJson, roomConfig) {
  const fallback = createInitialState(roomConfig);
  const parsed = parseJson(boardJson, fallback);
  return {
    ...fallback,
    ...parsed,
    drawPile: Array.isArray(parsed?.drawPile) ? [...parsed.drawPile] : [],
    discardPile: Array.isArray(parsed?.discardPile) ? [...parsed.discardPile] : [],
    turnIndex: Number.isInteger(parsed?.turnIndex) ? parsed.turnIndex : 0,
    pendingDraws: Number.isInteger(parsed?.pendingDraws) ? parsed.pendingDraws : 1,
    turnDirection: parsed?.turnDirection === -1 ? -1 : 1,
    reaction: parsed?.reaction || null,
    prompt: parsed?.prompt || null,
    sharedStash: Array.isArray(parsed?.sharedStash) ? [...parsed.sharedStash] : [],
    zones: parsed?.zones && typeof parsed.zones === "object" ? parsed.zones : {},
    implodingFaceUpIndex: Number.isInteger(parsed?.implodingFaceUpIndex) ? parsed.implodingFaceUpIndex : null
  };
}

function zoneFor(state, profileId) {
  if (!state.zones[profileId]) {
    state.zones[profileId] = {
      stash: [],
      armedBarking: 0,
      extraTurns: 0,
      pendingTakeThatFrom: null
    };
  }
  return state.zones[profileId];
}

function activePlayers(players) {
  return players.filter((player) => player.end_state === "active");
}

function activePlayerIndexes(players) {
  return players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => player.end_state === "active");
}

function nextActiveIndex(players, startIndex, direction = 1) {
  const active = activePlayerIndexes(players);
  if (!active.length) return 0;
  for (let step = 1; step <= players.length; step += 1) {
    const candidate = (startIndex + (step * direction) + players.length) % players.length;
    if (players[candidate]?.end_state === "active") return candidate;
  }
  return active[0].index;
}

function playerByProfile(players, profileId) {
  return players.find((player) => player.profile_id === profileId) || null;
}

function playerIndexByProfile(players, profileId) {
  return players.findIndex((player) => player.profile_id === profileId);
}

function clonePlayers(players) {
  return players.map((player) => ({
    ...player,
    remainingPieces: Array.isArray(player.remainingPieces) ? [...player.remainingPieces] : []
  }));
}

function appendDiscard(state, ...cards) {
  state.discardPile.push(...cards.filter(Boolean));
}

function removeCardFromHand(hand, cardId, count = 1) {
  let remaining = count;
  const removed = [];
  const nextHand = [];
  for (const entry of hand) {
    if (remaining > 0 && entry === cardId) {
      removed.push(entry);
      remaining -= 1;
    } else {
      nextHand.push(entry);
    }
  }
  return {
    hand: nextHand,
    removed,
    removedCount: removed.length
  };
}

function removeCardsForPair(hand, cardId) {
  if (hand.filter((entry) => entry === cardId).length >= 2) {
    return removeCardFromHand(hand, cardId, 2);
  }
  if (EK_CAT_CARDS.includes(cardId) && hand.includes(cardId) && hasFeralCat(hand)) {
    const firstPass = removeCardFromHand(hand, cardId, 1);
    const secondPass = removeCardFromHand(firstPass.hand, "feral_cat", 1);
    return {
      hand: secondPass.hand,
      removed: [...firstPass.removed, ...secondPass.removed],
      removedCount: firstPass.removedCount + secondPass.removedCount
    };
  }
  return {
    hand,
    removed: [],
    removedCount: 0
  };
}

function drawCard(state, fromBottom = false) {
  if (!state.drawPile.length) return null;
  if (fromBottom) {
    const drawIndex = state.drawPile.length - 1;
    const wasFaceUp = state.implodingFaceUpIndex === drawIndex;
    const cardId = state.drawPile.pop();
    if (wasFaceUp) {
      state.implodingFaceUpIndex = null;
    }
    return { cardId, wasFaceUp };
  }

  const wasFaceUp = state.implodingFaceUpIndex === 0;
  const cardId = state.drawPile.shift();
  if (state.implodingFaceUpIndex !== null) {
    state.implodingFaceUpIndex = wasFaceUp ? null : Math.max(0, state.implodingFaceUpIndex - 1);
  }
  return { cardId, wasFaceUp };
}

function insertIntoDrawPile(state, cardId, position) {
  const normalized = Math.max(0, Math.min(position, state.drawPile.length));
  state.drawPile.splice(normalized, 0, cardId);
  if (state.implodingFaceUpIndex !== null && normalized <= state.implodingFaceUpIndex) {
    state.implodingFaceUpIndex += 1;
  }
}

function publicPrompt(prompt, viewerProfileId) {
  if (!prompt) return null;
  if (prompt.profileId && prompt.profileId !== viewerProfileId) {
    return {
      type: "waiting",
      label: prompt.waitingLabel || "Waiting on another player."
    };
  }
  return prompt;
}

function buildReplayLabel(eventType, payload = {}) {
  switch (eventType) {
    case "match_started":
      return `Match started (${payload.ruleset || "base"})`;
    case "card_played":
      return `${payload.playerName || "Player"} played ${cardLabel(payload.cardId)}`;
    case "pair_played":
      return `${payload.playerName || "Player"} played a pair of ${cardLabel(payload.cardId)}`;
    case "reaction_nope":
      return `${payload.playerName || "Player"} played Nope`;
    case "draw_card":
      return `${payload.playerName || "Player"} drew a card`;
    case "defuse_reinserted":
      return `${payload.playerName || "Player"} reinserted a kitten`;
    case "imploding_reinserted":
      return `${payload.playerName || "Player"} reinserted the Imploding Kitten`;
    case "favor_resolved":
      return `${payload.playerName || "Player"} resolved Favor`;
    case "future_altered":
      return `${payload.playerName || "Player"} altered the future`;
    case "card_buried":
      return `${payload.playerName || "Player"} buried ${cardLabel(payload.cardId)}`;
    case "potluck_resolved":
      return `${payload.playerName || "Player"} resolved Potluck`;
    case "barking_resolved":
      return `${payload.playerName || "Player"} resolved a Barking Kitten`;
    case "player_eliminated":
      return `${payload.playerName || "Player"} exploded`;
    case "match_finished":
      return payload.winnerName ? `${payload.winnerName} won` : "Match finished";
    default:
      return eventType;
  }
}

function buildPromptAction(type, label, commandPayload = {}) {
  return { type, label, commandPayload };
}

function passTurn(state, players, pendingDraws = 1) {
  const currentPlayer = players[state.turnIndex];
  if (currentPlayer) {
    const currentZone = zoneFor(state, currentPlayer.profile_id);
    if (currentPlayer.end_state === "active" && currentZone.extraTurns > 0) {
      currentZone.extraTurns -= 1;
      state.pendingDraws = pendingDraws;
      return;
    }
  }
  state.turnIndex = nextActiveIndex(players, state.turnIndex, state.turnDirection);
  state.pendingDraws = pendingDraws;
}

function eliminatePlayer(state, players, player, causeCardId) {
  player.end_state = "eliminated";
  appendDiscard(state, ...player.remainingPieces);
  player.remainingPieces = [];
  state.lastActionText = `${playerLabel(player)} exploded.`;
  return causeCardId;
}

function maybeFinish(state, players) {
  const alive = activePlayers(players);
  if (alive.length <= 1) {
    return alive[0]?.profile_id || null;
  }
  return null;
}

function topPreview(drawPile, count) {
  return drawPile.slice(0, count);
}

function promptDismiss(profileId, label, extra = {}) {
  return {
    type: "info",
    profileId,
    label,
    actions: [buildPromptAction("dismiss_prompt", "Continue")],
    ...extra
  };
}

function permutationChoices(cards) {
  const results = [];
  function permute(prefix, remaining) {
    if (!remaining.length) {
      results.push(prefix);
      return;
    }
    remaining.forEach((entry, index) => {
      const nextRemaining = remaining.filter((_, candidateIndex) => candidateIndex !== index);
      permute([...prefix, entry], nextRemaining);
    });
  }
  permute([], cards);
  return results;
}

function buildReactionOrder(players, startProfileId) {
  const startIndex = Math.max(0, playerIndexByProfile(players, startProfileId));
  const responderIndexes = [];
  for (let step = 1; step <= players.length; step += 1) {
    const index = (startIndex + step) % players.length;
    if (players[index]?.end_state === "active") responderIndexes.push(index);
  }
  return responderIndexes.map((index) => players[index].profile_id);
}

function queueReaction(state, players, actorProfileId, effect) {
  state.reaction = {
    effect,
    actorProfileId,
    nopesPlayed: 0,
    responders: buildReactionOrder(players, actorProfileId),
    responderIndex: 0
  };
}

function currentResponder(state) {
  if (!state.reaction) return null;
  return state.reaction.responders[state.reaction.responderIndex] || null;
}

function advanceReaction(state, players) {
  if (!state.reaction) return;
  state.reaction.responderIndex += 1;
  while (state.reaction.responderIndex < state.reaction.responders.length) {
    const candidate = state.reaction.responders[state.reaction.responderIndex];
    const player = playerByProfile(players, candidate);
    if (player && player.end_state === "active") return;
    state.reaction.responderIndex += 1;
  }
}

function buildPublicPlayer(player) {
  return {
    profileId: player.profile_id,
    name: player.name,
    seatIndex: player.seat_index,
    handCount: Array.isArray(player.remainingPieces) ? player.remainingPieces.length : 0,
    disconnected: !!player.disconnected,
    endState: player.end_state
  };
}

function stealableCards(state, player) {
  const zone = zoneFor(state, player.profile_id);
  if (zone.stash.length) return zone.stash;
  return player.remainingPieces;
}

function buildAvailableActions(state, players, viewerProfileId) {
  const viewer = playerByProfile(players, viewerProfileId);
  if (!viewer || viewer.end_state !== "active") return [];

  if (state.prompt?.profileId === viewerProfileId) {
    return (state.prompt.actions || []).map((action) => ({
      ...action,
      label: action.label
    }));
  }

  if (state.reaction) {
    if (currentResponder(state) !== viewerProfileId) return [];
    const actions = [buildPromptAction("pass_reaction", "Pass")];
    if (viewer.remainingPieces.includes("nope")) {
      actions.unshift(buildPromptAction("reaction_nope", "Play Nope"));
    }
    return actions;
  }

  const isCurrentTurn = players[state.turnIndex]?.profile_id === viewerProfileId;
  if (!isCurrentTurn) {
    const actions = [];
    if (viewer.remainingPieces.includes("alter_the_future_now")) {
      actions.push(buildPromptAction("play_card", "Alter The Future NOW", { cardId: "alter_the_future_now" }));
    }
    return actions;
  }

  const actions = [buildPromptAction("draw_card", state.pendingDraws > 1 ? `Draw (${state.pendingDraws} turns left)` : "Draw to End Turn")];
  const hand = viewer.remainingPieces;
  const targetablePlayers = activePlayers(players)
    .filter((player) => player.profile_id !== viewerProfileId)
    .map((player) => ({ profileId: player.profile_id, name: player.name }));

  if (hand.includes("skip")) {
    actions.push(buildPromptAction("play_card", "Play Skip", { cardId: "skip" }));
  }
  if (hand.includes("attack")) {
    actions.push(buildPromptAction("play_card", "Play Attack", { cardId: "attack" }));
  }
  if (hand.includes("shuffle")) {
    actions.push(buildPromptAction("play_card", "Play Shuffle", { cardId: "shuffle" }));
  }
  if (hand.includes("see_the_future")) {
    actions.push(buildPromptAction("play_card", "See The Future", { cardId: "see_the_future" }));
  }
  if (hand.includes("reverse")) {
    actions.push(buildPromptAction("play_card", "Play Reverse", { cardId: "reverse" }));
  }
  if (hand.includes("draw_from_bottom")) {
    actions.push(buildPromptAction("play_card", "Draw From Bottom", { cardId: "draw_from_bottom" }));
  }
  if (hand.includes("alter_the_future")) {
    actions.push(buildPromptAction("play_card", "Alter The Future", { cardId: "alter_the_future" }));
  }
  if (hand.includes("swap_top_bottom")) {
    actions.push(buildPromptAction("play_card", "Swap Top & Bottom", { cardId: "swap_top_bottom" }));
  }
  if (hand.includes("bury")) {
    actions.push(buildPromptAction("play_card", "Bury", { cardId: "bury" }));
  }
  if (hand.includes("tower_of_power")) {
    actions.push(buildPromptAction("play_card", "Play Tower of Power", { cardId: "tower_of_power" }));
  }
  if (hand.includes("personal_attack")) {
    actions.push(buildPromptAction("play_card", "Play Personal Attack", { cardId: "personal_attack" }));
  }
  if (hand.includes("share_the_future")) {
    actions.push(buildPromptAction("play_card", "Share The Future", { cardId: "share_the_future" }));
  }
  if (hand.includes("ill_take_that")) {
    targetablePlayers.forEach((target) => {
      actions.push(buildPromptAction("play_card", `I'll Take That → ${target.name}`, {
        cardId: "ill_take_that",
        targetProfileId: target.profileId
      }));
    });
  }
  if (hand.includes("super_skip")) {
    actions.push(buildPromptAction("play_card", "Play Super Skip", { cardId: "super_skip" }));
  }
  if (hand.includes("potluck")) {
    actions.push(buildPromptAction("play_card", "Play Potluck", { cardId: "potluck" }));
  }
  if (hand.filter((entry) => entry === "barking_kitten").length >= 2) {
    targetablePlayers.forEach((target) => {
      actions.push(buildPromptAction("play_barking_pair", `Barking Kittens vs ${target.name}`, {
        targetProfileId: target.profileId
      }));
    });
  }
  if (hand.includes("barking_kitten")) {
    actions.push(buildPromptAction("play_card", "Play Barking Kitten", { cardId: "barking_kitten" }));
  }

  if (hand.includes("favor")) {
    targetablePlayers.forEach((target) => {
      actions.push(buildPromptAction("play_card", `Favor ${target.name}`, {
        cardId: "favor",
        targetProfileId: target.profileId
      }));
    });
  }

  const pairCandidates = new Set([...pairableGroups(hand), ...EK_CAT_CARDS.filter((cardId) => canFormCatPair(hand, cardId))]);
  for (const cardId of pairCandidates) {
    targetablePlayers.forEach((target) => {
      actions.push(buildPromptAction("play_pair", `Pair ${cardLabel(cardId)} vs ${target.name}`, {
        cardId,
        targetProfileId: target.profileId
      }));
    });
  }

  return actions;
}

function buildStateForReplay(state, players) {
  return {
    turnIndex: state.turnIndex,
    pendingDraws: state.pendingDraws,
    drawPileCount: state.drawPile.length,
    discardPile: [...state.discardPile],
    players: players.map(buildPublicPlayer),
    prompt: state.prompt ? { type: state.prompt.type, label: state.prompt.label } : null
  };
}

function pushEvent(events, state, players, profileId, eventType, payload = {}) {
  events.push({
    profileId,
    eventType,
    payload: {
      ...payload,
      publicState: buildStateForReplay(state, players)
    }
  });
}

function applyFavorPrompt(state, players, actorProfileId, targetProfileId) {
  const target = playerByProfile(players, targetProfileId);
  if (!target || target.end_state !== "active") {
    state.lastActionText = "Favor fizzled because the target is no longer active.";
    return;
  }
  if (!target.remainingPieces.length) {
    state.lastActionText = `${playerLabel(target)} had no cards to give.`;
    return;
  }
  state.prompt = {
    type: "favor_give",
    profileId: targetProfileId,
    actorProfileId,
    targetProfileId,
    label: `Choose one card to give ${playerByProfile(players, actorProfileId)?.name || "the attacker"}.`,
    waitingLabel: `${playerLabel(target)} is choosing a card for Favor.`,
    actions: target.remainingPieces.map((cardId, index) => buildPromptAction("resolve_prompt", `Give ${cardLabel(cardId)}`, {
      promptType: "favor_give",
      targetProfileId,
      actorProfileId,
      cardIndex: index
    }))
  };
}

function applySeeFuturePrompt(state, actorProfileId) {
  const cards = topPreview(state.drawPile, 3);
  state.prompt = promptDismiss(actorProfileId, cards.length
    ? `Top cards: ${cards.map(cardLabel).join(" · ")}`
    : "The draw pile is empty.");
}

function applyAlterFuturePrompt(state, actorProfileId) {
  const cards = topPreview(state.drawPile, 3);
  if (cards.length <= 1) {
    state.prompt = promptDismiss(actorProfileId, cards.length ? `Top card stays ${cardLabel(cards[0])}.` : "The draw pile is empty.");
    return;
  }
  const options = permutationChoices(cards);
  state.prompt = {
    type: "alter_future",
    profileId: actorProfileId,
    label: "Choose the new order for the top cards.",
    cardsPreview: cards,
    actions: options.map((ordered, index) => buildPromptAction("resolve_prompt", ordered.map(cardLabel).join(" → "), {
      promptType: "alter_future",
      order: ordered,
      optionIndex: index
    }))
  };
}

function applyBuryPrompt(state, actorProfileId) {
  if (!state.drawPile.length) {
    state.prompt = promptDismiss(actorProfileId, "The draw pile is empty.");
    return;
  }
  const cardId = state.drawPile.shift();
  state.prompt = {
    type: "bury",
    profileId: actorProfileId,
    label: `Choose where to bury ${cardLabel(cardId)}.`,
    cardId,
    actions: Array.from({ length: state.drawPile.length + 1 }, (_, index) =>
      buildPromptAction("resolve_prompt", `Position ${index + 1}`, {
        promptType: "bury",
        cardId,
        position: index
      }))
  };
}

function resolveDrawResult(state, players, player, drawResult, events, nowIso) {
  const drawnCard = drawResult?.cardId || null;
  if (!drawnCard) {
    state.lastActionText = "The draw pile is empty.";
    return { finished: false };
  }
  const playerZone = zoneFor(state, player.profile_id);
  const takeThatReceiver = playerZone.pendingTakeThatFrom
    ? playerByProfile(players, playerZone.pendingTakeThatFrom)
    : null;

  if (takeThatReceiver && takeThatReceiver.end_state === "active") {
    playerZone.pendingTakeThatFrom = null;
    state.lastActionText = `${playerLabel(player)} handed the drawn card to ${playerLabel(takeThatReceiver)}.`;
    pushEvent(events, state, players, player.profile_id, "draw_card", {
      playerName: player.name,
      cardId: drawnCard,
      transferredTo: takeThatReceiver.name
    });
    return resolveDrawResult(state, players, takeThatReceiver, drawResult, events, nowIso);
  }
  pushEvent(events, state, players, player.profile_id, "draw_card", {
    playerName: player.name,
    cardId: drawnCard
  });

  if (drawnCard === "exploding_kitten") {
    const alreadyHoldingKitten = player.remainingPieces.includes("exploding_kitten");
    if (player.remainingPieces.includes("streaking_kitten") && !alreadyHoldingKitten) {
      player.remainingPieces.push(drawnCard);
      state.lastActionText = `${playerLabel(player)} secretly held an Exploding Kitten with Streaking Kitten.`;
    } else if (player.remainingPieces.includes("defuse")) {
      const defuseRemoval = removeCardFromHand(player.remainingPieces, "defuse", 1);
      player.remainingPieces = defuseRemoval.hand;
      appendDiscard(state, "defuse");
      state.prompt = {
        type: "defuse_reinsert",
        profileId: player.profile_id,
        cardId: drawnCard,
        label: "Choose the exact position to reinsert the Exploding Kitten.",
        actions: Array.from({ length: state.drawPile.length + 1 }, (_, index) =>
          buildPromptAction("resolve_prompt", `Position ${index + 1}`, {
            promptType: "defuse_reinsert",
            cardId: drawnCard,
            position: index
          }))
      };
      state.lastActionText = `${playerLabel(player)} used Defuse.`;
      return { waiting: true };
    } else {
      eliminatePlayer(state, players, player, drawnCard);
      appendDiscard(state, drawnCard);
      pushEvent(events, state, players, player.profile_id, "player_eliminated", {
        playerName: player.name,
        cardId: drawnCard
      });
      const winnerProfileId = maybeFinish(state, players);
      if (winnerProfileId) {
        const winner = playerByProfile(players, winnerProfileId);
        pushEvent(events, state, players, winnerProfileId, "match_finished", {
          winnerProfileId,
          winnerName: winner?.name || null
        });
        return { finished: true, winnerProfileId, finishedAt: nowIso };
      }
    }
  } else if (drawnCard === "imploding_kitten") {
    if (drawResult?.wasFaceUp) {
      eliminatePlayer(state, players, player, drawnCard);
      appendDiscard(state, drawnCard);
      pushEvent(events, state, players, player.profile_id, "player_eliminated", {
        playerName: player.name,
        cardId: drawnCard
      });
      const winnerProfileId = maybeFinish(state, players);
      if (winnerProfileId) {
        const winner = playerByProfile(players, winnerProfileId);
        pushEvent(events, state, players, winnerProfileId, "match_finished", {
          winnerProfileId,
          winnerName: winner?.name || null
        });
        return { finished: true, winnerProfileId, finishedAt: nowIso };
      }
    } else {
      state.prompt = {
        type: "imploding_reinsert",
        profileId: player.profile_id,
        cardId: drawnCard,
        label: "Choose where to reinsert the face-up Imploding Kitten.",
        actions: Array.from({ length: state.drawPile.length + 1 }, (_, index) =>
          buildPromptAction("resolve_prompt", `Position ${index + 1}`, {
            promptType: "imploding_reinsert",
            cardId: drawnCard,
            position: index
          }))
      };
      state.lastActionText = `${playerLabel(player)} repositioned the Imploding Kitten.`;
      return { waiting: true };
    }
  } else {
    player.remainingPieces.push(drawnCard);
    state.lastActionText = `${playerLabel(player)} drew ${cardLabel(drawnCard)}.`;
  }

  state.pendingDraws = Math.max(0, state.pendingDraws - 1);
  if (state.pendingDraws === 0) {
    passTurn(state, players, 1);
  }
  return { finished: false };
}

function resolveEffect(state, players, effect, events, nowIso) {
  const actor = playerByProfile(players, effect.actorProfileId);
  if (!actor || actor.end_state !== "active") return { finished: false };

  switch (effect.effectType) {
    case "skip": {
      state.pendingDraws = Math.max(0, state.pendingDraws - 1);
      state.lastActionText = `${playerLabel(actor)} skipped a draw.`;
      if (state.pendingDraws === 0) passTurn(state, players, 1);
      return { finished: false };
    }
    case "attack": {
      passTurn(state, players, Math.max(2, state.pendingDraws + 1));
      state.lastActionText = `${playerLabel(actor)} attacked the next player.`;
      return { finished: false };
    }
    case "shuffle": {
      state.drawPile = shuffle(state.drawPile);
      if (state.implodingFaceUpIndex !== null && state.implodingFaceUpIndex >= 0) {
        state.implodingFaceUpIndex = null;
      }
      state.lastActionText = `${playerLabel(actor)} shuffled the draw pile.`;
      return { finished: false };
    }
    case "see_the_future": {
      applySeeFuturePrompt(state, actor.profile_id);
      state.lastActionText = `${playerLabel(actor)} peeked at the next cards.`;
      return { finished: false };
    }
    case "favor": {
      applyFavorPrompt(state, players, actor.profile_id, effect.targetProfileId);
      state.lastActionText = `${playerLabel(actor)} requested a Favor from ${playerLabel(playerByProfile(players, effect.targetProfileId))}.`;
      return { finished: false };
    }
    case "reverse": {
      state.turnDirection *= -1;
      passTurn(state, players, 1);
      state.lastActionText = `${playerLabel(actor)} reversed turn order.`;
      return { finished: false };
    }
    case "draw_from_bottom": {
      state.lastActionText = `${playerLabel(actor)} drew from the bottom.`;
      return resolveDrawResult(state, players, actor, drawCard(state, true), events, nowIso);
    }
    case "alter_the_future": {
      applyAlterFuturePrompt(state, actor.profile_id);
      state.lastActionText = `${playerLabel(actor)} is altering the future.`;
      return { finished: false };
    }
    case "swap_top_bottom": {
      if (state.drawPile.length >= 2) {
        const first = state.drawPile[0];
        const last = state.drawPile[state.drawPile.length - 1];
        state.drawPile[0] = last;
        state.drawPile[state.drawPile.length - 1] = first;
      }
      state.lastActionText = `${playerLabel(actor)} swapped the top and bottom cards.`;
      return { finished: false };
    }
    case "bury": {
      applyBuryPrompt(state, actor.profile_id);
      state.lastActionText = `${playerLabel(actor)} is burying the top card.`;
      return { finished: false };
    }
    case "alter_the_future_now": {
      applyAlterFuturePrompt(state, actor.profile_id);
      state.lastActionText = `${playerLabel(actor)} changed the future out of turn.`;
      return { finished: false };
    }
    case "tower_of_power": {
      const zone = zoneFor(state, actor.profile_id);
      if (!state.sharedStash.length) {
        state.lastActionText = `${playerLabel(actor)} found no stash inside the tower.`;
        return { finished: false };
      }
      zone.stash.push(...state.sharedStash);
      state.sharedStash = [];
      state.lastActionText = `${playerLabel(actor)} claimed the Tower of Power stash.`;
      return { finished: false };
    }
    case "personal_attack": {
      zoneFor(state, actor.profile_id).extraTurns += 2;
      state.lastActionText = `${playerLabel(actor)} stacked two extra turns.`;
      return { finished: false };
    }
    case "share_the_future": {
      const cards = topPreview(state.drawPile, 3);
      const targetIndex = nextActiveIndex(players, state.turnIndex, state.turnDirection);
      const target = players[targetIndex];
      state.prompt = promptDismiss(actor.profile_id, cards.length
        ? `Top cards: ${cards.map(cardLabel).join(" · ")}`
        : "The draw pile is empty.");
      if (target && target.profile_id !== actor.profile_id) {
        zoneFor(state, target.profile_id).sharedFuturePreview = cards;
      }
      state.lastActionText = `${playerLabel(actor)} shared the future.`;
      return { finished: false };
    }
    case "ill_take_that": {
      const target = playerByProfile(players, effect.targetProfileId);
      if (!target || target.end_state !== "active") {
        state.lastActionText = "I'll Take That fizzled because the target is no longer active.";
        return { finished: false };
      }
      zoneFor(state, target.profile_id).pendingTakeThatFrom = actor.profile_id;
      state.lastActionText = `${playerLabel(actor)} will take the next card ${playerLabel(target)} draws.`;
      return { finished: false };
    }
    case "super_skip": {
      zoneFor(state, actor.profile_id).extraTurns = 0;
      state.pendingDraws = 0;
      passTurn(state, players, 1);
      state.lastActionText = `${playerLabel(actor)} ended every owed turn with Super Skip.`;
      return { finished: false };
    }
    case "potluck": {
      const order = [];
      let cursor = state.turnIndex;
      for (let step = 0; step < players.length; step += 1) {
        const candidate = players[cursor];
        if (candidate?.end_state === "active" && candidate.remainingPieces.length) {
          order.push(candidate.profile_id);
        }
        cursor = nextActiveIndex(players, cursor, state.turnDirection);
      }
      const currentPicker = playerByProfile(players, order[0] || actor.profile_id);
      state.prompt = {
        type: "potluck",
        profileId: currentPicker?.profile_id || actor.profile_id,
        label: "Choose one card to add to the top of the draw pile.",
        order,
        selected: [],
        actions: (currentPicker?.remainingPieces || []).map((cardId, index) => buildPromptAction("resolve_prompt", `Add ${cardLabel(cardId)}`, {
          promptType: "potluck",
          order,
          cardIndex: index,
          selected: []
        }))
      };
      state.lastActionText = `${playerLabel(actor)} started Potluck.`;
      return { finished: false };
    }
    case "barking_kitten": {
      const target = resolveBarkingTarget(state, players, actor.profile_id);
      if (!target) {
        zoneFor(state, actor.profile_id).armedBarking += 1;
        state.lastActionText = `${playerLabel(actor)} armed a Barking Kitten face-up.`;
        return { finished: false };
      }
      state.lastActionText = `${playerLabel(actor)} unleashed a Barking Kitten on ${playerLabel(target)}.`;
      return resolveBarkingAttack(state, players, actor, target, events);
    }
    case "pair": {
      const target = playerByProfile(players, effect.targetProfileId);
      if (!target || !stealableCards(state, target).length) {
        state.lastActionText = `${playerLabel(actor)} found no card to steal.`;
        return { finished: false };
      }
      const targetCards = stealableCards(state, target);
      const randomIndex = Math.floor(Math.random() * targetCards.length);
      const [stolenCard] = targetCards.splice(randomIndex, 1);
      actor.remainingPieces.push(stolenCard);
      state.lastActionText = `${playerLabel(actor)} stole a card from ${playerLabel(target)}.`;
      pushEvent(events, state, players, actor.profile_id, "pair_stole_card", {
        playerName: actor.name,
        targetName: target.name,
        cardId: effect.cardId
      });
      return { finished: false };
    }
    default:
      return { finished: false };
  }
}

function finishReaction(state, players, events, nowIso) {
  const reaction = state.reaction;
  state.reaction = null;
  if (!reaction) return { finished: false };
  if (reaction.nopesPlayed % 2 === 1) {
    state.lastActionText = `${cardLabel(reaction.effect.cardId)} was noped.`;
    return { finished: false };
  }
  return resolveEffect(state, players, reaction.effect, events, nowIso);
}

function recordPlayableCard(player, state, players, events, cardId, payload = {}, effectType = cardId) {
  const removal = removeCardFromHand(player.remainingPieces, cardId, 1);
  if (!removal.removedCount) {
    throw new Error(`${cardLabel(cardId)} is not in your hand.`);
  }
  player.remainingPieces = removal.hand;
  appendDiscard(state, ...removal.removed);
  pushEvent(events, state, players, player.profile_id, "card_played", {
    playerName: player.name,
    cardId,
    ...payload
  });
  queueReaction(state, players, player.profile_id, {
    effectType,
    cardId,
    actorProfileId: player.profile_id,
    ...payload
  });
}

function buildPlayerProjection(player, viewerProfileId, state) {
  const zone = zoneFor(state, player.profile_id);
  return {
    profileId: player.profile_id,
    name: player.name,
    seatIndex: player.seat_index,
    handCount: Array.isArray(player.remainingPieces) ? player.remainingPieces.length : 0,
    isMe: player.profile_id === viewerProfileId,
    disconnected: !!player.disconnected,
    endState: player.end_state,
    stashCount: zone.stash.length,
    armedBarking: zone.armedBarking
  };
}

function buildViewerPrompt(state, viewerProfileId) {
  const basePrompt = publicPrompt(state.prompt, viewerProfileId);
  if (basePrompt) return basePrompt;
  const preview = zoneFor(state, viewerProfileId).sharedFuturePreview;
  if (preview?.length) {
    return promptDismiss(viewerProfileId, `Shared future: ${preview.map(cardLabel).join(" · ")}`);
  }
  return null;
}

function buildReactionPrompt(state, players, viewerProfileId) {
  if (!state.reaction) return null;
  const responderId = currentResponder(state);
  if (responderId !== viewerProfileId) {
    return {
      type: "waiting",
      label: `${playerLabel(playerByProfile(players, responderId))} can respond with Nope.`
    };
  }
  const viewer = playerByProfile(players, viewerProfileId);
  const actions = [buildPromptAction("pass_reaction", "Pass")];
  if (viewer.remainingPieces.includes("nope")) {
    actions.unshift(buildPromptAction("reaction_nope", "Play Nope"));
  }
  return {
    type: "reaction",
    label: `Respond to ${cardLabel(state.reaction.effect.cardId)}?`,
    actions
  };
}

function buildStatusText(state, players) {
  const current = players[state.turnIndex];
  if (state.reaction) {
    return `${playerLabel(playerByProfile(players, currentResponder(state)))} can play Nope.`;
  }
  if (state.prompt?.waitingLabel) return state.prompt.waitingLabel;
  if (state.lastActionText) return state.lastActionText;
  return `${playerLabel(current)} is taking a turn.`;
}

function buildAvailableActionsForViewer(state, players, viewerProfileId) {
  const directPrompt = buildViewerPrompt(state, viewerProfileId);
  if (directPrompt?.actions?.length) {
    return directPrompt.actions;
  }
  if (state.reaction) {
    const prompt = buildReactionPrompt(state, players, viewerProfileId);
    return prompt?.actions || [];
  }
  return buildAvailableActions(state, players, viewerProfileId);
}

function resolveBarkingTarget(state, players, actorProfileId) {
  const armed = activePlayers(players)
    .filter((player) => player.profile_id !== actorProfileId && zoneFor(state, player.profile_id).armedBarking > 0);
  if (armed.length) return armed[0];
  const hidden = activePlayers(players)
    .filter((player) => player.profile_id !== actorProfileId && player.remainingPieces.includes("barking_kitten"));
  return hidden[0] || null;
}

function resolveBarkingAttack(state, players, actor, target, events) {
  const targetZone = zoneFor(state, target.profile_id);
  if (targetZone.armedBarking > 0) {
    targetZone.armedBarking = Math.max(0, targetZone.armedBarking - 1);
    appendDiscard(state, "barking_kitten");
  } else {
    const hiddenRemoval = removeCardFromHand(target.remainingPieces, "barking_kitten", 1);
    target.remainingPieces = hiddenRemoval.hand;
    appendDiscard(state, ...hiddenRemoval.removed);
  }

  if (target.remainingPieces.includes("defuse")) {
    const defuseRemoval = removeCardFromHand(target.remainingPieces, "defuse", 1);
    target.remainingPieces = defuseRemoval.hand;
    appendDiscard(state, "defuse");
    state.lastActionText = `${playerLabel(target)} defused the Barking Kitten threat.`;
    pushEvent(events, state, players, actor.profile_id, "barking_resolved", {
      playerName: actor.name,
      targetName: target.name,
      outcome: "defused"
    });
    return { finished: false };
  }

  target.end_state = "eliminated";
  appendDiscard(state, ...target.remainingPieces);
  target.remainingPieces = [];
  state.lastActionText = `${playerLabel(target)} could not stop the Barking Kitten blast.`;
  pushEvent(events, state, players, actor.profile_id, "player_eliminated", {
    playerName: target.name,
    cardId: "barking_kitten"
  });
  const winnerProfileId = maybeFinish(state, players);
  if (winnerProfileId) {
    const winner = playerByProfile(players, winnerProfileId);
    pushEvent(events, state, players, winnerProfileId, "match_finished", {
      winnerProfileId,
      winnerName: winner?.name || null
    });
    return { finished: true, winnerProfileId };
  }
  return { finished: false };
}

export function createExplodingKittensDriver() {
  return {
    gameType: EXPLODING_KITTENS_GAME_TYPE,
    buildRoomConfig(config = {}) {
      return buildEkRoomConfig(config);
    },
    validateRoomSetup(_room, members, roomConfig) {
      const seatedPlayers = members.filter((member) => member.role === "player");
      if (seatedPlayers.length < roomConfig.minPlayers) {
        throw new Error(`Need at least ${roomConfig.minPlayers} players for ${roomConfig.modeLabel}.`);
      }
      if (seatedPlayers.length > roomConfig.maxPlayers) {
        throw new Error(`${roomConfig.modeLabel} supports at most ${roomConfig.maxPlayers} players.`);
      }
    },
    projectRoomSetup(room, members, viewerProfileId) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      return {
        gameType: EXPLODING_KITTENS_GAME_TYPE,
        ruleset: roomConfig.ruleset,
        modeLabel: roomConfig.modeLabel,
        minPlayers: roomConfig.minPlayers,
        maxPlayers: roomConfig.maxPlayers,
        viewerProfileId,
        players: members
          .filter((member) => member.role === "player")
          .sort((a, b) => a.seat_index - b.seat_index)
          .map((member) => ({
            profileId: member.profile_id,
            name: member.name,
            seatIndex: member.seat_index,
            isReady: !!member.is_ready,
            isHost: !!member.isHost,
            connectionState: member.connection_state
          }))
      };
    },
    applyRoomPatch() {
      throw new Error("Exploding Kittens does not use room setup patches in v1.");
    },
    createMatch(room, members, makeId, nowIso) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      const players = members
        .filter((member) => member.role === "player")
        .sort((a, b) => a.seat_index - b.seat_index);
      const { actionDeck, stash } = buildInitialDeck(resolveEkRuleset(roomConfig), players.length);
      const shuffledActionDeck = shuffle(actionDeck);
      const matchPlayers = [];
      for (const player of players) {
        const hand = shuffledActionDeck.splice(0, 7);
        hand.push("defuse");
        matchPlayers.push({
          id: makeId("match_player"),
          profile_id: player.profile_id,
          seatIndex: player.seat_index,
          colorIndex: player.seat_index,
          remainingPiecesJson: JSON.stringify(hand)
        });
      }

      const extraDefuses = Math.max(0, 6 - players.length);
      shuffledActionDeck.push(...repeat("defuse", extraDefuses));
      const explodingCount = Math.max(1, players.length - 1);
      if (roomConfig.ruleset === "imploding") {
        shuffledActionDeck.push("imploding_kitten");
        shuffledActionDeck.push(...repeat("exploding_kitten", Math.max(0, explodingCount - 1)));
      } else {
        shuffledActionDeck.push(...repeat("exploding_kitten", explodingCount));
      }

      const state = createInitialState(roomConfig);
      state.drawPile = shuffle(shuffledActionDeck);
      state.sharedStash = stash;
      state.lastActionText = `${playerLabel(players[0])} goes first.`;
      const events = [{
        profileId: null,
        eventType: "match_started",
        payload: {
          ruleset: roomConfig.ruleset,
          publicState: buildStateForReplay(state, matchPlayers.map((player, index) => ({
            ...player,
            name: players[index].name,
            remainingPieces: parseJson(player.remainingPiecesJson, []),
            end_state: "active",
            profile_id: player.profile_id,
            seat_index: player.seatIndex
          })))
        }
      }];

      return {
        match: {
          id: makeId("match"),
          roomId: room.id,
          status: MATCH_STARTING,
          turnIndex: 0,
          boardJson: JSON.stringify(state),
          governanceJson: JSON.stringify({ endVotes: [], rematchVotes: [] }),
          winnerProfileId: null,
          createdAt: nowIso(),
          finishedAt: null,
          firstCommittedAt: null
        },
        matchPlayers,
        events
      };
    },
    projectMatch(room, match, players, viewerProfileId) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      const state = parseState(match.board_json, roomConfig);
      return {
        gameType: EXPLODING_KITTENS_GAME_TYPE,
        ruleset: roomConfig.ruleset,
        modeLabel: roomConfig.modeLabel,
        viewerProfileId,
        status: match.status,
        turnIndex: state.turnIndex,
        statusText: buildStatusText(state, players),
        drawPileCount: state.drawPile.length,
        discardPile: state.discardPile,
        prompt: buildViewerPrompt(state, viewerProfileId) || buildReactionPrompt(state, players, viewerProfileId),
        players: players.map((player) => buildPlayerProjection(player, viewerProfileId, state)),
        me: playerByProfile(players, viewerProfileId)
          ? {
              hand: [...playerByProfile(players, viewerProfileId).remainingPieces],
              stash: [...zoneFor(state, viewerProfileId).stash]
            }
          : null,
        availableActions: buildAvailableActionsForViewer(state, players, viewerProfileId)
      };
    },
    buildReplay(room, match, players, moves) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      return {
        gameType: EXPLODING_KITTENS_GAME_TYPE,
        ruleset: roomConfig.ruleset,
        modeLabel: roomConfig.modeLabel,
        id: match.id,
        roomCode: room.code,
        roomTitle: room.title,
        status: match.status,
        winnerProfileId: match.winner_profile_id,
        winnerName: players.find((player) => player.profile_id === match.winner_profile_id)?.name || null,
        createdAt: match.created_at,
        finishedAt: match.finished_at,
        moveCount: moves.length,
        frames: moves.map((move, index) => ({
          step: index + 1,
          eventType: move.eventType,
          label: buildReplayLabel(move.eventType, move.payload),
          actorName: move.playerName,
          createdAt: move.createdAt,
          payload: move.payload
        }))
      };
    },
    handleCommand(room, match, players, profileId, command, nowIso) {
      const roomConfig = buildEkRoomConfig(parseJson(room.config_json, {}));
      const state = cloneState(parseState(match.board_json, roomConfig));
      const nextPlayers = clonePlayers(players);
      const actor = playerByProfile(nextPlayers, profileId);
      if (!actor) throw new Error("Only seated players can act in this match.");
      if (actor.end_state !== "active") throw new Error("Eliminated players cannot act.");

      const commandType = String(command?.commandType || "").trim();
      const payload = command?.commandPayload || {};
      const events = [];

      const finalize = (result = {}) => ({
        boardJson: JSON.stringify(state),
        turnIndex: state.turnIndex,
        firstCommittedAt: match.first_committed_at || nowIso,
        status: result.finished ? MATCH_FINISHED : MATCH_ACTIVE,
        winnerProfileId: result.winnerProfileId ?? null,
        finishedAt: result.finished ? result.finishedAt : null,
        players: nextPlayers,
        events
      });

      if (state.prompt?.profileId === profileId && commandType === "dismiss_prompt") {
        zoneFor(state, profileId).sharedFuturePreview = null;
        state.prompt = null;
        return finalize();
      }

      if (state.prompt?.profileId === profileId && commandType === "resolve_prompt") {
        const promptType = payload.promptType;
        if (promptType === "defuse_reinsert") {
          insertIntoDrawPile(state, payload.cardId, payload.position);
          state.prompt = null;
          state.pendingDraws = Math.max(0, state.pendingDraws - 1);
          if (state.pendingDraws === 0) passTurn(state, nextPlayers, 1);
          state.lastActionText = `${playerLabel(actor)} reinserted the Exploding Kitten.`;
          pushEvent(events, state, nextPlayers, profileId, "defuse_reinserted", {
            playerName: actor.name,
            position: payload.position
          });
          return finalize();
        }
        if (promptType === "imploding_reinsert") {
          insertIntoDrawPile(state, payload.cardId, payload.position);
          state.implodingFaceUpIndex = payload.position;
          state.prompt = null;
          state.pendingDraws = Math.max(0, state.pendingDraws - 1);
          if (state.pendingDraws === 0) passTurn(state, nextPlayers, 1);
          state.lastActionText = `${playerLabel(actor)} reinserted the Imploding Kitten.`;
          pushEvent(events, state, nextPlayers, profileId, "imploding_reinserted", {
            playerName: actor.name,
            position: payload.position
          });
          return finalize();
        }
        if (promptType === "favor_give") {
          const target = playerByProfile(nextPlayers, profileId);
          const receiver = playerByProfile(nextPlayers, payload.actorProfileId);
          if (!target || !receiver) throw new Error("Favor target is no longer valid.");
          const card = target.remainingPieces[payload.cardIndex];
          if (!card) throw new Error("That card is no longer available.");
          target.remainingPieces.splice(payload.cardIndex, 1);
          receiver.remainingPieces.push(card);
          state.prompt = null;
          state.lastActionText = `${playerLabel(target)} gave ${cardLabel(card)} to ${playerLabel(receiver)}.`;
          pushEvent(events, state, nextPlayers, profileId, "favor_resolved", {
            playerName: target.name,
            actorName: receiver.name,
            cardId: card
          });
          return finalize();
        }
        if (promptType === "alter_future") {
          const currentTop = topPreview(state.drawPile, payload.order.length);
          state.drawPile.splice(0, payload.order.length, ...payload.order);
          state.prompt = null;
          state.lastActionText = `${playerLabel(actor)} reordered the future.`;
          pushEvent(events, state, nextPlayers, profileId, "future_altered", {
            playerName: actor.name,
            before: currentTop,
            after: payload.order
          });
          return finalize();
        }
        if (promptType === "bury") {
          insertIntoDrawPile(state, payload.cardId, payload.position);
          state.prompt = null;
          state.lastActionText = `${playerLabel(actor)} buried ${cardLabel(payload.cardId)}.`;
          pushEvent(events, state, nextPlayers, profileId, "card_buried", {
            playerName: actor.name,
            cardId: payload.cardId,
            position: payload.position
          });
          return finalize();
        }
        if (promptType === "potluck") {
          const order = Array.isArray(payload.order) ? payload.order : [];
          const actingPlayer = playerByProfile(nextPlayers, profileId);
          const selected = Array.isArray(payload.selected) ? [...payload.selected] : [];
          const card = actingPlayer?.remainingPieces?.[payload.cardIndex];
          if (!actingPlayer || !card) throw new Error("That card is no longer available.");
          actingPlayer.remainingPieces.splice(payload.cardIndex, 1);
          selected.unshift(card);
          const nextOrder = order.filter((entry) => entry !== profileId);
          if (nextOrder.length) {
            const nextProfileId = nextOrder[0];
            const nextPlayer = playerByProfile(nextPlayers, nextProfileId);
            state.prompt = {
              type: "potluck",
              profileId: nextProfileId,
              label: "Choose one card to add to the top of the draw pile.",
              order: nextOrder,
              selected,
              waitingLabel: `${playerLabel(nextPlayer)} is choosing a Potluck card.`,
              actions: (nextPlayer?.remainingPieces || []).map((cardId, index) => buildPromptAction("resolve_prompt", `Add ${cardLabel(cardId)}`, {
                promptType: "potluck",
                order: nextOrder,
                cardIndex: index,
                selected
              }))
            };
          } else {
            state.drawPile.unshift(...selected);
            state.prompt = null;
            state.lastActionText = `${playerLabel(actor)} finished Potluck.`;
            pushEvent(events, state, nextPlayers, profileId, "potluck_resolved", {
              playerName: actor.name,
              cards: selected
            });
          }
          return finalize();
        }
      }

      if (state.reaction) {
        if (currentResponder(state) !== profileId) {
          throw new Error("It is another player's reaction window.");
        }
        if (commandType === "reaction_nope") {
          const removal = removeCardFromHand(actor.remainingPieces, "nope", 1);
          if (!removal.removedCount) throw new Error("You do not have Nope.");
          actor.remainingPieces = removal.hand;
          appendDiscard(state, "nope");
          state.reaction.nopesPlayed += 1;
          state.reaction.responders = buildReactionOrder(nextPlayers, profileId);
          state.reaction.responderIndex = 0;
          state.lastActionText = `${playerLabel(actor)} played Nope.`;
          pushEvent(events, state, nextPlayers, profileId, "reaction_nope", {
            playerName: actor.name,
            cardId: "nope"
          });
          return finalize();
        }
        if (commandType === "pass_reaction") {
          advanceReaction(state, nextPlayers);
          if (!currentResponder(state)) {
            const result = finishReaction(state, nextPlayers, events, nowIso);
            return finalize(result);
          }
          return finalize();
        }
      }

      if (nextPlayers[state.turnIndex]?.profile_id !== profileId) {
        throw new Error("It is not your turn.");
      }

      if (commandType === "draw_card") {
        const result = resolveDrawResult(state, nextPlayers, actor, drawCard(state), events, nowIso);
        return finalize(result);
      }

      if (commandType === "play_pair") {
        const removal = removeCardsForPair(actor.remainingPieces, payload.cardId);
        if (!removal.removedCount || removal.removedCount < 2) {
          throw new Error("You need a valid cat pair to play that combo.");
        }
        actor.remainingPieces = removal.hand;
        appendDiscard(state, ...removal.removed);
        pushEvent(events, state, nextPlayers, profileId, "pair_played", {
          playerName: actor.name,
          cardId: payload.cardId
        });
        queueReaction(state, nextPlayers, profileId, {
          effectType: "pair",
          cardId: payload.cardId,
          actorProfileId: profileId,
          targetProfileId: payload.targetProfileId
        });
        return finalize();
      }

      if (commandType === "play_barking_pair") {
        const removal = removeCardFromHand(actor.remainingPieces, "barking_kitten", 2);
        if (removal.removedCount < 2) {
          throw new Error("You need both Barking Kittens to play that pair.");
        }
        actor.remainingPieces = removal.hand;
        appendDiscard(state, ...removal.removed);
        pushEvent(events, state, nextPlayers, profileId, "pair_played", {
          playerName: actor.name,
          cardId: "barking_kitten"
        });
        const target = playerByProfile(nextPlayers, payload.targetProfileId);
        if (!target || target.end_state !== "active") {
          throw new Error("Choose a valid target for the Barking Kittens.");
        }
        const result = resolveBarkingAttack(state, nextPlayers, actor, target, events);
        return finalize(result);
      }

      if (commandType === "play_card") {
        const cardId = String(payload.cardId || "").trim();
        if (!cardId) throw new Error("Missing card.");
        if (["skip", "attack", "shuffle", "see_the_future", "favor", "reverse", "draw_from_bottom", "alter_the_future", "swap_top_bottom", "bury", "tower_of_power", "personal_attack", "share_the_future", "ill_take_that", "super_skip", "potluck", "barking_kitten", "alter_the_future_now"].includes(cardId)) {
          recordPlayableCard(actor, state, nextPlayers, events, cardId, payload, cardId);
          return finalize();
        }
        throw new Error(`${cardLabel(cardId)} is not playable yet.`);
      }

      throw new Error("Unsupported Exploding Kittens command.");
    },
    onReconnect(match, players, profileId) {
      return {
        status: match.status,
        players: players.map((player) => player.profile_id === profileId ? { ...player, disconnected: 0 } : player)
      };
    },
    onDisconnect(match, players, profileId) {
      return {
        status: match.status,
        players: players.map((player) => player.profile_id === profileId ? { ...player, disconnected: 1 } : player)
      };
    },
    onReclaimExpired(_room, match, players, profileId, nowIso) {
      const nextPlayers = clonePlayers(players);
      const player = playerByProfile(nextPlayers, profileId);
      if (player && player.end_state === "active") {
        player.end_state = "abandoned";
        player.disconnected = 1;
      }
      const winnerProfileId = maybeFinish(createInitialState({ ruleset: "base", modeLabel: "Base" }), nextPlayers);
      return {
        status: winnerProfileId ? MATCH_FINISHED : match.status,
        winnerProfileId,
        finishedAt: winnerProfileId ? nowIso : null,
        players: nextPlayers
      };
    }
  };
}
