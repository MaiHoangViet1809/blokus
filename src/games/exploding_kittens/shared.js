export const EXPLODING_KITTENS_GAME_TYPE = "exploding_kittens";

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
    description: "Base game with Imploding Kittens cards and six-player support.",
    minPlayers: 2,
    maxPlayers: 6,
    modeLabel: "Imploding"
  },
  streaking: {
    ruleset: "streaking",
    label: "Streaking",
    description: "Base game plus the Streaking Kitten and the matching action cards.",
    minPlayers: 2,
    maxPlayers: 5,
    modeLabel: "Streaking"
  },
  barking: {
    ruleset: "barking",
    label: "Barking",
    description: "Base game plus Barking Kittens cards and combo interactions.",
    minPlayers: 2,
    maxPlayers: 5,
    modeLabel: "Barking"
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
