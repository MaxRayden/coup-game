import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useGameActions } from "@/hooks/useGameActions";
import { useGameConnection, type UseGameConnectionResult } from "@/hooks/useGameConnection";

type GameActions = ReturnType<typeof useGameActions>;

export type GameContextValue = UseGameConnectionResult & {
  actions: GameActions;
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const connection = useGameConnection();
  const actions = useGameActions(connection.socket);

  const value = useMemo(
    () => ({
      ...connection,
      actions,
    }),
    [connection, actions]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame deve ser usado dentro de GameProvider.");
  }
  return ctx;
}
