import { useMemo } from "react";
import type {
  AckCallback,
  CondessaOutcome,
  DeclareActionPayload,
  ResolveContestPayload,
  ResolveCounterPayload,
} from "@shared/types/socket";
import type { GameSocket } from "@/hooks/useGameConnection";

export interface GameActions {
  onDeclareAction: (payload: DeclareActionPayload, cb?: AckCallback) => void;
  onBeginContest: (cb?: AckCallback) => void;
  onCancelContest: (cb?: AckCallback) => void;
  onContest: (cb?: AckCallback) => void;
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
  onEndGame: () => void;
  onApproveJoin: (requestId: number) => void;
  onRejectJoin: (requestId: number) => void;
  onSendChat: (text: string) => void;
  onReturnLobby: (cb?: AckCallback) => void;
}

export function useGameActions(socket: GameSocket | null): GameActions {
  return useMemo(
    () => ({
      onDeclareAction: (payload, cb) => socket?.emit("action:declare", payload, cb),
      onBeginContest: (cb) => socket?.emit("action:beginContest", cb),
      onCancelContest: (cb) => socket?.emit("action:cancelContest", cb),
      onContest: (cb) => socket?.emit("action:contest", {}, cb),
      onVoteContest: (vote, cb) => socket?.emit("action:voteContest", { vote }, cb),
      onResolve: (payload, cb) => socket?.emit("action:resolve", payload, cb),
      onResolveCounter: (payload, cb) =>
        socket?.emit("action:resolveCounter", payload, cb),
      onChooseDiscard: (cardId, cb) =>
        socket?.emit("action:chooseDiscard", { cardId }, cb),
      onChooseReturn: (cardIds, cb) =>
        socket?.emit("action:chooseReturn", { cardIds }, cb),
      onAcceptAssassination: (cb) => socket?.emit("action:acceptAssassination", cb),
      onDefendAssassination: (cb) => socket?.emit("action:defendAssassination", cb),
      onAcceptCondessaBlock: (cb) => socket?.emit("action:acceptCondessaBlock", cb),
      onChallengeCondessaDefense: (cb) =>
        socket?.emit("action:challengeCondessaDefense", cb),
      onResolveCondessaDefense: (outcome, cb) =>
        socket?.emit("action:resolveCondessaDefense", { outcome }, cb),
      onBlockForeignAid: (cb) => socket?.emit("action:blockForeignAid", cb),
      onBlockSteal: (cb) => socket?.emit("action:blockSteal", cb),
      onEndGame: () => {
        socket?.emit("game:end", (result) => {
          if (!result?.ok && result?.error) window.alert(result.error);
        });
      },
      onApproveJoin: (requestId) => {
        socket?.emit("join:approve", { requestId }, (result) => {
          if (!result?.ok && result?.error) window.alert(result.error);
        });
      },
      onRejectJoin: (requestId) => {
        socket?.emit("join:reject", { requestId }, (result) => {
          if (!result?.ok && result?.error) window.alert(result.error);
        });
      },
      onSendChat: (text) => socket?.emit("chat:send", { text }),
      onReturnLobby: (cb) => socket?.emit("game:returnLobby", cb),
    }),
    [socket]
  );
}
