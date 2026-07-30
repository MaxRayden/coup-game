import { useState } from "react";
import type { Player } from "@shared/types/game";
import type { AckCallback } from "@shared/types/socket";

export interface DiscardPickerProps {
  player: Player;
  onChoose: (cardId: string, cb?: AckCallback) => void;
}

export default function DiscardPicker({ player, onChoose }: DiscardPickerProps) {
  const alive = player.cards.filter((c) => !c.discarded);
  const [busy, setBusy] = useState(false);

  return (
    <div className="discard-choices" style={{ marginTop: "0.6rem" }}>
      {alive.map((card) => (
        <button
          key={card.id}
          type="button"
          className="card-choice"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onChoose(card.id, (result) => {
              setBusy(false);
              if (!result?.ok && result?.error) window.alert(result.error);
            });
          }}
        >
          Carta {player.cards.indexOf(card) + 1}
        </button>
      ))}
    </div>
  );
}
