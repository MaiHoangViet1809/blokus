import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import GameLobbyView from "./views/GameLobbyView.vue";
import RoomView from "./views/RoomView.vue";
import MatchView from "./views/MatchView.vue";
import MatchReplayView from "./views/MatchReplayView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/games/:gameType", name: "game-lobby", component: GameLobbyView, props: true },
    { path: "/rooms/:roomCode", name: "room", component: RoomView, props: true },
    { path: "/matches/:matchId", name: "match", component: MatchView, props: true },
    { path: "/matches/:matchId/replay", name: "match-replay", component: MatchReplayView, props: true }
  ]
});

export default router;
