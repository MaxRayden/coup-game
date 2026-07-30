import type { ActionType, GameState } from "./game.js";

/** Resposta padrão dos handlers Socket.io com ack. */
export interface SocketAck {
  ok: boolean;
  error?: string;
  playerId?: number;
  pending?: boolean;
  requestId?: number;
  reclaimed?: boolean;
  already?: boolean;
}

export type AckCallback = (result: SocketAck) => void;

export interface DeclareActionPayload {
  type: ActionType;
  reason?: string;
  targetPlayerId?: number | null;
}

export interface ContestPayload {
  reason?: string;
}

export interface ContestVotePayload {
  vote: "yes" | "no";
}

export interface ResolveContestPayload {
  outcome: "won" | "lost";
  reason?: string;
}

export interface ResolveCounterPayload {
  outcome: "won" | "lost";
  reason: string;
}

export type CondessaOutcome = "show" | "lose";

export interface ClientToServerEvents {
  "lobby:join": (
    payload: { name: string; sessionId: string },
    ack?: AckCallback
  ) => void;
  "lobby:create": (
    payload: { name: string; sessionId: string },
    ack?: AckCallback
  ) => void;
  "lobby:leave": (
    payload: { sessionId?: string } | AckCallback,
    ack?: AckCallback
  ) => void;
  "lobby:start": (ack?: AckCallback) => void;
  "join:cancel": (ack?: AckCallback) => void;
  "join:approve": (payload: { requestId: number }, ack?: AckCallback) => void;
  "join:reject": (payload: { requestId: number }, ack?: AckCallback) => void;
  "action:declare": (payload: DeclareActionPayload, ack?: AckCallback) => void;
  "action:beginContest": (ack?: AckCallback) => void;
  "action:cancelContest": (ack?: AckCallback) => void;
  "action:contest": (payload: ContestPayload, ack?: AckCallback) => void;
  "action:voteContest": (payload: ContestVotePayload, ack?: AckCallback) => void;
  "action:resolve": (payload: ResolveContestPayload, ack?: AckCallback) => void;
  "action:resolveCounter": (payload: ResolveCounterPayload, ack?: AckCallback) => void;
  "action:chooseDiscard": (payload: { cardId: string }, ack?: AckCallback) => void;
  "action:chooseReturn": (payload: { cardIds: string[] }, ack?: AckCallback) => void;
  "action:acceptAssassination": (ack?: AckCallback) => void;
  "action:defendAssassination": (ack?: AckCallback) => void;
  "action:acceptCondessaBlock": (ack?: AckCallback) => void;
  "action:challengeCondessaDefense": (ack?: AckCallback) => void;
  "action:resolveCondessaDefense": (
    payload: { outcome: CondessaOutcome },
    ack?: AckCallback
  ) => void;
  "action:blockForeignAid": (ack?: AckCallback) => void;
  "action:blockSteal": (ack?: AckCallback) => void;
  "turn:next": (ack?: AckCallback) => void;
  "chat:send": (payload: { text: string }, ack?: AckCallback) => void;
  "game:end": (ack?: AckCallback) => void;
  "game:returnLobby": (ack?: AckCallback) => void;
}

export interface ServerToClientEvents {
  "game:state": (state: GameState) => void;
  "server:info": (info: import("./game.js").ServerInfo) => void;
  "join:approved": (payload: { playerId: number }) => void;
  "join:rejected": (payload: { error: string }) => void;
}
