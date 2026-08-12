import { useState } from "react";

import type { GameState, Player } from "@shared/types/game";

import type { GameSocket } from "@/hooks/useGameConnection";

import IntroLayout from "@/components/layout/IntroLayout";

import {

  clearPlayerSession,

  getPlayerName,

  getSessionId,

  setPlayerName,

  setSeated,

} from "@/lib/playerSession";



export interface LobbyProps {

  state: GameState;

  socket: GameSocket;

  me: Player | null;

  onJoined: (playerId: number | null) => void;

}



export default function Lobby({ state, socket, me, onJoined }: LobbyProps) {

  const [name, setName] = useState(() => getPlayerName());

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);



  const sessionId = getSessionId();

  const isAdmin = Boolean(me?.isAdmin);

  const canStart = state.players.length >= state.minPlayers;

  const inLobby = state.players.some((p) => p.id === me?.id);



  function join(e?: React.FormEvent) {

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

      setSeated(true);

      onJoined(result.playerId ?? null);

    });

  }



  function leave() {

    clearPlayerSession();

    setBusy(true);

    setError("");

    socket.emit("lobby:leave", { sessionId }, () => {

      setBusy(false);

      onJoined(null);

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

      <IntroLayout

        phase={state.phase}

        playerCount={state.players.length}

        statusText="Partida em andamento"

      >

        <div className="welcome-step">

          <h1 className="welcome-heading">Partida em andamento</h1>

          <p className="welcome-lead">

            Aguarde o fim do jogo. O admin pode voltar todos ao lobby depois.

          </p>

        </div>

      </IntroLayout>

    );

  }



  if (!inLobby) {

    return (

      <IntroLayout phase={state.phase} playerCount={state.players.length}>

        <div className="welcome-step welcome-step--form">

          <h1 className="welcome-heading">Entrar na sala</h1>

          <p className="welcome-lead">

            Digite seu nome para entrar no lobby. Mínimo {state.minPlayers} jogadores

            para começar (máx. {state.maxPlayers}).

          </p>



          <form onSubmit={join}>

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

      </IntroLayout>

    );

  }



  return (

    <IntroLayout phase={state.phase} playerCount={state.players.length}>

      <div className="welcome-step">

        <h1 className="welcome-heading">Lobby</h1>

        <p className="welcome-lead">

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

          <button type="button" className="btn ghost welcome-back" disabled={busy} onClick={leave}>

            Sair do lobby

          </button>

        </div>

      </div>

    </IntroLayout>

  );

}


