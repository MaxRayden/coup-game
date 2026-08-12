import { useEffect, useMemo, useState } from "react";

import type { GameState } from "@shared/types/game";

import type { GameSocket } from "@/hooks/useGameConnection";

import IntroLayout from "@/components/layout/IntroLayout";

import {

  getJoinRequestId,

  getPlayerName,

  getSessionId,

  setJoinRequestId,

  setPlayerName,

  setSeated,

} from "@/lib/playerSession";



export interface JoinGateProps {

  state: GameState;

  socket: GameSocket;

  onJoined: (playerId: number | null) => void;

}



export default function JoinGate({ state, socket, onJoined }: JoinGateProps) {

  const [name, setName] = useState(() => getPlayerName());

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const [requestId, setRequestId] = useState<number | null>(() => getJoinRequestId());



  const sessionId = useMemo(() => getSessionId(), []);

  const myRequest = (state.joinRequests ?? []).find((r) => r.id === requestId);

  const waiting = Boolean(myRequest);



  useEffect(() => {

    if (!socket) return;

    const onApproved = ({ playerId }: { playerId: number }) => {

      setJoinRequestId(null);

      setRequestId(null);

      setSeated(true);

      onJoined(playerId);

    };

    const onRejected = ({ error: msg }: { error: string }) => {

      setJoinRequestId(null);

      setRequestId(null);

      setError(msg || "Pedido recusado pelo admin.");

    };

    socket.on("join:approved", onApproved);

    socket.on("join:rejected", onRejected);

    return () => {

      socket.off("join:approved", onApproved);

      socket.off("join:rejected", onRejected);

    };

  }, [socket, onJoined]);



  useEffect(() => {

    if (requestId == null) return;

    if (myRequest) return;

    const stillPending = (state.joinRequests ?? []).some((r) => r.id === requestId);

    if (!stillPending) {

      setJoinRequestId(null);

      setRequestId(null);

      setError("Seu pedido de entrada expirou ou foi removido. Peça novamente.");

    }

  }, [state.joinRequests, requestId, myRequest]);



  function requestJoin(e?: React.FormEvent) {

    e?.preventDefault();

    setError("");

    setBusy(true);

    const trimmed = name.trim();

    setPlayerName(trimmed);

    socket.emit("lobby:join", { name: trimmed, sessionId }, (result) => {

      setBusy(false);

      if (!result?.ok) {

        setError(result?.error || "Não foi possível pedir entrada.");

        return;

      }

      if (result.pending && result.requestId != null) {

        setJoinRequestId(result.requestId);

        setRequestId(result.requestId);

        return;

      }

      if (result.playerId != null) {

        setJoinRequestId(null);

        setRequestId(null);

        setSeated(true);

        onJoined(result.playerId);

      }

    });

  }



  function cancel() {

    setBusy(true);

    socket.emit("join:cancel", () => {

      setBusy(false);

      setJoinRequestId(null);

      setRequestId(null);

    });

  }



  if (waiting && myRequest) {

    return (

      <IntroLayout

        phase={state.phase}

        playerCount={state.players.length}

        statusText="Aguardando aprovação do admin"

      >

        <div className="welcome-step">

          <h1 className="welcome-heading">Aguardando aprovação</h1>

          <p className="welcome-lead">

            Você pediu para entrar como <strong>{myRequest.name}</strong>. O admin

            precisa aprovar sua entrada na partida.

          </p>

          <button type="button" className="btn ghost welcome-back" disabled={busy} onClick={cancel}>

            Cancelar pedido

          </button>

        </div>

      </IntroLayout>

    );

  }



  return (

    <IntroLayout

      phase={state.phase}

      playerCount={state.players.length}

      statusText="Partida em andamento"

    >

      <div className="welcome-step welcome-step--form">

        <h1 className="welcome-heading">Entrar na partida</h1>

        <p className="welcome-lead">

          Peça para entrar. O admin da mesa precisa aprovar sua entrada.

        </p>

        <form onSubmit={requestJoin}>

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

            Pedir para entrar

          </button>

        </form>

      </div>

    </IntroLayout>

  );

}



export function clearJoinRequestStorage(): void {

  setJoinRequestId(null);

}


