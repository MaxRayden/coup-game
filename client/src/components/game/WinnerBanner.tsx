import type { Player } from "@shared/types/game";

export interface WinnerBannerProps {
  winner: Player | undefined;
  endedByAdmin: boolean;
  isAdmin: boolean;
  onRestart: () => void;
}

export default function WinnerBanner({
  winner,
  endedByAdmin,
  isAdmin,
  onRestart,
}: WinnerBannerProps) {
  const hasWinner = Boolean(winner);

  return (
    <div className="winner-overlay" role="dialog" aria-labelledby="winner-title">
      <div className="winner-card">
        <p className="winner-eyebrow">Fim de jogo</p>
        {hasWinner && winner ? (
          <>
            <h2 id="winner-title" className="winner-name">
              {winner.name}
            </h2>
            <p className="winner-text">venceu a partida</p>
          </>
        ) : (
          <>
            <h2 id="winner-title" className="winner-name">
              Partida encerrada
            </h2>
            <p className="winner-text">
              {endedByAdmin
                ? "O admin encerrou a partida."
                : "A partida terminou sem vencedor declarado."}
            </p>
          </>
        )}
        {isAdmin ? (
          <button type="button" className="btn primary" onClick={onRestart}>
            Voltar ao lobby
          </button>
        ) : (
          <p className="winner-wait">Aguardando o admin voltar ao lobby…</p>
        )}
      </div>
    </div>
  );
}
