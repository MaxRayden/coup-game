import { useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import JoinGate from "@/components/lobby/JoinGate";
import { useGame } from "@/context/GameContext";
import { ROUTES } from "@/routes/paths";
import { resolveGameRoute } from "@/routes/resolveGameRoute";

export default function GameJoinPage() {
  const navigate = useNavigate();
  const { state, socket, me, reclaiming, joinNotice, handleJoined } = useGame();

  const onJoined = useCallback(
    (playerId: number | null) => {
      handleJoined(playerId);
      if (playerId != null) {
        navigate(ROUTES.game, { replace: true });
      }
    },
    [handleJoined, navigate]
  );

  if (!state || !socket) return null;

  if (state.phase !== "playing") {
    return <Navigate to={resolveGameRoute(state, me, { reclaiming })} replace />;
  }

  if (me) {
    return <Navigate to={ROUTES.game} replace />;
  }

  return (
    <AppShell intro>
      {reclaiming && (
        <div className="spectator-banner">Reconectando à partida…</div>
      )}
      {!reclaiming && (
        <JoinGate state={state} socket={socket} onJoined={onJoined} />
      )}
      {joinNotice && !me && <div className="spectator-banner">{joinNotice}</div>}
    </AppShell>
  );
}
