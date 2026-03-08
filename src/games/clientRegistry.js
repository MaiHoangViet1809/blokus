import BlokusSetupView from "./blokus/SetupView.vue";
import BlokusLiveView from "./blokus/LiveView.vue";
import BlokusReplayView from "./blokus/ReplayView.vue";

const REGISTRY = {
  blokus: {
    setupComponent: BlokusSetupView,
    liveComponent: BlokusLiveView,
    replayComponent: BlokusReplayView
  }
};

export function getGameClient(gameType) {
  return REGISTRY[gameType] || REGISTRY.blokus;
}
