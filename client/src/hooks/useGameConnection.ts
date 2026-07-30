import { useCallback, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { GameState, Player, ServerInfo } from "@shared/types/game";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types/socket";
import {
  canAttemptReclaim,
  clearJoinRequestId,
  clearPlayerSession,
  getPlayerId,
  getSessionId,
  reclaimSeat,
  setPlayerId,
  setSeated,
} from "@/lib/playerSession";
import { getSocketServerUrl } from "@/lib/socketUrl";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface UseGameConnectionResult {
  socket: GameSocket | null;
  state: GameState | null;
  serverInfo: ServerInfo | null;
  connected: boolean;
  joinNotice: string;
  reclaiming: boolean;
  myPlayerId: number | null;
  me: Player | null;
  handleJoined: (playerId: number | null) => void;
}

export function useGameConnection(): UseGameConnectionResult {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [joinNotice, setJoinNotice] = useState("");
  const [reclaiming, setReclaiming] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<number | null>(() => getPlayerId());

  const me = useMemo(() => {
    if (!state || myPlayerId == null) return null;
    return state.players.find((p) => p.id === myPlayerId) ?? null;
  }, [state, myPlayerId]);

  const handleJoined = useCallback((playerId: number | null) => {
    if (playerId == null) {
      clearPlayerSession();
      setMyPlayerId(null);
      return;
    }
    setPlayerId(playerId);
    setSeated(true);
    setMyPlayerId(playerId);
    clearJoinRequestId();
  }, []);

  const tryReclaim = useCallback(
    (s: GameSocket) => {
      if (!s?.connected || !canAttemptReclaim()) return;
      setReclaiming(true);
      reclaimSeat(s)
        .then((playerId) => {
          if (playerId != null) handleJoined(playerId);
        })
        .finally(() => setReclaiming(false));
    },
    [handleJoined]
  );

  useEffect(() => {
    const s = io(getSocketServerUrl(), {
      transports: ["websocket", "polling"],
      auth: { sessionId: getSessionId() },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    }) as GameSocket;
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
    });
    s.on("disconnect", () => setConnected(false));
    s.on("game:state", (gameState) => {
      setState(gameState);
      setMyPlayerId((current) => {
        const stored = getPlayerId();
        const id = current ?? stored;
        if (id == null) return null;
        const stillHere = gameState.players.some((p) => p.id === id);
        if (!stillHere && gameState.phase === "lobby" && !canAttemptReclaim()) {
          clearPlayerSession();
          return null;
        }
        return stillHere ? id : current;
      });
    });
    s.on("server:info", (info) => setServerInfo(info));
    s.on("join:approved", ({ playerId }) => {
      handleJoined(playerId);
      setJoinNotice("");
    });
    s.on("join:rejected", ({ error }) => {
      clearJoinRequestId();
      setJoinNotice(error || "Pedido recusado.");
    });

    return () => {
      s.disconnect();
    };
  }, [handleJoined]);

  useEffect(() => {
    if (!socket?.connected || !state || me || reclaiming) return;
    if (!canAttemptReclaim()) return;

    const storedId = getPlayerId();
    if (state.phase === "playing") {
      const stillInGame =
        storedId != null && state.players.some((p) => p.id === storedId);
      if (!stillInGame) {
        setSeated(false);
        return;
      }
    }

    tryReclaim(socket);
  }, [socket, state?.phase, state?.players, me, reclaiming, tryReclaim]);

  return {
    socket,
    state,
    serverInfo,
    connected,
    joinNotice,
    reclaiming,
    myPlayerId,
    me,
    handleJoined,
  };
}
