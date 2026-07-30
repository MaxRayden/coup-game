import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import Lobby from "./components/Lobby.jsx";
import Table from "./components/Table.jsx";
import WinnerBanner from "./components/WinnerBanner.jsx";
import NetworkBar from "./components/NetworkBar.jsx";
import JoinGate, { clearJoinRequestStorage } from "./components/JoinGate.jsx";

const PLAYER_ID_KEY = "coup-player-id";

export default function App() {
  const [socket, setSocket] = useState(null);
  const [state, setState] = useState(null);
  const [serverInfo, setServerInfo] = useState(null);
  const [connected, setConnected] = useState(false);
  const [joinNotice, setJoinNotice] = useState("");
  const [myPlayerId, setMyPlayerId] = useState(() => {
    const raw = sessionStorage.getItem(PLAYER_ID_KEY);
    return raw ? Number(raw) : null;
  });

  const me = useMemo(() => {
    if (!state || myPlayerId == null) return null;
    return state.players.find((p) => p.id === myPlayerId) ?? null;
  }, [state, myPlayerId]);

  const handleJoined = useCallback((playerId) => {
    if (playerId == null) {
      sessionStorage.removeItem(PLAYER_ID_KEY);
      setMyPlayerId(null);
      return;
    }
    sessionStorage.setItem(PLAYER_ID_KEY, String(playerId));
    setMyPlayerId(playerId);
    clearJoinRequestStorage();
  }, []);

  useEffect(() => {
    const s = io({ transports: ["websocket", "polling"] });
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("game:state", (gameState) => {
      setState(gameState);
      setMyPlayerId((current) => {
        if (current == null) return current;
        const stillHere = gameState.players.some((p) => p.id === current);
        if (!stillHere && gameState.phase === "lobby") {
          sessionStorage.removeItem(PLAYER_ID_KEY);
          return null;
        }
        return current;
      });
    });
    s.on("server:info", (info) => setServerInfo(info));
    s.on("join:approved", ({ playerId }) => {
      handleJoined(playerId);
      setJoinNotice("");
    });
    s.on("join:rejected", ({ error }) => {
      clearJoinRequestStorage();
      setJoinNotice(error || "Pedido recusado.");
    });

    return () => {
      s.disconnect();
    };
  }, [handleJoined]);

  if (!state || !socket) {
    return (
      <div className="boot">
        <p>Conectando ao servidor…</p>
        {!connected && (
          <p className="boot-hint">Verifique se o servidor está rodando.</p>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <NetworkBar
        connected={connected}
        serverInfo={serverInfo}
        me={me}
        playerCount={state.players.length}
        phase={state.phase}
      />

      {state.phase === "lobby" && (
        <Lobby
          state={state}
          socket={socket}
          me={me}
          onJoined={handleJoined}
        />
      )}

      {(state.phase === "playing" || state.phase === "finished") && (
        <>
          {!me && state.phase === "playing" && (
            <JoinGate
              state={state}
              socket={socket}
              onJoined={handleJoined}
            />
          )}
          {!me && state.phase === "finished" && (
            <div className="spectator-banner">
              Partida encerrada. Aguarde o admin voltar ao lobby.
            </div>
          )}
          {joinNotice && !me && (
            <div className="spectator-banner">{joinNotice}</div>
          )}
          {(me || state.phase === "finished") && (
            <Table
              state={state}
              meId={me?.id ?? null}
              isAdmin={Boolean(me?.isAdmin)}
              onDeclareAction={(payload, cb) =>
                socket.emit("action:declare", payload, cb)
              }
              onBeginContest={(cb) => socket.emit("action:beginContest", cb)}
              onCancelContest={() => socket.emit("action:cancelContest")}
              onContest={(reason, cb) =>
                socket.emit("action:contest", { reason }, cb)
              }
              onResolve={(payload, cb) =>
                socket.emit("action:resolve", payload, cb)
              }
              onResolveCounter={(payload, cb) =>
                socket.emit("action:resolveCounter", payload, cb)
              }
              onChooseDiscard={(cardId, cb) =>
                socket.emit("action:chooseDiscard", { cardId }, cb)
              }
              onNextTurn={() =>
                socket.emit("turn:next", (result) => {
                  if (!result?.ok && result?.error) window.alert(result.error);
                })
              }
              onEndGame={() =>
                socket.emit("game:end", (result) => {
                  if (!result?.ok && result?.error) window.alert(result.error);
                })
              }
              onApproveJoin={(requestId) =>
                socket.emit("join:approve", { requestId }, (result) => {
                  if (!result?.ok && result?.error) window.alert(result.error);
                })
              }
              onRejectJoin={(requestId) =>
                socket.emit("join:reject", { requestId }, (result) => {
                  if (!result?.ok && result?.error) window.alert(result.error);
                })
              }
              onSendChat={(text) => socket.emit("chat:send", { text })}
            />
          )}
        </>
      )}

      {state.phase === "finished" && (
        <WinnerBanner
          winner={state.players.find((p) => p.id === state.winnerId)}
          endedByAdmin={Boolean(state.endedByAdmin)}
          isAdmin={Boolean(me?.isAdmin)}
          onRestart={() => {
            socket.emit("game:returnLobby", (result) => {
              if (!result?.ok) {
                window.alert(result?.error || "Só o admin pode voltar ao lobby.");
              }
            });
          }}
        />
      )}
    </div>
  );
}
