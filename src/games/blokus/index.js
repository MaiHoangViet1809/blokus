import BlokusLiveView from "./LiveView.vue";
import BlokusReplayView from "./ReplayView.vue";
import { buildBlokusCreateModel } from "./create.js";
import { buildBlokusStagingTableModel } from "./staging.js";

const blokusManifest = {
  gameType: "blokus",
  title: "Blokus",
  description: "Corner-touching polyomino strategy for 2 to 4 players.",
  buildCreateModel: buildBlokusCreateModel,
  buildStagingTableModel: buildBlokusStagingTableModel,
  liveComponent: BlokusLiveView,
  replayComponent: BlokusReplayView
};

export default blokusManifest;
