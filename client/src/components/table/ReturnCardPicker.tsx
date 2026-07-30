import { useState } from "react";
import type { Player } from "@shared/types/game";
import type { AckCallback } from "@shared/types/socket";

export interface ReturnCardPickerProps {
  player: Player;
  required: number;
  onConfirm: (cardIds: string[], cb?: AckCallback) => void;
}

export default function ReturnCardPicker({
  player,
  required,
  onConfirm,
}: ReturnCardPickerProps) {
  const alive = player.cards.filter((c) => !c.discarded);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(cardId: string) {
    setSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= required) return prev;
      return [...prev, cardId];
    });
  }

  function confirm() {
    if (selected.length !== required) return;
    setBusy(true);
    onConfirm(selected, (result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div className="discard-choices">
        {alive.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`card-choice ${selected.includes(card.id) ? "selected" : ""}`}
            disabled={busy}
            onClick={() => toggle(card.id)}
          >
            Carta {player.cards.indexOf(card) + 1}
          </button>
        ))}
      </div>
      <p className="action-hint" style={{ marginTop: "0.5rem" }}>
        {selected.length}/{required} selecionada{required === 1 ? "" : "s"}
      </p>
      <button
        type="button"
        className="btn primary"
        style={{ marginTop: "0.5rem" }}
        disabled={busy || selected.length !== required}
        onClick={confirm}
      >
        Devolver {required} cartas
      </button>
    </div>
  );
}
