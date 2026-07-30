export default function PlayerSeat({ player, style, isTurn, isMine, onOpen }) {
  const aliveCards = player.cards.filter((c) => !c.discarded);
  const discarded = player.cards.filter((c) => c.discarded);
  const interactive = Boolean(isMine && onOpen);

  const className = [
    "seat",
    isTurn ? "seat-turn" : "",
    player.eliminated ? "seat-out" : "",
    isMine ? "seat-mine" : "seat-other",
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
      />
    </button>
  );
}

function SeatContent({ player, aliveCards, discarded, isTurn, isMine }) {
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

      {player.eliminated && <span className="seat-badge">Eliminado</span>}
      {isTurn && !player.eliminated && <span className="seat-turn-ring" />}
    </>
  );
}
