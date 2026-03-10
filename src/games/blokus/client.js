import BlokusLiveView from "./LiveView.vue";
import BlokusReplayView from "./ReplayView.vue";
import blokusBaseManifest from "./index.js";
import { buildBlokusStagingTableModel } from "./staging.js";

const blokusClientManifest = {
  ...blokusBaseManifest,
  buildStagingTableModel: buildBlokusStagingTableModel,
  liveComponent: BlokusLiveView,
  replayComponent: BlokusReplayView
};

export default blokusClientManifest;
