import type { Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@shared/types/socket";

const SESSION_KEY = "coup-session-id";
const NAME_KEY = "coup-player-name";
const PLAYER_ID_KEY = "coup-player-id";
const SEATED_KEY = "coup-seated";
const REQUEST_KEY = "coup-join-request-id";

const LEGACY_SESSION_KEYS = [
  [SESSION_KEY, SESSION_KEY],
  [NAME_KEY, NAME_KEY],
  [PLAYER_ID_KEY, PLAYER_ID_KEY],
  [SEATED_KEY, SEATED_KEY],
  [REQUEST_KEY, REQUEST_KEY],
] as const;

let migrated = false;

function migrateFromSessionStorage(): void {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    for (const [key] of LEGACY_SESSION_KEYS) {
      const legacy = sessionStorage.getItem(key);
      if (legacy && !localStorage.getItem(key)) {
        localStorage.setItem(key, legacy);
      }
    }
  } catch {
    // ignore quota / private mode
  }
}

function read(key: string): string | null {
  migrateFromSessionStorage();
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  migrateFromSessionStorage();
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getSessionId(): string {
  let id = read(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    write(SESSION_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  return read(NAME_KEY) || "";
}

export function setPlayerName(name: string): void {
  write(NAME_KEY, String(name ?? "").trim());
}

export function getPlayerId(): number | null {
  const raw = read(PLAYER_ID_KEY);
  return raw ? Number(raw) : null;
}

export function setPlayerId(playerId: number | null): void {
  if (playerId == null) write(PLAYER_ID_KEY, null);
  else write(PLAYER_ID_KEY, String(playerId));
}

export function isSeated(): boolean {
  return read(SEATED_KEY) === "1";
}

export function setSeated(seated: boolean): void {
  write(SEATED_KEY, seated ? "1" : null);
}

export function getJoinRequestId(): number | null {
  const raw = read(REQUEST_KEY);
  return raw ? Number(raw) : null;
}

export function setJoinRequestId(requestId: number | null): void {
  if (requestId == null) write(REQUEST_KEY, null);
  else write(REQUEST_KEY, String(requestId));
}

export function clearJoinRequestId(): void {
  write(REQUEST_KEY, null);
}

export function clearPlayerSession(): void {
  write(PLAYER_ID_KEY, null);
  write(SEATED_KEY, null);
  write(REQUEST_KEY, null);
}

export function canAttemptReclaim(): boolean {
  return Boolean(getSessionId() && getPlayerName() && isSeated());
}

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let reclaimInFlight = false;

/** Reconecta o assento após F5 ou queda de conexão. */
export function reclaimSeat(socket: GameSocket): Promise<number | null> {
  if (!socket?.connected || !canAttemptReclaim() || reclaimInFlight) {
    return Promise.resolve(null);
  }

  reclaimInFlight = true;
  const sessionId = getSessionId();
  const name = getPlayerName();

  return new Promise((resolve) => {
    socket.emit("lobby:join", { name, sessionId }, (result) => {
      reclaimInFlight = false;
      if (result?.ok && result.playerId != null) {
        setPlayerId(result.playerId);
        setSeated(true);
        setPlayerName(name);
        resolve(result.playerId);
        return;
      }
      if (result?.ok && result.pending) {
        if (result.requestId != null) {
          setJoinRequestId(result.requestId);
        }
        resolve(null);
        return;
      }
      resolve(null);
    });
  });
}
