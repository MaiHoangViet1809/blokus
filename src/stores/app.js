import { defineStore } from "pinia";
import { io } from "socket.io-client";

const API_HEADERS = {
  "Content-Type": "application/json"
};

export const useAppStore = defineStore("app", {
  state: () => ({
    deviceToken: localStorage.getItem("blokus-device-token") || "",
    sessionToken: localStorage.getItem("blokus-session-token") || "",
    profiles: [],
    session: null,
    rooms: [],
    room: null,
    match: null,
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
      if (!state.match || !state.session) return null;
      return state.match.players.find((player) => player.profileId === state.session.profileId) || null;
    }
  },
  actions: {
    persistTokens() {
      if (this.deviceToken) localStorage.setItem("blokus-device-token", this.deviceToken);
      if (this.sessionToken) localStorage.setItem("blokus-session-token", this.sessionToken);
      if (!this.sessionToken) localStorage.removeItem("blokus-session-token");
    },
    async api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: {
          ...API_HEADERS,
          "x-device-token": this.deviceToken,
          "x-session-token": this.sessionToken,
          ...(options.headers || {})
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }
      if (data.deviceToken) this.deviceToken = data.deviceToken;
      if (data.sessionToken !== undefined) this.sessionToken = data.sessionToken || "";
      this.persistTokens();
      return data;
    },
    applyBootstrap(data) {
      this.deviceToken = data.deviceToken || this.deviceToken;
      this.sessionToken = data.sessionToken || "";
      this.session = data.session || null;
      this.profiles = data.profiles || [];
      this.rooms = data.rooms || [];
      this.room = data.room || null;
      this.match = data.match || null;
      this.persistTokens();
    },
    async bootstrap() {
      this.loading = true;
      try {
        const data = await this.api("/api/bootstrap", { method: "GET" });
        this.applyBootstrap(data);
        this.ensureSocket();
      } finally {
        this.loading = false;
        this.hydrationDone = true;
      }
    },
    ensureSocket() {
      if (this.socket) return;
      this.socket = io("/", {
        autoConnect: false,
        auth: () => ({
          sessionToken: this.sessionToken,
          deviceToken: this.deviceToken
        })
      });
      this.socket.on("connect", () => {
        this.connected = true;
        this.socket.emit("session:resume");
      });
      this.socket.on("disconnect", () => {
        this.connected = false;
      });
      this.socket.on("state:room", (room) => {
        if (this.room?.code === room.code) {
          this.room = room;
        }
        this.fetchRooms();
      });
      this.socket.on("state:match", (match) => {
        if (this.room?.code === match.roomCode) {
          this.match = match;
        }
      });
      this.socket.on("error", (payload) => {
        this.error = payload?.message || "Unexpected error";
      });
      this.socket.connect();
    },
    async fetchRooms() {
      const data = await this.api("/api/rooms", { method: "GET" });
      this.rooms = data.rooms || [];
    },
    async fetchRoom(roomCode) {
      const data = await this.api(`/api/rooms/${roomCode}`, { method: "GET" });
      this.room = data.room;
      this.match = data.match;
      return data;
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
    },
    emit(event, payload = {}) {
      this.error = "";
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          reject(new Error("Socket not connected"));
          return;
        }
        this.socket.timeout(5000).emit(event, payload, (err, response) => {
          if (err) {
            reject(new Error("Timed out"));
            return;
          }
          if (!response?.ok) {
            const message = response?.message || "Command failed";
            this.error = message;
            reject(new Error(message));
            return;
          }
          if (response.room) this.room = response.room;
          if (response.match !== undefined) this.match = response.match;
          if (response.rooms) this.rooms = response.rooms;
          resolve(response);
        });
      });
    },
    async createRoom(title, isPublic) {
      const response = await this.emit("room:create", { title, isPublic });
      return response.room;
    },
    async joinRoom(roomCode) {
      return this.emit("room:join", { roomCode });
    },
    async watchRoom(roomCode) {
      return this.emit("room:watch", { roomCode });
    },
    async leaveRoom() {
      const roomCode = this.room?.code;
      const response = await this.emit("room:leave", { roomCode });
      this.room = null;
      this.match = null;
      return response;
    },
    async setReady(ready) {
      return this.emit("room:set-ready", { roomCode: this.room?.code, ready });
    },
    async startRoom() {
      return this.emit("room:start", { roomCode: this.room?.code });
    },
    async placeMove(move) {
      return this.emit("match:place", { roomCode: this.room?.code, move });
    },
    async passTurn() {
      return this.emit("match:pass", { roomCode: this.room?.code });
    },
    async rematch() {
      return this.emit("match:rematch", { roomCode: this.room?.code });
    }
  }
});
