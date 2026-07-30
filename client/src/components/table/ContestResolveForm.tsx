import { useState } from "react";
import type { ActionType } from "@shared/types/game";
import type { AckCallback, ResolveContestPayload } from "@shared/types/socket";
import { actionCharacterName } from "@shared/constants/actions";

export interface ContestResolveFormProps {
  actionType: ActionType;
  onResolve: (payload: ResolveContestPayload, cb?: AckCallback) => void;
}

export default function ContestResolveForm({
  actionType,
  onResolve,
}: ContestResolveFormProps) {
  const [busy, setBusy] = useState(false);
  const character = actionCharacterName(actionType);

  if (!character) return null;

  function respond(outcome: "won" | "lost") {
    setBusy(true);
    onResolve({ outcome }, (result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  return (
    <div className="stage-response-actions contest-resolve-actions">
      <button
        type="button"
        className="btn stage-response-btn primary"
        disabled={busy}
        onClick={() => respond("won")}
      >
        Sim, eu sou {character}
      </button>
      <button
        type="button"
        className="btn stage-response-btn contest-btn"
        disabled={busy}
        onClick={() => respond("lost")}
      >
        Não sou {character}
      </button>
    </div>
  );
}
