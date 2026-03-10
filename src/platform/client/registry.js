import blokusManifest from "../../games/blokus/client.js";

const REGISTRY = {
  [blokusManifest.gameType]: blokusManifest
};

export function getGameClient(gameType) {
  return REGISTRY[gameType] || REGISTRY.blokus;
}

export function listGameClients() {
  return Object.values(REGISTRY);
}
