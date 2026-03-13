import { buildExplodingKittensCreateModel } from "./create.js";
import { EXPLODING_KITTENS_GAME_TYPE } from "./shared.js";

const explodingKittensManifest = {
  gameType: EXPLODING_KITTENS_GAME_TYPE,
  title: "Exploding Kittens",
  description: "Preset-driven hidden-information card chaos with reactions and defuse reinsertion.",
  buildCreateModel: buildExplodingKittensCreateModel
};

export default explodingKittensManifest;
