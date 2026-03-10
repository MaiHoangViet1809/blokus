import { defineStore } from "pinia";
import { io } from "socket.io-client";

const API_HEADERS = {
  "Content-Type": "application/json"
};

const CLIENT_INSTANCE_STORAGE_KEY = "blokus-client-instance-id";
const LEGACY_BROWSER_TOKEN_KEY = "blokus-device-token";
const LEGACY_SESSION_TOKEN_KEY = "blokus-session-token";
const ACTIVE_GAME_STORAGE_KEY = "board-platform-active-game";

function makeClientInstanceId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `client_${crypto.randomUUID()}`;
  }
  return `client_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export const useAppStore = defineStore("app", {
  state: () => ({
    legacyBrowserToken: localStorage.getItem(LEGACY_BROWSER_TOKEN_KEY) || "",
    clientInstanceId: sessionStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY) || "",
    activeGameType: localStorage.getItem(ACTIVE_GAME_STORAGE_KEY) || "blokus",
    profiles: [],
    session: null,
    rooms: [],
    leaderboard: [],
    recentMatches: [],
    room: null,
    match: null,
    gameView: null,
    replay: null,
    socket: null,
    connected: false,
    loading: false,
    error: "",
    hydrationDone: false
  }),
  getters: {
    activeProfile(state) {
      if (!state.session) return null;
      return {
        id: state.session.profileId,
        name: state.session.profileName
      };
    },
    currentMember(state) {
      if (!state.room || !state.session) return null;
      return state.room.members.find((member) => member.profileId === state.session.profileId) || null;
    },
    currentMatchPlayer(state) {
      if (!state.gameView || !state.session) return null;
      return state.gameView.players?.find((player) => player.profileId === state.session.profileId) || null;
    }
  },
  actions: {
    ensureClientInstanceId() {
      if (!this.clientInstanceId) {
        this.clientInstanceId = makeClientInstanceId();
        sessionStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, this.clientInstanceId);
      }
      return this.clientInstanceId;
    },
    syncClientInstanceId(nextId) {
      const normalized = String(nextId || "").trim();
      if (!normalized) return this.ensureClientInstanceId();
      if (normalized !== this.clientInstanceId) {
        this.clientInstanceId = normalized;
        sessionStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, normalized);
      }
      if (this.socket) {
        this.socket.auth = {
          clientInstanceId: normalized,
          browserTokenFallback: this.legacyBrowserToken
        };
      }
      return normalized;
    },
    clearLegacySessionToken() {
      localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
    },
    setActiveGameType(gameType) {
      const normalized = String(gameType || "").trim() || "blokus";
      this.activeGameType = normalized;
      localStorage.setItem(ACTIVE_GAME_STORAGE_KEY, normalized);
      return normalized;
    },
    async api(path, options = {}) {
      const response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers: {
          ...API_HEADERS,
          "x-client-instance-id": this.ensureClientInstanceId(),
          ...(this.legacyBrowserToken
            ? { "x-browser-token-fallback": this.legacyBrowserToken }
            : {}),
          ...(options.headers || {})
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }
      if (data.clientInstanceId) {
        this.syncClientInstanceId(data.clientInstanceId);
      }
      this.clearLegacySessionToken();
      return data;
    },
    applyBootstrap(data) {
      if (data.clientInstanceId) {
        this.syncClientInstanceId(data.clientInstanceId);
      } else {
        this.ensureClientInstanceId();
      }
      this.session = data.session || null;
      this.profiles = data.profiles || [];
      this.rooms = data.rooms || [];
      this.leaderboard = data.leaderboard || [];
      this.recentMatches = data.recentMatches || [];
      this.room = data.room || null;
      this.match = data.match || null;
      this.gameView = data.gameView || null;
    },
    async bootstrap() {
      this.loading = true;
      try {
        const data = await this.api("/api/bootstrap", { method: "GET" });
        this.applyBootstrap(data);
        this.ensureSocket();
        await this.waitForSocketReady().catch(() => {});
      } finally {
        this.loading = false;
        this.hydrationDone = true;
      }
    },
    ensureSocket() {
      const clientInstanceId = this.ensureClientInstanceId();
      if (!this.socket) {
        this.socket = io("/", {
          autoConnect: false,
          withCredentials: true,
          auth: () => ({
            clientInstanceId,
            browserTokenFallback: this.legacyBrowserToken
          })
        });
        this.socket.on("connect", () => {
          this.connected = true;
          this.socket.emit("session:resume");
        });
        this.socket.on("disconnect", () => {
          this.connected = false;
        });
        this.socket.on("connect_error", (error) => {
          this.connected = false;
          this.error = error.message || "Realtime connection failed";
        });
        this.socket.on("state:room", (room) => {
          if (this.room?.code === room.code) {
            this.room = room;
          }
          this.fetchRooms().catch(() => {});
        });
        this.socket.on("state:room-view", (payload) => {
          if (!payload?.room || this.room?.code !== payload.room.code) return;
          this.room = payload.room;
          if (payload.gameView !== undefined) {
            this.gameView = payload.gameView;
          }
        });
        this.socket.on("state:match", (payload) => {
          if (this.room?.code === payload?.roomCode) {
            this.match = payload.match || null;
            this.gameView = payload.gameView || null;
          }
          if (payload?.match?.status === "finished") {
            this.fetchLeaderboard().catch(() => {});
            this.fetchRecentMatches().catch(() => {});
          }
        });
        this.socket.on("error", (payload) => {
          this.error = payload?.message || "Unexpected error";
        });
      }
      this.socket.auth = {
        clientInstanceId: this.clientInstanceId,
        browserTokenFallback: this.legacyBrowserToken
      };
      if (!this.socket.connected && !this.socket.active) {
        this.socket.connect();
      }
      return this.socket;
    },
    waitForSocketReady() {
      const socket = this.ensureSocket();
      if (socket.connected) {
        return Promise.resolve(socket);
      }
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          socket.off("connect", handleConnect);
          socket.off("connect_error", handleError);
        };
        const handleConnect = () => {
          cleanup();
          resolve(socket);
        };
        const handleError = (error) => {
          cleanup();
          reject(error);
        };
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error("Timed out"));
        }, 5000);
        socket.on("connect", handleConnect);
        socket.on("connect_error", handleError);
        if (!socket.active) {
          socket.connect();
        }
      });
    },
    async fetchRooms(gameType = this.activeGameType) {
      const query = gameType ? `?gameType=${encodeURIComponent(gameType)}` : "";
      const data = await this.api(`/api/rooms${query}`, { method: "GET" });
      this.rooms = data.rooms || [];
      return data;
    },
    async fetchLeaderboard() {
      const data = await this.api("/api/leaderboard", { method: "GET" });
      this.leaderboard = data.leaderboard || [];
      return data;
    },
    async fetchRecentMatches() {
      const data = await this.api("/api/matches/recent", { method: "GET" });
      this.recentMatches = data.matches || [];
      return data;
    },
    async fetchRoom(roomCode) {
      const data = await this.api(`/api/rooms/${roomCode}`, { method: "GET" });
      this.room = data.room;
      this.match = data.match;
      this.gameView = data.gameView || null;
      this.replay = null;
      if (data.room?.gameType) {
        this.setActiveGameType(data.room.gameType);
      }
      return data;
    },
    async fetchMatch(matchId) {
      const data = await this.api(`/api/matches/${matchId}/live`, { method: "GET" });
      this.room = data.room || null;
      this.match = data.match || null;
      this.gameView = data.gameView || null;
      if (data.room?.gameType) {
        this.setActiveGameType(data.room.gameType);
      }
      return data;
    },
    async fetchReplay(matchId) {
      const data = await this.api(`/api/matches/${matchId}`, { method: "GET" });
      this.replay = data.replay || null;
      return data.replay;
    },
    async createProfile(name) {
      const data = await this.api("/api/profiles", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      this.profiles = data.profiles || this.profiles;
      return data.profile;
    },
    async selectProfile(profileId) {
      const data = await this.api("/api/session/select-profile", {
        method: "POST",
        body: JSON.stringify({ profileId })
      });
      this.applyBootstrap(data);
      this.ensureSocket();
      return data.session;
    },
    async emit(event, payload = {}) {
      this.error = "";
      const socket = this.ensureSocket();
      await this.waitForSocketReady();
      return new Promise((resolve, reject) => {
        socket.timeout(5000).emit(event, payload, (err, response) => {
          if (err) {
            this.error = "Timed out";
            reject(new Error("Timed out"));
            return;
          }
          if (!response?.ok) {
            const message = response?.message || "Command failed";
            this.error = message;
            reject(new Error(message));
            return;
          }
          if (response.room !== undefined) this.room = response.room;
          if (response.match !== undefined) this.match = response.match;
          if (response.gameView !== undefined) this.gameView = response.gameView;
          if (response.rooms) this.rooms = response.rooms;
          if (response.leaderboard) this.leaderboard = response.leaderboard;
          if (response.recentMatches) this.recentMatches = response.recentMatches;
          resolve(response);
        });
      });
    },
    async createRoom(title, isPublic, gameType = "blokus", config = {}) {
      const response = await this.emit("room:create", { title, isPublic, gameType, config });
      return response.room;
    },
    async joinRoom(roomCode, seatIndex = null) {
      return this.emit("room:join", { roomCode, seatIndex });
    },
    async watchRoom(roomCode) {
      return this.emit("room:watch", { roomCode });
    },
    async leaveRoom() {
      const roomCode = this.room?.code;
      const response = await this.emit("room:leave", { roomCode });
      this.room = null;
      this.match = null;
      this.gameView = null;
      this.replay = null;
      return response;
    },
    async setReady(ready) {
      return this.emit("room:set-ready", { roomCode: this.room?.code, ready });
    },
    async startRoom() {
      return this.emit("room:start", { roomCode: this.room?.code });
    },
    async placeMove(move) {
      return this.emit("match:command", {
        roomCode: this.room?.code,
        command: {
          commandType: "place_piece",
          commandPayload: move
        }
      });
    },
    async rematch() {
      return this.emit("match:rematch", { roomCode: this.room?.code });
    },
    async governMatch(actionType) {
      return this.emit("match:governance", {
        roomCode: this.room?.code,
        actionType
      });
    }
  }
});
