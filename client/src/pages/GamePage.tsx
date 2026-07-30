import { Navigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import WinnerBanner from "@/components/game/WinnerBanner";
import Table from "@/components/table/Table";
import { useGame } from "@/context/GameContext";
import { ROUTES } from "@/routes/paths";

export default function GamePage() {
  const { state, me, reclaiming, joinNotice, actions } = useGame();

  if (!state) return null;

  if (state.phase === "lobby") {
    return <Navigate to={ROUTES.lobby} replace />;
  }

  if (!me && state.phase === "playing" && !reclaiming) {
    return <Navigate to={ROUTES.gameJoin} replace />;
  }

  return (
    <AppShell>
      {!me && state.phase === "playing" && reclaiming && (
        <div className="spectator-banner">Reconectando à partida…</div>
      )}
      {!me && state.phase === "finished" && (
        <div className="spectator-banner">
          Partida encerrada. Aguarde o admin voltar ao lobby.
        </div>
      )}
      {joinNotice && !me && <div className="spectator-banner">{joinNotice}</div>}

      {(me || state.phase === "finished") && (
        <Table
          state={state}
          meId={me?.id ?? null}
          isAdmin={Boolean(me?.isAdmin)}
          {...actions}
        />
      )}

      {state.phase === "finished" && (
        <WinnerBanner
          winner={state.players.find((p) => p.id === state.winnerId)}
          endedByAdmin={Boolean(state.endedByAdmin)}
          isAdmin={Boolean(me?.isAdmin)}
          onRestart={() => {
            actions.onReturnLobby((result) => {
              if (!result?.ok) {
                window.alert(result?.error || "Só o admin pode voltar ao lobby.");
              }
            });
          }}
        />
      )}
    </AppShell>
  );
}
