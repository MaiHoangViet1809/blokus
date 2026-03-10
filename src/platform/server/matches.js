export const MATCH_STATUSES = {
  STARTING: "starting",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  ABANDONED: "abandoned",
  FINISHED: "finished"
};

export function parseGovernance(governanceJson, parseJson) {
  const parsed = parseJson(governanceJson, {});
  return {
    endVotes: Array.isArray(parsed.endVotes) ? parsed.endVotes : [],
    rematchVotes: Array.isArray(parsed.rematchVotes) ? parsed.rematchVotes : []
  };
}

export function toggleVote(votes, profileId) {
  return votes.includes(profileId)
    ? votes.filter((entry) => entry !== profileId)
    : [...votes, profileId];
}
