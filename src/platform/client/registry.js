import blokusManifest from "../../games/blokus/client.js";
import chessManifest from "../../games/chess/client.js";

const REGISTRY = {
  [blokusManifest.gameType]: blokusManifest,
  [chessManifest.gameType]: chessManifest
};

export function getGameClient(gameType) {
  return REGISTRY[gameType] || REGISTRY.blokus;
}

export function listGameClients() {
  return Object.values(REGISTRY);
}
