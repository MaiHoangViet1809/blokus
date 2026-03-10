import { sideMeta } from "./shared.js";

function slotAt(players, seatIndex) {
  return players.find((player) => player.seatIndex === seatIndex) || null;
}

export function buildChessStagingTableModel(gameView) {
  const players = gameView?.players || [];
  const maxPlayers = Number(gameView?.maxPlayers || 2);

  return {
    extraColumns: [
      { key: "side", label: "Side" },
      { key: "tempo", label: "Tempo" }
    ],
    rows: Array.from({ length: maxPlayers }, (_, seatIndex) => {
      const player = slotAt(players, seatIndex);
      const side = sideMeta(seatIndex);
      return {
        seatIndex,
        player,
        slotLabel: `Seat ${seatIndex + 1}`,
        playerLabel: player?.name || "Open",
        controlLabel: player ? "Human" : "Open",
        readyLabel: player ? (player.isReady ? "Ready" : "Pending") : "-",
        statusLabel: player ? player.connectionState : "Empty",
        canClaimSeat: !player,
        canToggleReady: false,
        colorCell: {
          type: "text",
          text: side.name
        },
        cornerCell: {
          type: "text",
          text: side.turnNote
        }
      };
    })
  };
}
