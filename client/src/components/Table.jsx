import { useEffect, useMemo, useState } from "react";
import PlayerSeat from "./PlayerSeat.jsx";
import Chat from "./Chat.jsx";

function seatPosition(index, total) {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  const x = 50 + 42 * Math.cos(angle);
  const y = 50 + 40 * Math.sin(angle);
  return { left: `${x}%`, top: `${y}%` };
}

function secondsLeft(pending, now) {
  if (!pending) return 0;
  if (pending.status === "contest_draft" && pending.remainingMs != null) {
    return Math.max(0, Math.ceil(pending.remainingMs / 1000));
  }
  if (!pending.endsAt) return 0;
  return Math.max(0, Math.ceil((pending.endsAt - now) / 1000));
}

export default function Table({
  state,
  meId,
  isAdmin,
  onDeclareAction,
  onBeginContest,
  onCancelContest,
  onContest,
  onResolve,
  onResolveCounter,
  onChooseDiscard,
  onNextTurn,
  onEndGame,
  onApproveJoin,
  onRejectJoin,
  onSendChat,
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [contestOpen, setContestOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const current = state.players[state.currentTurnIndex];
  const pending = state.pendingAction;
  const me = useMemo(
    () => state.players.find((p) => p.id === meId) ?? null,
    [state.players, meId]
  );

  const isMyTurn =
    state.phase === "playing" &&
    me &&
    current?.id === me.id &&
    !me.eliminated &&
    !pending;

  const canActOnSeat =
    isMyTurn && state.phase === "playing" && !me?.eliminated;

  const isDrafting =
    pending?.status === "contest_draft" && pending.draftBy?.playerId === me?.id;

  useEffect(() => {
    if (!pending || pending.status !== "open") return;
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [pending?.id, pending?.status]);

  useEffect(() => {
    if (!pending) {
      setContestOpen(false);
      return;
    }
    if (pending.status === "contest_draft" && isDrafting) {
      setContestOpen(true);
    }
    if (pending.status === "contested" || pending.status === "open") {
      if (pending.status === "open") setContestOpen(false);
    }
  }, [pending?.id, pending?.status, isDrafting]);

  const remaining = secondsLeft(pending, tick);

  function openContest() {
    onBeginContest((result) => {
      if (!result?.ok) {
        if (result?.error) window.alert(result.error);
        return;
      }
      setContestOpen(true);
    });
  }

  function closeContestDraft() {
    setContestOpen(false);
    onCancelContest?.();
  }

  return (
    <main className="table-screen with-chat">
      <div className="table-column">
        <div className="table-toolbar">
          <div className="turn-info">
            {state.phase === "playing" ? (
              pending ? (
                <strong className="turn-name">Ação em andamento</strong>
              ) : isMyTurn ? (
                <strong className="turn-name">Sua vez — declare uma ação</strong>
              ) : (
                <strong className="turn-name">Vez de {current?.name ?? "—"}</strong>
              )
            ) : (
              <strong className="turn-name">Partida encerrada</strong>
            )}
          </div>
          {state.phase === "playing" && (
            <div className="toolbar-actions">
              {isMyTurn && (
                <button type="button" className="btn ghost" onClick={onNextTurn}>
                  Passar vez →
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="btn ghost danger-ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Encerrar a partida e mostrar o fim de jogo para todos?"
                      )
                    ) {
                      onEndGame?.();
                    }
                  }}
                >
                  Encerrar partida
                </button>
              )}
            </div>
          )}
        </div>

        {isAdmin && (state.joinRequests?.length ?? 0) > 0 && (
          <div className="join-requests">
            <p className="join-requests-title">
              Pedidos de entrada ({state.joinRequests.length})
            </p>
            <ul>
              {state.joinRequests.map((req) => (
                <li key={req.id}>
                  <span>{req.name}</span>
                  <span className="join-requests-actions">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => onApproveJoin?.(req.id)}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => onRejectJoin?.(req.id)}
                    >
                      Recusar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="table-arena" aria-label="Mesa de jogo">
          <div className="table-felt">
            <CenterStage
              state={state}
              current={current}
              pending={pending}
              remaining={remaining}
              me={me}
              isMyTurn={isMyTurn}
              onOpenContest={openContest}
              onResolve={onResolve}
              onResolveCounter={onResolveCounter}
              onChooseDiscard={onChooseDiscard}
            />
          </div>

          {state.players.map((player, index) => {
            const pos = seatPosition(index, state.players.length);
            const isTurn =
              state.phase === "playing" &&
              state.currentTurnIndex === index &&
              !player.eliminated;
            const isMine = meId != null && player.id === meId;
            return (
              <PlayerSeat
                key={player.id}
                player={player}
                style={pos}
                isTurn={isTurn}
                isMine={isMine}
                onOpen={
                  isMine && canActOnSeat ? () => setPanelOpen(true) : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <Chat
        messages={state.chat}
        me={me}
        disabled={state.phase === "finished"}
        onSend={onSendChat}
      />

      {panelOpen && me && canActOnSeat && (
        <ActionPanel
          player={me}
          players={state.players}
          onClose={() => setPanelOpen(false)}
          onDeclare={(payload, cb) => {
            onDeclareAction(payload, (result) => {
              cb?.(result);
              if (result?.ok) setPanelOpen(false);
            });
          }}
        />
      )}

      {contestOpen &&
        me &&
        (pending?.status === "contest_draft" || pending?.status === "open") &&
        (pending?.status !== "contest_draft" || isDrafting) && (
          <ContestPanel
            action={pending}
            onClose={closeContestDraft}
            onConfirm={(reason, cb) => {
              onContest(reason, (result) => {
                cb?.(result);
                if (result?.ok) setContestOpen(false);
              });
            }}
          />
        )}
    </main>
  );
}

function CenterStage({
  state,
  current,
  pending,
  remaining,
  me,
  isMyTurn,
  onOpenContest,
  onResolve,
  onResolveCounter,
  onChooseDiscard,
}) {
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
  const isContestant = me?.id === pending.contest?.playerId;
  const canContest =
    me &&
    !me.eliminated &&
    !isActor &&
    pending.status === "open" &&
    remaining > 0;

  return (
    <div className="action-stage" aria-live="polite">
      <span className="turn-center-label">Ação de {pending.playerName}</span>
      <strong className="action-label">{pending.label}</strong>
      {pending.targetPlayerName && (
        <p className="action-target">contra {pending.targetPlayerName}</p>
      )}
      <p className="action-reason">“{pending.reason}”</p>

      {pending.status === "open" && (
        <>
          <div className={`action-timer ${remaining <= 3 ? "urgent" : ""}`}>
            {remaining}s
          </div>
          <p className="action-hint">Tempo para contestar</p>
          {canContest && (
            <button type="button" className="btn contest-btn" onClick={onOpenContest}>
              Contestar
            </button>
          )}
          {isActor && (
            <p className="action-hint">Aguardando contestação ou o fim do tempo…</p>
          )}
        </>
      )}

      {pending.status === "contest_draft" && (
        <>
          <div className="action-timer paused">{remaining}s</div>
          <p className="action-hint">Contador pausado</p>
          <p className="action-hint">
            {pending.draftBy?.playerName ?? "Alguém"} está escrevendo a contestação…
          </p>
        </>
      )}

      {pending.status === "contested" && pending.contest && (
        <div className="contest-block">
          <p className="contest-title">
            Contestação de <strong>{pending.contest.playerName}</strong>
          </p>
          <p className="action-reason">“{pending.contest.reason}”</p>
          {isActor ? (
            <ResolveForm
              onResolve={onResolve}
              allowCounter
              placeholder="Explique o resultado ou a contra-contestação…"
            />
          ) : (
            <p className="action-hint">
              Aguardando {pending.playerName} responder (ganhei / perdi / contestar de
              volta)…
            </p>
          )}
        </div>
      )}

      {pending.status === "counter_pending" && pending.contest && pending.counter && (
        <div className="contest-block">
          <p className="contest-title">
            Contestação de <strong>{pending.contest.playerName}</strong>
          </p>
          <p className="action-reason">“{pending.contest.reason}”</p>
          <p className="contest-title">
            Contra-contestação de <strong>{pending.counter.playerName}</strong>
          </p>
          <p className="action-reason">“{pending.counter.reason}”</p>
          {isContestant ? (
            <ResolveForm
              onResolve={onResolveCounter}
              allowCounter={false}
              placeholder="Explique se você ganhou ou perdeu a contra-contestação…"
            />
          ) : (
            <p className="action-hint">
              Aguardando {pending.contest.playerName} marcar ganhei ou perdi…
            </p>
          )}
        </div>
      )}

      {pending.status === "awaiting_discard" && pending.discard && (
        <div className="contest-block">
          <p className="contest-title">Descarte obrigatório</p>
          <p className="action-hint">
            <strong>{pending.discard.playerName}</strong> perdeu a contestação e deve
            descartar uma carta.
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

function DiscardPicker({ player, onChoose }) {
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
            onChoose?.(card.id, (result) => {
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

function ResolveForm({ onResolve, allowCounter = false, placeholder }) {
  const [outcome, setOutcome] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!outcome || !reason.trim()) return;
    setBusy(true);
    onResolve({ outcome, reason: reason.trim() }, (result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  return (
    <form className="resolve-form" onSubmit={submit}>
      <div className={`resolve-outcomes ${allowCounter ? "three" : ""}`}>
        <button
          type="button"
          className={`btn ${outcome === "won" ? "primary" : ""}`}
          onClick={() => setOutcome("won")}
        >
          Ganhei
        </button>
        <button
          type="button"
          className={`btn ${outcome === "lost" ? "primary" : ""}`}
          onClick={() => setOutcome("lost")}
        >
          Perdi
        </button>
        {allowCounter && (
          <button
            type="button"
            className={`btn ${outcome === "counter" ? "primary" : ""}`}
            onClick={() => setOutcome("counter")}
          >
            Contestar de volta
          </button>
        )}
      </div>
      <textarea
        value={reason}
        maxLength={200}
        rows={3}
        placeholder={placeholder || "Explique o resultado…"}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="submit"
        className="btn primary"
        disabled={busy || !outcome || !reason.trim()}
      >
        Confirmar
      </button>
    </form>
  );
}

function ActionPanel({ player, players, onClose, onDeclare }) {
  const [type, setType] = useState("receive");
  const [amount, setAmount] = useState(1);
  const [cardId, setCardId] = useState(null);
  const [reason, setReason] = useState("");
  const [againstPlayer, setAgainstPlayer] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const aliveCards = player.cards.filter((c) => !c.discarded);
  const targets = (players ?? []).filter(
    (p) => p.id !== player.id && !p.eliminated
  );

  useEffect(() => {
    if (type === "discard" && aliveCards.length && !cardId) {
      setCardId(aliveCards[0].id);
    }
  }, [type, aliveCards, cardId]);

  useEffect(() => {
    if (type !== "other") {
      setAgainstPlayer(false);
      setTargetPlayerId(null);
    }
  }, [type]);

  function bump(delta) {
    setAmount((a) => Math.max(1, a + delta));
  }

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!reason.trim()) {
      setError(
        type === "other"
          ? "Descreva a ação."
          : "Explique o motivo da ação."
      );
      return;
    }
    if (type === "other" && againstPlayer && !targetPlayerId) {
      setError("Selecione o jogador alvo.");
      return;
    }
    setBusy(true);
    onDeclare(
      {
        type,
        amount,
        cardId: type === "discard" ? cardId : null,
        reason: reason.trim(),
        againstPlayer: type === "other" ? againstPlayer : false,
        targetPlayerId:
          type === "other" && againstPlayer ? targetPlayerId : null,
      },
      (result) => {
        setBusy(false);
        if (!result?.ok) {
          setError(result?.error || "Não foi possível declarar a ação.");
        }
      }
    );
  }

  const reasonLabel = type === "other" ? "Descrição da ação" : "Motivo";
  const reasonPlaceholder =
    type === "other"
      ? againstPlayer
        ? "Ex.: Assassino — pago 3 e elimino uma carta dele"
        : "Ex.: Troca — uso Embaixador"
      : "Ex.: Renda — pego 1 moeda";

  return (
    <div className="panel-backdrop" onClick={onClose} role="presentation">
      <aside
        className="player-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Declarar ação"
      >
        <header className="panel-head">
          <div>
            <h2>Declarar ação</h2>
            <p>
              {player.coins} moedas · {aliveCards.length} carta
              {aliveCards.length === 1 ? "" : "s"}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="panel-section" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
            <span className="panel-label">Ação</span>
            <div className="action-type-grid">
              {[
                { id: "receive", label: "Receber moedas" },
                { id: "pay", label: "Pagar moedas" },
                { id: "discard", label: "Descartar carta" },
                { id: "other", label: "Outra ação" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`card-choice ${type === opt.id ? "selected" : ""}`}
                  onClick={() => setType(opt.id)}
                  disabled={
                    (opt.id === "pay" && player.coins <= 0) ||
                    (opt.id === "discard" && aliveCards.length === 0)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(type === "receive" || type === "pay") && (
            <div className="panel-section">
              <span className="panel-label">Quantidade</span>
              <div className="stepper">
                <button type="button" className="stepper-btn" onClick={() => bump(-1)}>
                  −
                </button>
                <input
                  className="stepper-input"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) =>
                    setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                  }
                />
                <button type="button" className="stepper-btn" onClick={() => bump(1)}>
                  +
                </button>
              </div>
            </div>
          )}

          {type === "discard" && (
            <div className="panel-section">
              <span className="panel-label">Qual carta</span>
              <div className="discard-choices">
                {aliveCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`card-choice ${cardId === card.id ? "selected" : ""}`}
                    onClick={() => setCardId(card.id)}
                  >
                    Carta {player.cards.indexOf(card) + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === "other" && (
            <div className="panel-section">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={againstPlayer}
                  onChange={(e) => {
                    setAgainstPlayer(e.target.checked);
                    if (!e.target.checked) setTargetPlayerId(null);
                  }}
                />
                <span>Agir contra um jogador (opcional)</span>
              </label>

              {againstPlayer && (
                <>
                  <span className="panel-label" style={{ marginTop: "0.75rem" }}>
                    Jogador alvo
                  </span>
                  <div className="discard-choices">
                    {targets.length === 0 && (
                      <p className="form-error">Nenhum outro jogador disponível.</p>
                    )}
                    {targets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`card-choice ${
                          targetPlayerId === t.id ? "selected" : ""
                        }`}
                        onClick={() => setTargetPlayerId(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="panel-section">
            <span className="panel-label">{reasonLabel}</span>
            <textarea
              value={reason}
              maxLength={200}
              rows={3}
              placeholder={reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn primary setup-start"
            disabled={
              busy ||
              !reason.trim() ||
              (type === "other" && againstPlayer && !targetPlayerId)
            }
          >
            Confirmar ação
          </button>
        </form>
      </aside>
    </div>
  );
}

function ContestPanel({ action, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    onConfirm(reason.trim(), (result) => {
      setBusy(false);
      if (!result?.ok && result?.error) window.alert(result.error);
    });
  }

  return (
    <div className="panel-backdrop" onClick={onClose} role="presentation">
      <aside
        className="player-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Contestar ação"
      >
        <header className="panel-head">
          <div>
            <h2>Contestar</h2>
            <p>
              {action.playerName}: {action.label}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="panel-section" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
            <span className="panel-label">Por que está contestando?</span>
            <textarea
              value={reason}
              maxLength={200}
              rows={4}
              autoFocus
              placeholder="Explique a contestação…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn primary setup-start"
            disabled={busy || !reason.trim()}
          >
            Confirmar contestação
          </button>
        </form>
      </aside>
    </div>
  );
}
