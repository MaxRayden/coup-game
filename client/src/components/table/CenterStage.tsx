import type { GameState, PendingAction, Player } from "@shared/types/game";
import type {
  AckCallback,
  CondessaOutcome,
  ResolveContestPayload,
  ResolveCounterPayload,
} from "@shared/types/socket";
import { isContestableType, canPlayerContestAction, canPlayerBlockForeignAid, usesOpenContestVote, usesOpenBlockVote } from "@shared/constants/actions";
import {
  actionVerb,
  actionActorLabel,
  blockKindLabel,
  contestOpenHint,
  contestVoteActorMessage,
  contestVoteTitle,
  contestVoteWaitingText,
  defenseBlockMessage,
  defenseActorWaitingMessage,
  defenseChallengeHint,
  defenseHint,
  discardReasonText,
} from "@/lib/contestUtils";
import { returnCountText } from "@/lib/tableUtils";
import ContestResolveForm from "@/components/table/ContestResolveForm";
import ContestVotePanel from "@/components/table/ContestVotePanel";
import DiscardPicker from "@/components/table/DiscardPicker";
import ReturnCardPicker from "@/components/table/ReturnCardPicker";

export interface CenterStageProps {
  state: GameState;
  current: Player | undefined;
  pending: PendingAction | null;
  me: Player | null;
  isMyTurn: boolean;
  onOpenContest: () => void;
  onVoteContest: (vote: "yes" | "no", cb?: AckCallback) => void;
  onResolve: (payload: ResolveContestPayload, cb?: AckCallback) => void;
  onResolveCounter: (payload: ResolveCounterPayload, cb?: AckCallback) => void;
  onChooseDiscard: (cardId: string, cb?: AckCallback) => void;
  onChooseReturn: (cardIds: string[], cb?: AckCallback) => void;
  onAcceptAssassination: (cb?: AckCallback) => void;
  onDefendAssassination: (cb?: AckCallback) => void;
  onAcceptCondessaBlock: (cb?: AckCallback) => void;
  onChallengeCondessaDefense: (cb?: AckCallback) => void;
  onResolveCondessaDefense: (outcome: CondessaOutcome, cb?: AckCallback) => void;
  onBlockForeignAid: (cb?: AckCallback) => void;
  onBlockSteal: (cb?: AckCallback) => void;
}

