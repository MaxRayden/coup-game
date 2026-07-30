/** Tipos compartilhados entre client e server. */

export type GamePhase = "lobby" | "playing" | "finished";

export type ActionType =
  | "income"
  | "foreign_aid"
  | "coup"
  | "tax"
  | "steal"
  | "assassinate"
  | "exchange"
  | "exchange_one"
  | "investigate";

export type PendingStatus =
  | "open"
  | "contest_draft"
  | "contest_vote"
  | "contested"
  | "counter_pending"
  | "Condessa_defense"
  | "Condessa_challenged"
  | "awaiting_discard"
  | "awaiting_return";

export interface Card {
  id: string;
  discarded: boolean;
}

export interface Player {
  id: number;
  name: string;
  isAdmin: boolean;
  coins: number;
  cards: Card[];
  eliminated: boolean;
}

export interface ChatMessage {
  id: number;
  playerId: number | null;
  playerName: string;
  text: string;
  at: number;
  system?: boolean;
}

export interface JoinRequest {
  id: number;
  name: string;
  requestedAt: number;
}

export interface PendingParticipant {
  playerId: number;
  playerName: string;
}

export type BlockKind = "Condessa" | "duke" | "captain_ambassador";

export interface PendingDefense extends PendingParticipant {
  blockKind: BlockKind;
}

export interface PendingContest extends PendingParticipant {
  reason: string;
}

export type ContestVoteKind = "contest" | "block_duke";

export type ContestVoteChoice = "yes" | "no";

export interface ContestVoteEntry extends PendingParticipant {
  vote: ContestVoteChoice;
}

export interface PendingContestVote {
  kind: ContestVoteKind;
  votes: ContestVoteEntry[];
}

export interface PendingDiscard {
  playerId: number;
  playerName: string;
  actorWinsChallenge?: boolean;
  afterInfluenceLoss?: boolean;
  afterCondessaShow?: boolean;
  afterCondessaFail?: boolean;
  afterBlockShow?: boolean;
  afterBlockFail?: boolean;
  afterActorWinSwap?: boolean;
}

export interface PendingReturn {
  playerId: number;
  playerName: string;
  required: number;
}

export interface PendingAction {
  id: string;
  playerId: number;
  playerName: string;
  type: ActionType;
  targetPlayerId: number | null;
  targetPlayerName: string | null;
  reason: string;
  label: string;
  status: PendingStatus;
  endsAt: number | null;
  remainingMs: number | null;
  draftBy: PendingParticipant | null;
  contestVote: PendingContestVote | null;
  contest: PendingContest | null;
  counter: PendingContest | null;
  defense: PendingDefense | null;
  discard: PendingDiscard | null;
  returnCards: PendingReturn | null;
  resolution?: { outcome: string; reason: string; stage?: string };
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  adminId: number | null;
  currentTurnIndex: number;
  pot: number;
  winnerId: number | null;
  minPlayers: number;
  maxPlayers: number;
  pendingAction: PendingAction | null;
  joinRequests: JoinRequest[];
  chat: ChatMessage[];
  endedByAdmin: boolean;
}

export interface ServerInfo {
  addresses: { name: string; address: string }[];
  port: number;
  clientPort?: number;
  devMode?: boolean;
}

export interface ActionDefinition {
  id: ActionType | string;
  label: string;
  hint: string;
  needsTarget?: boolean;
  minCoins?: number;
}
