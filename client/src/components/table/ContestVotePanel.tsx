import { useState } from "react";
import type { PendingAction, Player } from "@shared/types/game";
import type { AckCallback } from "@shared/types/socket";
import {
  canPlayerBlockForeignAid,
  canPlayerContestAction,
} from "@shared/constants/actions";

export interface ContestVotePanelProps {
  action: PendingAction;
  me: Player;
  onVote: (vote: "yes" | "no", cb?: AckCallback) => void;
}

export default function ContestVotePanel({ action, me, onVote }: ContestVotePanelProps) {
  const [busy, setBusy] = useState(false);
  const voteKind = action.contestVote?.kind;
  const myVote = action.contestVote?.votes.find((v) => v.playerId === me.id)?.vote;

  const canVote =
    voteKind === "block_duke"
      ? canPlayerBlockForeignAid(me.id, action.playerId, me.eliminated)
      : canPlayerContestAction(
          action.type,
          me.id,
          action.playerId,
          action.targetPlayerId
        );

  if (!canVote) return null;

  const yesLabel =
    voteKind === "block_duke" ? "Sim, eu bloqueio (Duque)" : "Sim, eu contesto";
  const noLabel = "Não, deixo passar";

  if (myVote) {
    return (
      <p className="action-hint contest-vote-cast">
        Você votou: <strong>{myVote === "yes" ? yesLabel : noLabel}</strong>
      </p>
    );
  }

  function cast(vote: "yes" | "no") {
    setBusy(true);
    onVote(vote, (result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  return (
    <div className="stage-response-actions contest-vote-actions">
      <button
        type="button"
        className="btn stage-response-btn contest-btn"
        disabled={busy}
        onClick={() => cast("yes")}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        className="btn stage-response-btn stage-response-btn--pass"
        disabled={busy}
        onClick={() => cast("no")}
      >
        {noLabel}
      </button>
    </div>
  );
}
