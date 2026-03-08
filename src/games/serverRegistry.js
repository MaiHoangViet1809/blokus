import { BLOKUS_GAME_TYPE, createBlokusDriver } from "./blokus/driver.js";

const REGISTRY = {
  [BLOKUS_GAME_TYPE]: createBlokusDriver()
};

export function getGameDriver(gameType) {
  return REGISTRY[gameType] || REGISTRY[BLOKUS_GAME_TYPE];
}

export function listGameTypes() {
  return Object.keys(REGISTRY);
}
