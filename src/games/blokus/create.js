export function buildBlokusCreateModel() {
  return {
    modes: [
      {
        ruleset: "classic_4p",
        label: "Classic 4P",
        description: "Standard four-player Blokus on a 20x20 board."
      },
      {
        ruleset: "solo_1v1",
        label: "Solo 1:1",
        description: "Two-player duel on a 14x14 board with the full Blokus piece set."
      }
    ]
  };
}
