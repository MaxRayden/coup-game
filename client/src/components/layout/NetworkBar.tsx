import { useEffect, useRef, useState } from "react";
import type { GamePhase, Player, ServerInfo } from "@shared/types/game";

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: "Lobby",
  playing: "Em jogo",
  finished: "Encerrada",
};

export interface NetworkBarProps {
  connected: boolean;
  serverInfo: ServerInfo | null;
  me: Player | null;
  playerCount: number;
  phase: GamePhase;
  showGameOptions?: boolean;
  onEndGame?: () => void;
}

export default function NetworkBar({
  connected,
  serverInfo,
  me,
  playerCount,
  phase,
  showGameOptions = false,
  onEndGame,
}: NetworkBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const addresses = serverInfo?.addresses ?? [];
  const displayPort =
    serverInfo?.devMode && serverInfo?.clientPort
      ? serverInfo.clientPort
      : (serverInfo?.port ?? 7000);
  const primary = addresses[0];
  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  function handleEndGame() {
    setMenuOpen(false);
    if (
      window.confirm("Encerrar a partida e mostrar o fim de jogo para todos?")
    ) {
      onEndGame?.();
    }
  }

  return (
    <header className="network-bar">
      <div className="network-brand">
        <span className="network-mark" aria-hidden />
        <div className="network-brand-text">
          <span className="network-title">Coup</span>
          <span className="network-sub">controle de partida</span>
        </div>
      </div>
      <div className="network-status">
        <span
          className={`dot ${connected ? "on" : "off"}`}
          title={connected ? "Conectado" : "Desconectado"}
        />
        {phase && (
          <span
            className={`phase-pill ${phase === "playing" ? "playing" : ""} ${
              phase === "finished" ? "finished" : ""
            }`}
          >
            {phaseLabel}
          </span>
        )}
        {me ? (
          <span className="network-url">
            {me.name}
            {me.isAdmin ? " · admin" : ""}
            {phase === "lobby" ? ` · ${playerCount} jogadores` : ""}
          </span>
        ) : primary ? (
          <span className="network-url">
            Rede: http://{primary.address}:{displayPort}
          </span>
        ) : (
          <span className="network-url">Aguardando IP da rede…</span>
        )}
        {showGameOptions && onEndGame && (
          <div className="network-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="network-menu-btn"
              aria-label="Opções"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="network-menu-icon" aria-hidden>
                ⋮
              </span>
            </button>
            {menuOpen && (
              <div className="network-dropdown" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="network-dropdown-item danger"
                  onClick={handleEndGame}
                >
                  Encerrar partida
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
