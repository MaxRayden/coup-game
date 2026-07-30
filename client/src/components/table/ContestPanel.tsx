import { useState } from "react";
import type { PendingAction } from "@shared/types/game";
import type { AckCallback } from "@shared/types/socket";
import { actionCharacterName } from "@shared/constants/actions";
import { actionHeadline } from "@/lib/contestUtils";

export interface ContestPanelProps {
  action: PendingAction;
  viewerId: number | null;
  onClose: () => void;
  onConfirm: (cb?: AckCallback) => void;
}

export default function ContestPanel({
  action,
  viewerId,
  onClose,
  onConfirm,
}: ContestPanelProps) {
  const [busy, setBusy] = useState(false);
  const character = actionCharacterName(action.type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onConfirm((result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  const actorLabel =
    viewerId != null && action.playerId === viewerId
      ? "você"
      : action.playerName;

  return (
    <div className="panel-backdrop" onClick={onClose} role="presentation">
      <aside
        className="player-panel action-modal contest-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Contestar ação"
      >
        <header className="action-modal-header">
          <div className="action-modal-titles">
            <h2>Contestar</h2>
            <p className="contest-modal-sub">{actionHeadline(action, viewerId)}</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <form id="contest-form" className="action-modal-body" onSubmit={submit}>
          <p className="action-modal-lead">
            Você duvida que <strong>{actorLabel}</strong> tem o{" "}
            <strong>{character ?? "personagem"}</strong>. Se perder a contestação,
            você perde uma carta. Confirmar?
          </p>
        </form>

        <footer className="action-modal-footer">
          <button
            type="submit"
            form="contest-form"
            className="btn primary action-modal-submit"
            disabled={busy}
          >
            Confirmar contestação
          </button>
        </footer>
      </aside>
    </div>
  );
}
