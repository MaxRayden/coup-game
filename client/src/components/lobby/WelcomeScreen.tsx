import { useState } from "react";
import type { GameState } from "@shared/types/game";
import type { GameSocket } from "@/hooks/useGameConnection";
import IntroLayout from "@/components/layout/IntroLayout";
import {
  getPlayerName,
  getSessionId,
  setJoinRequestId,
  setPlayerName,
  setSeated,
} from "@/lib/playerSession";

export type WelcomeMode = "choice" | "join" | "create";

export interface WelcomeScreenProps {
  state: GameState;
  socket: GameSocket;
  onJoined: (playerId: number | null, pending?: boolean) => void;
}

function hasActiveLobby(state: GameState): boolean {
  return state.players.length > 0 || state.phase !== "lobby";
}

export default function WelcomeScreen({ state, socket, onJoined }: WelcomeScreenProps) {
  const [mode, setMode] = useState<WelcomeMode>("choice");
  const [name, setName] = useState(() => getPlayerName());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sessionId = getSessionId();
  const activeLobby = hasActiveLobby(state);

  function joinLobby(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    const trimmed = name.trim();
    setPlayerName(trimmed);
    socket.emit("lobby:join", { name: trimmed, sessionId }, (result) => {
      setBusy(false);
      if (!result?.ok) {
        setError(result?.error || "Não foi possível entrar.");
        return;
      }
      if (result.pending && result.requestId != null) {
        setJoinRequestId(result.requestId);
        onJoined(null, true);
        return;
      }
      if (result.playerId != null) {
        setSeated(true);
        onJoined(result.playerId);
      }
    });
  }

  function createLobby(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Digite um nome.");
      return;
    }

    if (activeLobby) {
      const message =
        state.phase === "playing"
          ? "Há uma partida em andamento. Criar um lobby novo irá encerrar a mesa atual para todos. Continuar?"
          : "Já existe uma sala com jogadores. Criar um lobby novo irá limpar a sala atual. Continuar?";
      if (!window.confirm(message)) return;
    }

    setError("");
    setBusy(true);
    setPlayerName(trimmed);
    socket.emit("lobby:create", { name: trimmed, sessionId }, (result) => {
      setBusy(false);
      if (!result?.ok) {
        setError(result?.error || "Não foi possível criar o lobby.");
        return;
      }
      if (result.playerId != null) {
        setSeated(true);
        onJoined(result.playerId);
      }
    });
  }

  return (
    <IntroLayout phase={state.phase} playerCount={state.players.length}>
      {mode === "choice" && (
        <div key="choice" className="welcome-step welcome-step--choice">
          <h1 className="welcome-heading">Escolha como entrar</h1>
          <p className="welcome-lead">
            Jogue Coup na mesa — moedas, cartas e turnos sincronizados em tempo real.
          </p>

          <div className="welcome-actions">
            <button
              type="button"
              className="welcome-action welcome-action--primary"
              onClick={() => {
                setError("");
                setMode("join");
              }}
            >
              <span className="welcome-action-icon" aria-hidden>
                →
              </span>
              <span className="welcome-action-body">
                <span className="welcome-action-title">Entrar em lobby existente</span>
                <span className="welcome-action-hint">
                  {activeLobby
                    ? "Junte-se à sala aberta neste servidor"
                    : "Entre na sala — se vazia, você será o admin"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="welcome-action"
              onClick={() => {
                setError("");
                setMode("create");
              }}
            >
              <span className="welcome-action-icon" aria-hidden>
                +
              </span>
              <span className="welcome-action-body">
                <span className="welcome-action-title">Criar lobby novo</span>
                <span className="welcome-action-hint">
                  Sala do zero — você comanda como admin
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div key="join" className="welcome-step welcome-step--form">
          <h1 className="welcome-heading">Entrar na sala</h1>
          <p className="welcome-lead">
            {state.phase === "playing"
              ? "Partida em andamento — o admin precisará aprovar sua entrada."
              : `Mínimo ${state.minPlayers} jogadores para iniciar (máx. ${state.maxPlayers}).`}
          </p>
          <form onSubmit={joinLobby}>
            <label className="field welcome-field">
              <span>Seu nome</span>
              <input
                type="text"
                value={name}
                maxLength={24}
                autoFocus
                placeholder="Ex.: Ana"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn primary setup-start"
              disabled={busy || !name.trim()}
            >
              Entrar
            </button>
          </form>
          <button
            type="button"
            className="btn ghost welcome-back"
            disabled={busy}
            onClick={() => {
              setError("");
              setMode("choice");
            }}
          >
            Voltar
          </button>
        </div>
      )}

      {mode === "create" && (
        <div key="create" className="welcome-step welcome-step--form">
          <h1 className="welcome-heading">Criar lobby novo</h1>
          <p className="welcome-lead">
            Você será o admin. Convide os jogadores para o mesmo endereço deste site.
          </p>
          {activeLobby && (
            <p className="welcome-warning">
              Isso substituirá a sala atual
              {state.phase === "playing" ? " e encerrará a partida em andamento" : ""}.
            </p>
          )}
          <form onSubmit={createLobby}>
            <label className="field welcome-field">
              <span>Seu nome</span>
              <input
                type="text"
                value={name}
                maxLength={24}
                autoFocus
                placeholder="Ex.: Ana"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button
              type="submit"
              className="btn primary setup-start"
              disabled={busy || !name.trim()}
            >
              Criar lobby
            </button>
          </form>
          <button
            type="button"
            className="btn ghost welcome-back"
            disabled={busy}
            onClick={() => {
              setError("");
              setMode("choice");
            }}
          >
            Voltar
          </button>
        </div>
      )}
    </IntroLayout>
  );
}
