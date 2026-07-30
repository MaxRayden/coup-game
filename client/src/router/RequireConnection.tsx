import type { ReactNode } from "react";
import CoverArt from "@/components/layout/CoverArt";
import { useGame } from "@/context/GameContext";

export default function RequireConnection({ children }: { children: ReactNode }) {
  const { state, socket, connected, reclaiming } = useGame();

  if (!state || !socket) {
    return (
      <div className="boot">
        <CoverArt className="cover-art--boot" />
        <div className="boot-spinner" aria-hidden />
        <p className="boot-status">
          {reclaiming ? "Reconectando à partida…" : "Conectando ao servidor…"}
        </p>
        {!connected && (
          <p className="boot-hint">Verifique se o servidor está rodando.</p>
        )}
      </div>
    );
  }

  return children;
}
