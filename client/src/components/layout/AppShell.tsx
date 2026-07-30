import type { ReactNode } from "react";
import NetworkBar from "@/components/layout/NetworkBar";
import { useGame } from "@/context/GameContext";

export interface AppShellProps {
  children: ReactNode;
  intro?: boolean;
}

export default function AppShell({ children, intro = false }: AppShellProps) {
  const { connected, serverInfo, me, state, actions } = useGame();

  if (!state) return null;

  const showGameOptions = Boolean(me?.isAdmin && state.phase === "playing");

  return (
    <div className={intro ? "app app--intro" : "app app--game"}>
      {!intro && (
        <NetworkBar
          connected={connected}
          serverInfo={serverInfo}
          me={me}
          playerCount={state.players.length}
          phase={state.phase}
          showGameOptions={showGameOptions}
          onEndGame={actions.onEndGame}
        />
      )}
      {children}
    </div>
  );
}
