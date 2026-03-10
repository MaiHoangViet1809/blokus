import { buildChessCreateModel } from "./create.js";

const chessManifest = {
  gameType: "chess",
  title: "Chess",
  description: "Standard 8x8 chess for two human players.",
  buildCreateModel: buildChessCreateModel
};

export default chessManifest;
