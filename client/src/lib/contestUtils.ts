import type { ActionType, ContestVoteKind, PendingAction, BlockKind } from "@shared/types/game";

const ACTION_VERBS: Record<ActionType, string> = {
  income: "recebendo renda",
  foreign_aid: "recebendo ajuda externa",
  coup: "aplicando golpe de estado em",
  tax: "cobrando taxas",
  steal: "extorquindo",
  assassinate: "assassinando",
  exchange: "trocando cartas",
  exchange_one: "trocando carta",
  investigate: "investigando",
};

/** Verbo da ação em andamento (gerúndio). */
export function actionVerb(type: ActionType): string {
  return ACTION_VERBS[type] ?? "agindo";
}

/** Nome do ator na frase da ação, visto pelo jogador local. */
export function actionActorLabel(
  pending: PendingAction,
  viewerId: number | null | undefined
): string {
  if (viewerId != null && pending.playerId === viewerId) return "Você";
  return pending.playerName;
}

/** Frase principal da ação em andamento, ex.: "João está extorquindo você". */
export function actionHeadline(
  pending: PendingAction,
  viewerId: number | null | undefined
): string {
  const verb = actionVerb(pending.type);
  const actorLabel = actionActorLabel(pending, viewerId);
  const target =
    pending.targetPlayerId != null && pending.targetPlayerId === viewerId
      ? "você"
      : pending.targetPlayerName;

  if (target) return `${actorLabel} está ${verb} ${target}`;
  return `${actorLabel} está ${verb}`;
}

export function blockKindLabel(blockKind: BlockKind | undefined): string {
  if (blockKind === "duke") return "Duque";
  if (blockKind === "captain_ambassador") return "Capitão/Embaixador";
  return "Condessa";
}

export function discardReasonText(pending: PendingAction | null | undefined): string {
  if (!pending?.discard) return "deve descartar uma carta.";
  if (pending.discard.afterActorWinSwap) {
    return "deve escolher uma carta para devolver ao baralho e comprar outra (prova do personagem).";
  }
  if (pending.discard.afterCondessaShow) {
    return "perdeu a contestação da Condessa e deve descartar uma carta.";
  }
  if (pending.discard.afterCondessaFail) {
    return "não tinha a Condessa e deve descartar uma carta — o assassinato continua.";
  }
  if (pending.discard.afterBlockShow) {
    return "perdeu a contestação do bloqueio e deve descartar uma carta.";
  }
  if (pending.discard.afterBlockFail) {
    return "não tinha a carta do bloqueio e deve descartar — a ação continua.";
  }
  if (pending.discard.afterInfluenceLoss) {
    return "deve escolher uma carta para perder influência.";
  }
  if (pending.discard.actorWinsChallenge === false) {
    return "perdeu a contestação e deve descartar uma carta.";
  }
  return "deve descartar uma carta.";
}

export interface ContestOpenHintContext {
  isAssassinateOpen: boolean;
  isTarget: boolean;
  isTaxOpen: boolean;
  isExchangeOpen: boolean;
}

export function contestOpenHint(
  pending: PendingAction,
  { isAssassinateOpen, isTarget, isTaxOpen, isExchangeOpen }: ContestOpenHintContext
): string {
  if (isAssassinateOpen && isTarget) {
    return "Você foi alvo — conteste o Assassino, defenda (Condessa) ou aceite a morte";
  }
  if (isTaxOpen) {
    return "Vote SIM para contestar o Duque ou NÃO para deixar passar";
  }
  if (isExchangeOpen) {
    return "Vote SIM para contestar ou NÃO para deixar passar";
  }
  if (pending.type === "steal") {
    return isTarget
      ? "Você é o alvo — pode contestar o Capitão ou bloquear com Capitão/Embaixador"
      : "Só o alvo pode contestar esta extorsão";
  }
  if (pending.type === "assassinate") {
    return "Só o alvo pode contestar, defender ou aceitar o assassinato";
  }
  if (pending.type === "foreign_aid") {
    return "Vote SIM para bloquear com Duque ou NÃO para deixar passar";
  }
  return "Jogadores elegíveis podem contestar";
}

export function defenseHint(blockKind: BlockKind | undefined): string {
  const label = blockKindLabel(blockKind);
  if (blockKind === "Condessa") {
    return `${label} declarada — o assassino pode aceitar ou contestar`;
  }
  return `Bloqueio com ${label} — quem fez a ação pode aceitar ou contestar`;
}

/** Frase de quem bloqueou/defendeu, vista pelo jogador local. */
export function defenseBlockMessage(
  pending: PendingAction,
  viewerId: number | null | undefined,
  blockKind: BlockKind | undefined
): string {
  const isDefender = viewerId != null && pending.defense?.playerId === viewerId;
  if (blockKind === "Condessa") {
    return isDefender
      ? "Você defendeu com Condessa"
      : `${pending.defense?.playerName} defendeu com Condessa`;
  }
  const label = blockKindLabel(blockKind);
  return isDefender
    ? `Você bloqueou (${label})`
    : `${pending.defense?.playerName} bloqueou (${label})`;
}

/** Aguardando o ator aceitar ou contestar bloqueio/defesa. */
export function defenseActorWaitingMessage(pending: PendingAction): string {
  return `Aguardando ${pending.playerName} aceitar ou contestar…`;
}

export function defenseChallengeHint(blockKind: BlockKind | undefined): string {
  const label = blockKindLabel(blockKind);
  return `Quem bloqueou deve mostrar ${label} ou perder uma carta`;
}

export function contestVoteTitle(kind: ContestVoteKind | undefined): string {
  if (kind === "block_duke") {
    return "Votação: quem bloqueará com Duque?";
  }
  return "Votação: quem contestará?";
}

export function contestVoteActorMessage(kind: ContestVoteKind | undefined): string {
  if (kind === "block_duke") {
    return "Aguardando os outros jogadores — se ninguém bloquear com Duque, você recebe 2 moedas.";
  }
  return "Aguardando os outros jogadores — se ninguém contestar, sua ação segue.";
}

export function contestVoteWaitingText(
  action: PendingAction,
  pendingVoterNames: string[]
): string {
  if (pendingVoterNames.length === 0) {
    return "Aguardando resultado da votação…";
  }
  const names = pendingVoterNames.join(", ");
  const kind = action.contestVote?.kind;
  if (kind === "block_duke") {
    return `Aguardando voto de ${names} para bloquear com Duque…`;
  }
  return `Aguardando voto de ${names} para contestar…`;
}
