import ChessLiveView from "./LiveView.vue";
import ChessReplayView from "./ReplayView.vue";
import chessManifest from "./index.js";
import { buildChessStagingTableModel } from "./staging.js";

const chessClientManifest = {
  ...chessManifest,
  buildStagingTableModel: buildChessStagingTableModel,
  liveComponent: ChessLiveView,
  replayComponent: ChessReplayView
};

export default chessClientManifest;
