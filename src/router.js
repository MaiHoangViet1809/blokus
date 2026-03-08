import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import RoomView from "./views/RoomView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/rooms/:roomCode", name: "room", component: RoomView, props: true },
    { path: "/rooms/:roomCode/history", name: "room-history", component: RoomView, props: true },
    { path: "/rooms/:roomCode/replay/:matchId", name: "room-replay", component: RoomView, props: true }
  ]
});

export default router;
