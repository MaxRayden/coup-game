import { useEffect, useMemo, useState } from "react";

const SESSION_KEY = "coup-session-id";
const NAME_KEY = "coup-player-name";
const REQUEST_KEY = "coup-join-request-id";

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

export default function JoinGate({ state, socket, onJoined }) {
  const [name, setName] = useState(() => sessionStorage.getItem(NAME_KEY) || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => {
    const raw = sessionStorage.getItem(REQUEST_KEY);
    return raw ? Number(raw) : null;
  });

  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const myRequest = (state.joinRequests ?? []).find((r) => r.id === requestId);
  const waiting = Boolean(myRequest);

  useEffect(() => {
    if (!socket) return;
    const onApproved = ({ playerId }) => {
      sessionStorage.removeItem(REQUEST_KEY);
      setRequestId(null);
      onJoined?.(playerId);
    };
    const onRejected = ({ error: msg }) => {
      sessionStorage.removeItem(REQUEST_KEY);
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

  // Pedido sumiu (ex.: limpeza) sem evento — volta ao formulário
  useEffect(() => {
    if (requestId == null) return;
    if (myRequest) return;
    const stillPending = (state.joinRequests ?? []).some((r) => r.id === requestId);
    if (!stillPending) {
      sessionStorage.removeItem(REQUEST_KEY);
      setRequestId(null);
    }
  }, [state.joinRequests, requestId, myRequest]);

  function requestJoin(e) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    const trimmed = name.trim();
    sessionStorage.setItem(NAME_KEY, trimmed);
    socket.emit("lobby:join", { name: trimmed, sessionId }, (result) => {
      setBusy(false);
      if (!result?.ok) {
        setError(result?.error || "Não foi possível pedir entrada.");
        return;
      }
      if (result.pending && result.requestId != null) {
        sessionStorage.setItem(REQUEST_KEY, String(result.requestId));
        setRequestId(result.requestId);
        return;
      }
      if (result.playerId != null) {
        sessionStorage.removeItem(REQUEST_KEY);
        setRequestId(null);
        onJoined?.(result.playerId);
      }
    });
  }

  function cancel() {
    setBusy(true);
    socket.emit("join:cancel", () => {
      setBusy(false);
      sessionStorage.removeItem(REQUEST_KEY);
      setRequestId(null);
    });
  }

  if (waiting) {
    return (
      <div className="join-gate">
        <div className="join-gate-card">
          <h2>Aguardando aprovação</h2>
          <p>
            Você pediu para entrar como <strong>{myRequest.name}</strong>. O admin
            precisa aprovar.
          </p>
          <button type="button" className="btn" disabled={busy} onClick={cancel}>
            Cancelar pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="join-gate">
      <div className="join-gate-card">
        <h2>Partida em andamento</h2>
        <p>Peça para entrar. O admin precisa aprovar sua entrada.</p>
        <form onSubmit={requestJoin}>
          <label className="field">
            <span>Seu nome</span>
            <input
              type="text"
              value={name}
              maxLength={24}
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
    </div>
  );
}

export function clearJoinRequestStorage() {
  sessionStorage.removeItem(REQUEST_KEY);
}
