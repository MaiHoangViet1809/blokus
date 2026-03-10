import { buildBlokusCreateModel } from "./create.js";

const blokusBaseManifest = {
  gameType: "blokus",
  title: "Blokus",
  description: "Corner-touching polyomino strategy for 2 to 4 players.",
  buildCreateModel: buildBlokusCreateModel
};

export default blokusBaseManifest;
