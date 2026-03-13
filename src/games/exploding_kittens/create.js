import { EK_RULESETS } from "./shared.js";

export function buildExplodingKittensCreateModel() {
  return {
    modes: Object.values(EK_RULESETS).map((ruleset) => ({
      ruleset: ruleset.ruleset,
      label: ruleset.label,
      description: ruleset.description
    }))
  };
}
