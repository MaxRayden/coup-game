import { useEffect, useMemo, useRef, useState } from "react";

const SESSION_KEY = "coup-session-id";
const NAME_KEY = "coup-player-name";
const SEATED_KEY = "coup-seated";

function getOrCreateSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function Lobby({ state, socket, me, onJoined }) {
  const [name, setName] = useState(() => sessionStorage.getItem(NAME_KEY) || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const rejoinPending = useRef(false);
  const isAdmin = Boolean(me?.isAdmin);
  const canStart = state.players.length >= state.minPlayers;
  const inLobby = state.players.some((p) => p.id === me?.id);

  // Reclama assento ao reconectar / recarregar, só se o jogador não saiu de propósito
  useEffect(() => {
    if (!socket || state.phase !== "lobby") return;
    if (inLobby || rejoinPending.current) return;
    if (sessionStorage.getItem(SEATED_KEY) !== "1") return;
    const saved = sessionStorage.getItem(NAME_KEY);
    if (!saved) return;

    rejoinPending.current = true;
    socket.emit("lobby:join", { name: saved, sessionId }, (result) => {
      rejoinPending.current = false;
      if (result?.ok) {
        onJoined?.(result.playerId);
      } else {
        sessionStorage.removeItem(SEATED_KEY);
      }
    });
  }, [socket, state.phase, state.players.length, sessionId, inLobby, onJoined]);

  function join(e) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    const trimmed = name.trim();
    sessionStorage.setItem(NAME_KEY, trimmed);
    socket.emit("lobby:join", { name: trimmed, sessionId }, (result) => {
      setBusy(false);
      if (!result?.ok) {
        setError(result?.error || "Não foi possível entrar.");
        return;
      }
      sessionStorage.setItem(SEATED_KEY, "1");
      onJoined?.(result.playerId);
    });
  }

  function leave() {
    // Limpa antes do emit: o broadcast do servidor chega antes do ack
    sessionStorage.removeItem(SEATED_KEY);
    setBusy(true);
    setError("");
    socket.emit("lobby:leave", { sessionId }, () => {
      setBusy(false);
      onJoined?.(null);
    });
  }

  function start() {
    setError("");
    setBusy(true);
    socket.emit("lobby:start", (result) => {
      setBusy(false);
      if (!result?.ok) setError(result?.error || "Não foi possível iniciar.");
    });
  }

  if (state.phase !== "lobby") {
    return (
      <main className="setup">
        <div className="setup-panel">
          <h1 className="setup-heading">Partida em andamento</h1>
          <p className="setup-lead">
            Aguarde o fim do jogo. O admin pode voltar todos ao lobby depois.
          </p>
        </div>
      </main>
    );
  }

  if (!inLobby) {
    return (
      <main className="setup">
        <div className="setup-panel">
          <h1 className="setup-heading">Entrar na sala</h1>
          <p className="setup-lead">
            Digite seu nome para entrar no lobby. Mínimo {state.minPlayers} jogadores
            para começar (máx. {state.maxPlayers}).
          </p>

          <form onSubmit={join}>
            <label className="field">
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
              Entrar no lobby
            </button>
          </form>

          {state.players.length > 0 && (
            <div className="lobby-preview">
              <p className="panel-label">Já na sala ({state.players.length})</p>
              <ul className="lobby-list">
                {state.players.map((p) => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    {p.isAdmin && <em className="admin-tag">admin</em>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="setup">
      <div className="setup-panel">
        <h1 className="setup-heading">Lobby</h1>
        <p className="setup-lead">
          Você entrou como <strong>{me?.name}</strong>
          {isAdmin ? " (admin da sala)" : ""}. Aguardando jogadores…
        </p>

        <ul className="lobby-list big">
          {state.players.map((p) => (
            <li key={p.id} className={p.id === me?.id ? "is-me" : ""}>
              <span>{p.name}</span>
              <span className="lobby-meta">
                {p.id === me?.id && <em>você</em>}
                {p.isAdmin && <em className="admin-tag">admin</em>}
              </span>
            </li>
          ))}
        </ul>

        <p className="lobby-count">
          {state.players.length} / {state.maxPlayers} jogadores
          {!canStart && (
            <span>
              {" "}
              — faltam {Math.max(0, state.minPlayers - state.players.length)} para
              iniciar
            </span>
          )}
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="lobby-actions">
          {isAdmin ? (
            <button
              type="button"
              className="btn primary setup-start"
              disabled={busy || !canStart}
              onClick={start}
            >
              Iniciar partida
            </button>
          ) : (
            <p className="lobby-wait">Aguardando o admin iniciar a partida.</p>
          )}
          <button type="button" className="btn" disabled={busy} onClick={leave}>
            Sair do lobby
          </button>
        </div>
      </div>
    </main>
  );
}
