export function buildChessCreateModel() {
  return {
    modes: [
      {
        ruleset: "standard_2p",
        label: "Standard 2P",
        description: "Classic 8x8 human-vs-human chess."
      }
    ]
  };
}
