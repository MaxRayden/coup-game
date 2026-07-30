import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGame } from "@/context/GameContext";
import { ROUTES } from "@/routes/paths";
import { resolveGameRoute } from "@/routes/resolveGameRoute";

const INTRO_ROUTES = new Set<string>([ROUTES.home, ROUTES.welcome]);

/** Mantém a URL alinhada ao estado da partida (fase, assento, pedido pendente). */
export default function GameRouteSync() {
  const { state, me, reclaiming } = useGame();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!state) return;

    const target = resolveGameRoute(state, me, { reclaiming });
    const path = location.pathname;

    if (path === ROUTES.home) return;

    if (INTRO_ROUTES.has(path) && target !== ROUTES.welcome) {
      navigate(target, { replace: true });
      return;
    }

    if (path === ROUTES.lobby && target === ROUTES.game) {
      navigate(ROUTES.game, { replace: true });
      return;
    }

    if (path.startsWith("/partida") && target === ROUTES.lobby) {
      navigate(ROUTES.lobby, { replace: true });
      return;
    }

    if (path === ROUTES.game && target === ROUTES.gameJoin) {
      navigate(ROUTES.gameJoin, { replace: true });
      return;
    }

    if (path === ROUTES.gameJoin && target === ROUTES.game) {
      navigate(ROUTES.game, { replace: true });
    }
  }, [state, state?.phase, me, reclaiming, location.pathname, navigate]);

  return null;
}
