import type { GamePhase, GameState, Player } from "@shared/types/game";
import {
  canAttemptReclaim,
  getJoinRequestId,
} from "@/lib/playerSession";
import { ROUTES, type AppRoute } from "@/routes/paths";

/** Rota ideal com base no estado do jogo e no jogador local. */
export function resolveGameRoute(
  state: GameState | null,
  me: Player | null,
  options?: { reclaiming?: boolean }
): AppRoute {
  const reclaiming = options?.reclaiming ?? false;

  if (!state) return ROUTES.welcome;

  const hasSession =
    Boolean(me) ||
    canAttemptReclaim() ||
    getJoinRequestId() != null ||
    reclaiming;

  if (!hasSession) return ROUTES.welcome;

  if (!me && state.phase === "playing" && !reclaiming) {
    return ROUTES.gameJoin;
  }

  return routeForPhase(state.phase);
}

function routeForPhase(phase: GamePhase): AppRoute {
  if (phase === "lobby") return ROUTES.lobby;
  return ROUTES.game;
}
