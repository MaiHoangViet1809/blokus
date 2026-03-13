export const EXPLODING_KITTENS_GAME_TYPE = "exploding_kittens";
export const EK_HAND_SIZE = 7;
export const EK_MAX_MESSAGE = 1000;

export const EK_RULESETS = {
  base: {
    ruleset: "base",
    label: "Base",
    description: "Core Exploding Kittens with standard deck construction.",
    minPlayers: 2,
    maxPlayers: 5,
    modeLabel: "Base"
  },
  imploding: {
    ruleset: "imploding",
    label: "Imploding",
    description: "Adds the Imploding Kitten plus reverse and draw-depth manipulation.",
    minPlayers: 2,
    maxPlayers: 6,
    modeLabel: "Imploding"
  },
  streaking: {
    ruleset: "streaking",
    label: "Streaking",
    description: "Adds the Streaking Kitten and extra draw-pile manipulation.",
    minPlayers: 2,
    maxPlayers: 5,
    modeLabel: "Streaking"
  },
  barking: {
    ruleset: "barking",
    label: "Barking",
    description: "Adds Barking Kittens, bury effects, and extra chaos.",
    minPlayers: 2,
    maxPlayers: 5,
    modeLabel: "Barking"
  }
};

export const EK_CARD_META = {
  attack: { label: "Attack", kind: "action", accent: "danger" },
  skip: { label: "Skip", kind: "action", accent: "warning" },
  favor: { label: "Favor", kind: "action", accent: "accent" },
  shuffle: { label: "Shuffle", kind: "action", accent: "neutral" },
  see_the_future: { label: "See The Future", kind: "action", accent: "accent" },
  nope: { label: "Nope", kind: "reaction", accent: "danger" },
  defuse: { label: "Defuse", kind: "safety", accent: "success" },
  exploding_kitten: { label: "Exploding Kitten", kind: "kitten", accent: "danger" },
  imploding_kitten: { label: "Imploding Kitten", kind: "kitten", accent: "danger" },
  streaking_kitten: { label: "Streaking Kitten", kind: "passive", accent: "warning" },
  barking_kitten: { label: "Barking Kitten", kind: "action", accent: "warning" },
  tower_of_power: { label: "Tower of Power", kind: "action", accent: "warning" },
  alter_the_future_now: { label: "Alter The Future NOW", kind: "action", accent: "accent" },
  personal_attack: { label: "Personal Attack", kind: "action", accent: "danger" },
  share_the_future: { label: "Share The Future", kind: "action", accent: "accent" },
  ill_take_that: { label: "I'll Take That", kind: "action", accent: "warning" },
  super_skip: { label: "Super Skip", kind: "action", accent: "warning" },
  potluck: { label: "Potluck", kind: "action", accent: "neutral" },
  reverse: { label: "Reverse", kind: "action", accent: "accent" },
  draw_from_bottom: { label: "Draw From Bottom", kind: "action", accent: "neutral" },
  alter_the_future: { label: "Alter The Future", kind: "action", accent: "accent" },
  swap_top_bottom: { label: "Swap Top & Bottom", kind: "action", accent: "neutral" },
  bury: { label: "Bury", kind: "action", accent: "neutral" },
  tacocat: { label: "Tacocat", kind: "cat", accent: "cat" },
  cattermelon: { label: "Cattermelon", kind: "cat", accent: "cat" },
  beard_cat: { label: "Beard Cat", kind: "cat", accent: "cat" },
  rainbow_ralphing_cat: { label: "Rainbow-Ralphing Cat", kind: "cat", accent: "cat" },
  hairy_potato_cat: { label: "Hairy Potato Cat", kind: "cat", accent: "cat" },
  feral_cat: { label: "Feral Cat", kind: "cat", accent: "warning" }
};

export const EK_CAT_CARDS = [
  "tacocat",
  "cattermelon",
  "beard_cat",
  "rainbow_ralphing_cat",
  "hairy_potato_cat"
];

export const EK_ACTION_CARD_IDS = Object.entries(EK_CARD_META)
  .filter(([, meta]) => ["action", "reaction"].includes(meta.kind))
  .map(([cardId]) => cardId);

export const EK_BASE_SUPPLY = {
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  see_the_future: 5,
  nope: 5,
  tacocat: 4,
  cattermelon: 4,
  beard_cat: 4,
  rainbow_ralphing_cat: 4,
  hairy_potato_cat: 4,
  defuse: 6,
  exploding_kitten: 4
};

export const EK_EXPANSION_SUPPLY = {
  imploding: {
    imploding_kitten: 1,
    reverse: 4,
    draw_from_bottom: 4,
    alter_the_future: 4
  },
  streaking: {
    streaking_kitten: 1,
    swap_top_bottom: 3,
    feral_cat: 4
  },
  barking: {
    barking_kitten: 2,
    tower_of_power: 1,
    alter_the_future_now: 2,
    bury: 2,
    personal_attack: 4,
    share_the_future: 2,
    ill_take_that: 4,
    super_skip: 1,
    potluck: 2
  }
};

export function resolveEkRuleset(config = {}) {
  const requestedRuleset = String(config?.ruleset || "base").trim().toLowerCase();
  return EK_RULESETS[requestedRuleset] || EK_RULESETS.base;
}

export function buildEkRoomConfig(config = {}) {
  const ruleset = resolveEkRuleset(config);
  return {
    ruleset: ruleset.ruleset,
    minPlayers: ruleset.minPlayers,
    maxPlayers: ruleset.maxPlayers,
    modeLabel: ruleset.modeLabel
  };
}

export function seatLabel(seatIndex) {
  return `Seat ${seatIndex + 1}`;
}

export function cardMeta(cardId) {
  return EK_CARD_META[cardId] || {
    label: String(cardId || "Unknown"),
    kind: "action",
    accent: "neutral"
  };
}

export function cardLabel(cardId) {
  return cardMeta(cardId).label;
}

export function playerLabel(player) {
  return player?.name || "Player";
}

export function actionLabel(action) {
  if (!action) return "Action";
  if (action.label) return action.label;
  switch (action.type) {
    case "draw_card":
      return "Draw";
    case "reaction_nope":
      return "Play Nope";
    case "confirm_reaction_window":
      return "Confirm";
    case "resolve_prompt":
      return action.choiceLabel || "Choose";
    default:
      return "Action";
  }
}

export function handCountText(count) {
  return `${count} card${count === 1 ? "" : "s"}`;
}

export function pairableGroups(hand = []) {
  const counts = hand.reduce((acc, cardId) => {
    acc[cardId] = (acc[cardId] || 0) + 1;
    return acc;
  }, {});
  return EK_CAT_CARDS.filter((cardId) => counts[cardId] >= 2);
}

export function hasFeralCat(hand = []) {
  return hand.includes("feral_cat");
}

export function canFormCatPair(hand = [], cardId) {
  const copies = hand.filter((entry) => entry === cardId).length;
  if (copies >= 2) return true;
  return EK_CAT_CARDS.includes(cardId) && copies >= 1 && hasFeralCat(hand);
}

export function formatEkTimestamp(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
