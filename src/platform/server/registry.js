import blokusManifest from "../../games/blokus/index.js";
import { BLOKUS_GAME_TYPE, createBlokusDriver } from "../../games/blokus/server.js";
import chessManifest from "../../games/chess/index.js";
import { CHESS_GAME_TYPE, createChessDriver } from "../../games/chess/server.js";
import explodingKittensManifest from "../../games/exploding_kittens/index.js";
import { createExplodingKittensDriver, EXPLODING_KITTENS_GAME_TYPE } from "../../games/exploding_kittens/server.js";

const REGISTRY = {
  [BLOKUS_GAME_TYPE]: createBlokusDriver(),
  [CHESS_GAME_TYPE]: createChessDriver(),
  [EXPLODING_KITTENS_GAME_TYPE]: createExplodingKittensDriver()
};

export function getGameDriver(gameType) {
  return REGISTRY[gameType] || REGISTRY[BLOKUS_GAME_TYPE];
}

export function listGameTypes() {
  return Object.keys(REGISTRY);
}

export function getGameManifest(gameType) {
  if (gameType === EXPLODING_KITTENS_GAME_TYPE) return explodingKittensManifest;
  if (gameType === CHESS_GAME_TYPE) return chessManifest;
  return blokusManifest;
}
