import BlokusLiveView from "./blokus/LiveView.vue";
import BlokusReplayView from "./blokus/ReplayView.vue";
import { buildBlokusStagingTableModel } from "./blokus/stagingModel.js";

const REGISTRY = {
  blokus: {
    gameType: "blokus",
    title: "Blokus",
    description: "Corner-touching polyomino strategy for 2 to 4 players.",
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
    ],
    buildStagingTableModel: buildBlokusStagingTableModel,
    liveComponent: BlokusLiveView,
    replayComponent: BlokusReplayView
  }
};

export function getGameClient(gameType) {
  return REGISTRY[gameType] || REGISTRY.blokus;
}

export function listGameClients() {
  return Object.values(REGISTRY);
}
