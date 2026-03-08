import BlokusSetupView from "./blokus/SetupView.vue";
import BlokusLiveView from "./blokus/LiveView.vue";
import BlokusReplayView from "./blokus/ReplayView.vue";

const REGISTRY = {
  blokus: {
    gameType: "blokus",
    title: "Blokus",
    description: "Corner-touching polyomino strategy for 2 to 4 players.",
    setupComponent: BlokusSetupView,
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
