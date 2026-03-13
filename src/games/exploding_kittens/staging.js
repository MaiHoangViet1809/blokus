import { seatLabel } from "./shared.js";

function slotAt(players, seatIndex) {
  return players.find((player) => player.seatIndex === seatIndex) || null;
}

export function buildExplodingKittensStagingTableModel(gameView) {
  const players = gameView?.players || [];
  const maxPlayers = Number(gameView?.maxPlayers || 5);
  const presetLabel = gameView?.modeLabel || "Preset";

  return {
    extraColumns: [
      { key: "preset", label: "Preset" },
      { key: "seat", label: "Seat Order" }
    ],
    rows: Array.from({ length: maxPlayers }, (_, seatIndex) => {
      const player = slotAt(players, seatIndex);
      return {
        seatIndex,
        player,
        slotLabel: seatLabel(seatIndex),
        playerLabel: player?.name || "Open",
        controlLabel: player ? "Human" : "Open",
        readyLabel: player ? (player.isReady ? "Ready" : "Pending") : "-",
        statusLabel: player ? player.connectionState : "Empty",
        canClaimSeat: !player,
        canToggleReady: false,
        colorCell: {
          type: "text",
          text: presetLabel
        },
        cornerCell: {
          type: "text",
          text: seatIndex === 0 ? "First turn candidate" : `Seat ${seatIndex + 1}`
        }
      };
    })
  };
}
