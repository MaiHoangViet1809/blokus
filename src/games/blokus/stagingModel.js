function colorTakenByOther(player, colorIndex, players) {
  return players.some((entry) => entry.profileId !== player?.profileId && entry.colorIndex === colorIndex);
}

function slotAt(players, seatIndex) {
  return players.find((player) => player.seatIndex === seatIndex) || null;
}

export function buildBlokusStagingTableModel(gameView, sessionProfileId) {
  const players = gameView?.players || [];
  const colors = gameView?.colors || [];
  const maxPlayers = Number(gameView?.maxPlayers || 4);

  return {
    extraColumns: [
      { key: "color", label: "Color" },
      { key: "corner", label: "Starting Corner" }
    ],
    rows: Array.from({ length: maxPlayers }, (_, seatIndex) => {
      const player = slotAt(players, seatIndex);
      const isCurrentPlayer = player?.profileId === sessionProfileId;
      return {
        seatIndex,
        player,
        slotLabel: `Slot ${seatIndex + 1}`,
        playerLabel: player?.name || "Open",
        controlLabel: player ? "Human" : "Open",
        readyLabel: player ? (player.isReady ? "Ready" : "Pending") : "-",
        statusLabel: player ? player.connectionState : "Empty",
        canClaimSeat: !player,
        canToggleReady: isCurrentPlayer,
        colorCell: player
          ? {
              type: "picker",
              selectedColorIndex: player.colorIndex,
              options: colors.map((entry) => ({
                ...entry,
                blocked: colorTakenByOther(player, entry.colorIndex, players),
                disabled: !isCurrentPlayer || colorTakenByOther(player, entry.colorIndex, players)
              }))
            }
          : {
              type: "hint",
              text: "Choose after seat"
            },
        cornerCell: {
          type: "text",
          text: player?.cornerLabel || "Choose by color"
        }
      };
    })
  };
}
