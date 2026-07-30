import type { ActionDefinition, ActionType } from "../types/game.js";

export const COUP_MANDATORY_COINS = 10;

export const CONTESTABLE_ACTION_TYPES = new Set<ActionType>([
  "tax",
  "steal",
  "assassinate",
  "exchange",
  "exchange_one",
]);

export const GENERAL_ACTIONS: ActionDefinition[] = [
  {
    id: "income",
    label: "Renda",
    hint: "Receba 1 moeda · não pode ser bloqueada ou contestada",
  },
  {
    id: "foreign_aid",
    label: "Ajuda Externa",
    hint: "Receba 2 moedas · qualquer jogador pode contestar ou bloquear (Duque)",
  },
  {
    id: "coup",
    label: "Golpe de Estado",
    hint: "Pague 7 moedas · alvo perde 1 influência · não contestável",
    needsTarget: true,
    minCoins: 7,
  },
];

export const CHARACTER_ACTIONS: ActionDefinition[] = [
  {
    id: "tax",
    label: "Duque — Taxas",
    hint: "Receba 3 moedas · qualquer jogador pode contestar · não pode ser bloqueada",
  },
  {
    id: "steal",
    label: "Capitão — Extorquir",
    hint: "Roube 2 moedas · só o alvo pode contestar se você tem Capitão · alvo pode bloquear",
    needsTarget: true,
  },
  {
    id: "assassinate",
    label: "Assassino — Assassinar",
    hint: "Pague 3 moedas · só o alvo pode contestar, defender (Condessa) ou aceitar",
    needsTarget: true,
    minCoins: 3,
  },
  {
    id: "exchange",
    label: "Embaixador — Trocar",
    hint: "Compre 2 cartas e devolva 2 · qualquer jogador pode contestar",
  },
  {
    id: "exchange_one",
    label: "Inquisidor — Trocar",
    hint: "Compre 1 carta e devolva 1 · qualquer jogador pode contestar",
  },
  {
    id: "investigate",
    label: "Inquisidor — Investigar",
    hint: "Escolha um jogador para investigar · não contestável",
    needsTarget: true,
  },
];

const TARGET_ACTIONS: ActionType[] = ["coup", "steal", "assassinate", "investigate"];

export function actionNeedsTarget(type: string | null | undefined): boolean {
  return TARGET_ACTIONS.includes(type as ActionType);
}

/** Personagem exigido pela ação (para contestação). */
export function actionCharacterName(type: ActionType | string): string | null {
  const names: Partial<Record<ActionType, string>> = {
    tax: "Duque",
    steal: "Capitão",
    assassinate: "Assassino",
    exchange: "Embaixador",
    exchange_one: "Inquisidor",
  };
  return names[type as ActionType] ?? null;
}

export function isContestableType(type: string | null | undefined): boolean {
  return CONTESTABLE_ACTION_TYPES.has(type as ActionType);
}

/** Ações diretas contra alvo: só o alvo pode contestar ou bloquear — sem votação. */
export const TARGET_ONLY_CONTEST_ACTIONS = new Set<ActionType>([
  "steal",
  "assassinate",
]);

export function isTargetOnlyContestAction(type: ActionType | string): boolean {
  return TARGET_ONLY_CONTEST_ACTIONS.has(type as ActionType);
}

/** Quem pode contestar a ação declarada (não bloqueios). */
export function canPlayerContestAction(
  actionType: ActionType | string,
  playerId: number,
  actorId: number,
  targetPlayerId: number | null
): boolean {
  if (playerId === actorId) return false;
  if (isTargetOnlyContestAction(actionType)) {
    return targetPlayerId != null && playerId === targetPlayerId;
  }
  return true;
}

/** Ações que abrem votação coletiva assim que são declaradas. */
export const OPEN_VOTE_CONTEST_TYPES = new Set<ActionType>([
  "tax",
  "exchange",
  "exchange_one",
]);

export function usesOpenContestVote(type: ActionType | string): boolean {
  return OPEN_VOTE_CONTEST_TYPES.has(type as ActionType);
}

export function usesOpenBlockVote(type: ActionType | string): boolean {
  return type === "foreign_aid";
}

/** Quem pode votar para bloquear Ajuda Externa com Duque. */
export function canPlayerBlockForeignAid(
  playerId: number,
  actorId: number,
  eliminated: boolean
): boolean {
  return !eliminated && playerId !== actorId;
}
