import { useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Lobby from "@/components/lobby/Lobby";
import { useGame } from "@/context/GameContext";
import { ROUTES } from "@/routes/paths";
import { resolveGameRoute } from "@/routes/resolveGameRoute";

export default function LobbyPage() {
  const navigate = useNavigate();
  const { state, socket, me, reclaiming, handleJoined } = useGame();

  const onJoined = useCallback(
    (playerId: number | null) => {
      handleJoined(playerId);
      if (playerId == null) {
        navigate(ROUTES.welcome, { replace: true });
      }
    },
    [handleJoined, navigate]
  );

  if (!state || !socket) return null;

  if (state.phase !== "lobby") {
    return <Navigate to={resolveGameRoute(state, me, { reclaiming })} replace />;
  }

  return (
    <AppShell intro>
      <Lobby state={state} socket={socket} me={me} onJoined={onJoined} />
    </AppShell>
  );
}
