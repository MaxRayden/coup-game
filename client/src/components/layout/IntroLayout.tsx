import type { ReactNode } from "react";
import type { GamePhase } from "@shared/types/game";
import { coverImg } from "@/components/layout/CoverArt";

export function lobbyStatusText(phase: GamePhase, playerCount: number): string {
  if (playerCount === 0) {
    return "Sala vazia — aguardando jogadores";
  }
  if (phase === "lobby") {
    return `${playerCount} no lobby · aguardando início`;
  }
  if (phase === "playing") {
    return `Partida ao vivo · ${playerCount} jogadores`;
  }
  return `Partida encerrada · ${playerCount} na mesa`;
}

export interface IntroLayoutProps {
  phase: GamePhase;
  playerCount: number;
  statusText?: string;
  children: ReactNode;
}

/** Layout hero + painel escuro (splash / início / lobby). */
export default function IntroLayout({
  phase,
  playerCount,
  statusText,
  children,
}: IntroLayoutProps) {
  const status = statusText ?? lobbyStatusText(phase, playerCount);

  return (
    <main className="welcome-screen">
      <div className="welcome-hero" aria-hidden>
        <img src={coverImg} alt="" className="welcome-hero-img" />
        <div className="welcome-hero-overlay" />
        <div className="welcome-hero-glow welcome-hero-glow--left" />
        <div className="welcome-hero-brand">
          <span className="welcome-hero-eyebrow">Controle de Partida</span>
          <span className="welcome-hero-logo">Coup</span>
        </div>
      </div>

      <div className="welcome-content">
        <div className="welcome-panel">
          <div className="welcome-status" data-phase={phase}>
            <span className="welcome-status-dot" />
            <span>{status}</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
