import type { CSSProperties } from "react";
import type { Card, Player } from "@shared/types/game";

export interface PlayerSeatProps {
  player: Player;
  style: CSSProperties;
  isTurn: boolean;
  isMine: boolean;
  isMarked: boolean;
  onOpen?: () => void;
}

export default function PlayerSeat({
  player,
  style,
  isTurn,
  isMine,
  isMarked,
  onOpen,
}: PlayerSeatProps) {
  const aliveCards = player.cards.filter((c) => !c.discarded);
  const discarded = player.cards.filter((c) => c.discarded);
  const interactive = Boolean(isMine && onOpen);

  const className = [
    "seat",
    isTurn ? "seat-turn" : "",
    player.eliminated ? "seat-out" : "",
    isMine ? "seat-mine" : "seat-other",
    isMarked ? "seat-marked" : "",
    interactive ? "" : "seat-locked",
  ]
    .filter(Boolean)
    .join(" ");

  const label = `${player.name}, ${player.coins} moedas, ${aliveCards.length} cartas${
    isMine ? " (você)" : ""
  }`;

  if (!interactive) {
    return (
      <div className={className} style={style} aria-label={label}>
        <SeatContent
          player={player}
          aliveCards={aliveCards}
          discarded={discarded}
          isTurn={isTurn}
          isMine={isMine}
          isMarked={isMarked}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={onOpen}
      aria-label={label}
    >
      <SeatContent
        player={player}
        aliveCards={aliveCards}
        discarded={discarded}
        isTurn={isTurn}
        isMine={isMine}
        isMarked={isMarked}
      />
    </button>
  );
}

interface SeatContentProps {
  player: Player;
  aliveCards: Card[];
  discarded: Card[];
  isTurn: boolean;
  isMine: boolean;
  isMarked: boolean;
}

function SeatContent({
  player,
  aliveCards,
  discarded,
  isTurn,
  isMine,
  isMarked,
}: SeatContentProps) {
  return (
    <>
      <span className="seat-name">
        {player.name}
        {isMine ? " · você" : ""}
      </span>
      <span className="seat-coins" aria-label={`${player.coins} moedas`}>
        {player.coins}
      </span>
      <span className="seat-coins-label">moedas</span>

      <div className="seat-cards">
        {aliveCards.map((card) => (
          <span key={card.id} className="mini-card face-down" title="Carta" />
        ))}
        {discarded.map((card) => (
          <span key={card.id} className="mini-card discarded" title="Descartada" />
        ))}
      </div>

      {isMarked && <span className="seat-badge marked">Alvo</span>}
      {player.eliminated && <span className="seat-badge">Eliminado</span>}
      {isTurn && !player.eliminated && <span className="seat-turn-ring" />}
    </>
  );
}
