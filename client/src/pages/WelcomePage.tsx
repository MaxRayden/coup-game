import { useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import WelcomeScreen from "@/components/lobby/WelcomeScreen";
import { useGame } from "@/context/GameContext";
import {
  canAttemptReclaim,
  getJoinRequestId,
} from "@/lib/playerSession";
import { ROUTES } from "@/routes/paths";
import { resolveGameRoute } from "@/routes/resolveGameRoute";

export default function WelcomePage() {
  const navigate = useNavigate();
  const { state, socket, me, reclaiming, handleJoined } = useGame();

  const skipWelcome =
    Boolean(me) ||
    reclaiming ||
    canAttemptReclaim() ||
    getJoinRequestId() != null;

  const onJoined = useCallback(
    (playerId: number | null, pending = false) => {
      if (playerId != null) handleJoined(playerId);
      else if (!pending) handleJoined(null);

      if (pending) {
        navigate(ROUTES.gameJoin, { replace: true });
        return;
      }

      if (playerId != null && state) {
        navigate(state.phase === "lobby" ? ROUTES.lobby : ROUTES.game, {
          replace: true,
        });
      }
    },
    [handleJoined, navigate, state]
  );

  if (skipWelcome) {
    return (
      <Navigate to={resolveGameRoute(state, me, { reclaiming })} replace />
    );
  }

  if (!state || !socket) return null;

  return (
    <AppShell intro>
      <WelcomeScreen state={state} socket={socket} onJoined={onJoined} />
    </AppShell>
  );
}
