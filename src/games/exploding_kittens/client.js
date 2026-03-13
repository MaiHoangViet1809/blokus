import ExplodingKittensLiveView from "./LiveView.vue";
import ExplodingKittensReplayView from "./ReplayView.vue";
import explodingKittensManifest from "./index.js";
import { buildExplodingKittensStagingTableModel } from "./staging.js";

const explodingKittensClientManifest = {
  ...explodingKittensManifest,
  buildStagingTableModel: buildExplodingKittensStagingTableModel,
  liveComponent: ExplodingKittensLiveView,
  replayComponent: ExplodingKittensReplayView
};

export default explodingKittensClientManifest;
