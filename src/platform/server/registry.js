import blokusManifest from "../../games/blokus/index.js";
import { BLOKUS_GAME_TYPE, createBlokusDriver } from "../../games/blokus/server.js";

const REGISTRY = {
  [BLOKUS_GAME_TYPE]: createBlokusDriver()
};

export function getGameDriver(gameType) {
  return REGISTRY[gameType] || REGISTRY[BLOKUS_GAME_TYPE];
}

export function listGameTypes() {
  return Object.keys(REGISTRY);
}

export function getGameManifest(gameType) {
  return gameType === BLOKUS_GAME_TYPE ? blokusManifest : blokusManifest;
}
