import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./platform/client/views/HomeView.vue";
import GameLobbyView from "./platform/client/views/GameLobbyView.vue";
import RoomView from "./platform/client/views/RoomView.vue";
import MatchView from "./platform/client/views/MatchView.vue";
import MatchReplayView from "./platform/client/views/MatchReplayView.vue";

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