export default function CenterStage({
  state,
  current,
  pending,
  me,
  isMyTurn,
  onOpenContest,
  onVoteContest,
  onResolve,
  onResolveCounter,
  onChooseDiscard,
  onChooseReturn,
  onAcceptAssassination,
  onDefendAssassination,
  onAcceptCondessaBlock,
  onChallengeCondessaDefense,
  onResolveCondessaDefense,
  onBlockForeignAid,
  onBlockSteal,
}: CenterStageProps) {
  if (state.phase !== "playing") {
    return (
      <div className="table-turn">
        <span className="turn-center-name">Fim</span>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="table-turn" aria-live="polite">
        <span className="turn-center-label">Vez de</span>
        <span className="turn-center-name">{current?.name ?? "—"}</span>
        {isMyTurn && <span className="turn-center-you">é você</span>}
      </div>
    );
  }

  const isActor = me?.id === pending.playerId;
  const isTarget = me?.id === pending.targetPlayerId;
  const canContest =
    me &&
    !me.eliminated &&
    pending.status === "open" &&
    isContestableType(pending.type) &&
    canPlayerContestAction(
      pending.type,
      me.id,
      pending.playerId,
      pending.targetPlayerId
    );

  const isAssassinateOpen = pending.type === "assassinate" && pending.status === "open";
  const isTaxOpen = pending.type === "tax" && pending.status === "open";
  const isForeignAidOpen = pending.type === "foreign_aid" && pending.status === "open";
  const isStealOpen = pending.type === "steal" && pending.status === "open";
  const isExchangeOpen =
    (pending.type === "exchange" || pending.type === "exchange_one") &&
    pending.status === "open";
  const blockKind = pending.defense?.blockKind;
  const canBlockForeignAid =
    isForeignAidOpen && me && !me.eliminated && !isActor;
  const isTargetOnlyOpen = isStealOpen || isAssassinateOpen;
  const isTargetOpenResponse =
    pending.status === "open" && isTarget && isTargetOnlyOpen;
  const showOpenHint =
    pending.status === "open" &&
    !isTargetOpenResponse &&
    (Boolean(isActor) ||
      Boolean(!isTarget && isTargetOnlyOpen) ||
      Boolean(canContest && !isTargetOnlyOpen));

  const usesOpenVote =
    pending.status === "contest_vote" ||
    (pending.status === "open" &&
      (usesOpenContestVote(pending.type) || usesOpenBlockVote(pending.type)));

  const targetLabel =
    pending.targetPlayerId != null && pending.targetPlayerId === me?.id
      ? "você"
      : pending.targetPlayerName;

  const isDefender = me?.id === pending.defense?.playerId;
  const voteKind = pending.contestVote?.kind;
  const pendingVoterNames =
    pending.status === "contest_vote" && voteKind
      ? state.players
          .filter((p) => {
            if (p.eliminated) return false;
            if (pending.contestVote?.votes.some((v) => v.playerId === p.id)) {
              return false;
            }
            if (voteKind === "block_duke") {
              return canPlayerBlockForeignAid(p.id, pending.playerId, p.eliminated);
            }
            return canPlayerContestAction(
              pending.type,
              p.id,
              pending.playerId,
              pending.targetPlayerId
            );
          })
          .map((p) => p.name)
      : [];

  return (
    <div
      className={`action-stage${isTargetOpenResponse ? " action-stage--target" : ""}`}
      aria-live="polite"
    >
      <p className="action-headline">
        <strong className={isActor ? "action-headline-you" : undefined}>
          {actionActorLabel(pending, me?.id ?? null)}
        </strong>
        {" está "}
        {actionVerb(pending.type)}
        {targetLabel && (
          <>
            {" "}
            <strong
              className={
                pending.targetPlayerId === me?.id ? "action-headline-you" : undefined
              }
            >
              {targetLabel}
            </strong>
          </>
        )}
      </p>

      {pending.status === "open" && (
        <>
          {isAssassinateOpen && isTarget && (
            <div className="stage-response-actions">
              <button
                type="button"
                className="btn stage-response-btn contest-btn"
                onClick={onOpenContest}
              >
                Contestar Assassino
              </button>
              <button
                type="button"
                className="btn stage-response-btn"
                onClick={() => {
                  onDefendAssassination?.((result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Defender com Condessa
              </button>
              <button
                type="button"
                className="btn stage-response-btn stage-response-btn--accept"
                onClick={() => {
                  if (
                    window.confirm(
                      "Aceitar a morte? Você perderá uma carta e o assassino pagará 3 moedas."
                    )
                  ) {
                    onAcceptAssassination?.((result) => {
                      if (!result?.ok && result?.error) window.alert(result.error);
                    });
                  }
                }}
              >
                Aceitar morte
              </button>
            </div>
          )}
          {isStealOpen && isTarget && (
            <div className="stage-response-actions">
              <button
                type="button"
                className="btn stage-response-btn contest-btn"
                onClick={onOpenContest}
              >
                Contestar Capitão
              </button>
              <button
                type="button"
                className="btn stage-response-btn"
                onClick={() => {
                  onBlockSteal?.((result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Bloquear
              </button>
            </div>
          )}
          {canBlockForeignAid && !usesOpenBlockVote(pending.type) && (
            <div className="stage-response-actions stage-response-actions--inline">
              <button
                type="button"
                className="btn stage-response-btn"
                onClick={() => {
                  onBlockForeignAid?.((result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Bloquear com Duque
              </button>
            </div>
          )}
          {canContest && !isTargetOnlyOpen && !usesOpenContestVote(pending.type) && (
            <div className="stage-response-actions stage-response-actions--inline">
              <button
                type="button"
                className="btn stage-response-btn contest-btn"
                onClick={onOpenContest}
              >
                Contestar
              </button>
            </div>
          )}
          {showOpenHint && !usesOpenVote && (
            <p className="action-hint">
              {isActor && isTargetOnlyOpen && "Aguardando resposta do alvo…"}
              {isActor && !isTargetOnlyOpen && "Aguardando contestação…"}
              {!isActor && !isTarget && isTargetOnlyOpen && "Aguardando resposta do alvo…"}
              {!isActor &&
                !isTarget &&
                !isTargetOnlyOpen &&
                contestOpenHint(pending, {
                  isAssassinateOpen,
                  isTarget: Boolean(isTarget),
                  isTaxOpen,
                  isExchangeOpen,
                })}
            </p>
          )}
        </>
      )}

      {pending.status === "contest_vote" && pending.contestVote && (
        <div className="contest-block contest-vote-block">
          {isActor ? (
            <p className="action-hint">{contestVoteActorMessage(voteKind)}</p>
          ) : (
            <>
              <p className="contest-title">{contestVoteTitle(voteKind)}</p>
              {me && !me.eliminated ? (
                <ContestVotePanel action={pending} me={me} onVote={onVoteContest} />
              ) : null}
              {pendingVoterNames.length > 0 && (
                <p className="action-hint">
                  {contestVoteWaitingText(pending, pendingVoterNames)}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {pending.status === "Condessa_defense" && pending.defense && (
        <>
          <p className="action-hint">
            <strong className={isDefender ? "action-headline-you" : undefined}>
              {defenseBlockMessage(pending, me?.id ?? null, blockKind)}
            </strong>
          </p>
          {isActor ? (
            <div className="target-response-actions">
              <button
                type="button"
                className="btn contest-btn"
                onClick={() => {
                  onChallengeCondessaDefense?.((result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Duvido ({blockKindLabel(blockKind)})
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onAcceptCondessaBlock?.((result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Aceitar {blockKind === "Condessa" ? "defesa" : "bloqueio"}
              </button>
            </div>
          ) : isDefender ? (
            <p className="action-hint">{defenseActorWaitingMessage(pending)}</p>
          ) : (
            <>
              <p className="action-hint">{defenseHint(blockKind)}</p>
              <p className="action-hint">{defenseActorWaitingMessage(pending)}</p>
            </>
          )}
        </>
      )}

      {pending.status === "Condessa_challenged" && pending.defense && (
        <div className="contest-block">
          <p className="contest-title">Contestação do bloqueio</p>
          <p className="action-hint">
            {pending.playerName} duvida que{" "}
            <strong>{pending.defense.playerName}</strong> tem{" "}
            {blockKindLabel(blockKind)}
          </p>
          <p className="action-hint">{defenseChallengeHint(blockKind)}</p>
          {me?.id === pending.defense.playerId ? (
            <div className="target-response-actions">
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  onResolveCondessaDefense?.("show", (result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Tenho {blockKindLabel(blockKind)} (mostrar)
              </button>
              <button
                type="button"
                className="btn contest-btn"
                onClick={() => {
                  onResolveCondessaDefense?.("lose", (result) => {
                    if (!result?.ok && result?.error) window.alert(result.error);
                  });
                }}
              >
                Não tenho (perco carta)
              </button>
            </div>
          ) : (
            <p className="action-hint">
              Aguardando {pending.defense.playerName} responder…
            </p>
          )}
        </div>
      )}

      {pending.status === "contested" && pending.contest && (
        <div className="contest-block">
          <p className="contest-headline">
            <strong>{pending.contest.playerName}</strong> contestou{" "}
            <strong>{pending.playerName}</strong>
          </p>
          {isActor ? (
            <ContestResolveForm actionType={pending.type} onResolve={onResolve} />
          ) : (
            <p className="action-hint">Aguardando {pending.playerName} responder…</p>
          )}
        </div>
      )}

      {pending.status === "awaiting_return" && pending.returnCards && (
        <div className="contest-block">
          <p className="contest-title">Devolver cartas</p>
          <p className="action-hint">
            <strong>{pending.returnCards.playerName}</strong> comprou cartas e deve
            devolver {returnCountText(pending.returnCards.required ?? 2)} ao baralho.
          </p>
          {me?.id === pending.returnCards.playerId ? (
            <ReturnCardPicker
              player={me}
              required={pending.returnCards.required ?? 2}
              onConfirm={(cardIds, cb) => onChooseReturn?.(cardIds, cb)}
            />
          ) : (
            <p className="action-hint">
              Aguardando {pending.returnCards.playerName} devolver{" "}
              {returnCountText(pending.returnCards.required ?? 2)}…
            </p>
          )}
        </div>
      )}

      {pending.status === "awaiting_discard" && pending.discard && (
        <div className="contest-block">
          <p className="contest-title">
            {pending.discard.afterActorWinSwap ? "Trocar carta" : "Descarte obrigatório"}
          </p>
          <p className="action-hint">
            <strong>
              {pending.discard.playerId === me?.id
                ? "Você"
                : pending.discard.playerName}
            </strong>{" "}
            {discardReasonText(pending)}
          </p>
          {me?.id === pending.discard.playerId ? (
            <DiscardPicker
              player={me}
              onChoose={(cardId, cb) => onChooseDiscard?.(cardId, cb)}
            />
          ) : (
            <p className="action-hint">
              Aguardando {pending.discard.playerName} escolher a carta…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
