import { useEffect, useRef, useState } from "react";
import type { ActionType, Player } from "@shared/types/game";
import type { AckCallback, DeclareActionPayload } from "@shared/types/socket";
import {
  actionNeedsTarget,
  CHARACTER_ACTIONS,
  COUP_MANDATORY_COINS,
  GENERAL_ACTIONS,
} from "@shared/constants/actions";

export interface ActionPanelProps {
  player: Player;
  players: Player[];
  forced?: boolean;
  onClose: () => void;
  onDeclare: (payload: DeclareActionPayload, cb?: AckCallback) => void;
}

export default function ActionPanel({
  player,
  players,
  onClose,
  onDeclare,
}: ActionPanelProps) {
  const mustCoup = player.coins >= COUP_MANDATORY_COINS;
  const [step, setStep] = useState<"category" | "actions">(
    mustCoup ? "actions" : "category"
  );
  const [category, setCategory] = useState<"general" | "character" | null>(
    mustCoup ? "general" : null
  );
  const [type, setType] = useState<ActionType | null>(mustCoup ? "coup" : null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastSelectAtRef = useRef(0);
  const lastTargetSelectAtRef = useRef(0);

  const DOUBLE_CLICK_GUARD_MS = 400;

  const aliveCards = player.cards.filter((c) => !c.discarded);
  const targets = (players ?? []).filter((p) => p.id !== player.id && !p.eliminated);

  const actionsInView =
    category === "general"
      ? mustCoup
        ? GENERAL_ACTIONS.filter((a) => a.id === "coup")
        : GENERAL_ACTIONS
      : category === "character"
        ? CHARACTER_ACTIONS
        : [];

  const selectedAction =
    type != null
      ? actionsInView.find((a) => a.id === type) ??
        GENERAL_ACTIONS.find((a) => a.id === type) ??
        CHARACTER_ACTIONS.find((a) => a.id === type)
      : null;

  const displayedActions =
    category === "character" && type
      ? actionsInView.filter((a) => a.id === type)
      : actionsInView;

  const needsTarget = type ? actionNeedsTarget(type) : false;

  useEffect(() => {
    if (mustCoup) {
      setStep("actions");
      setCategory("general");
      setType("coup");
    }
  }, [mustCoup]);

  useEffect(() => {
    if (!needsTarget) setTargetPlayerId(null);
  }, [needsTarget]);

  function isActionDisabled(action: (typeof GENERAL_ACTIONS)[number]): boolean {
    if (mustCoup && action.id !== "coup") return true;
    if (action.minCoins != null && player.coins < action.minCoins) return true;
    if (action.needsTarget && targets.length === 0) return true;
    return false;
  }

  function pickCategory(next: "general" | "character") {
    setCategory(next);
    setType(null);
    setTargetPlayerId(null);
    setError("");
    setStep("actions");
  }

  function goBack() {
    if (mustCoup) return;
    setStep("category");
    setCategory(null);
    setType(null);
    setTargetPlayerId(null);
    setError("");
  }

  function selectAction(actionId: ActionType) {
    setType(actionId);
    lastSelectAtRef.current = Date.now();
    setError("");
  }

  function deselectAction() {
    setType(null);
    setTargetPlayerId(null);
    setError("");
  }

  function handleActionClick(actionId: ActionType, disabled: boolean) {
    if (disabled) return;
    if (type === actionId) return;
    selectAction(actionId);
  }

  function handleActionDoubleClick(actionId: ActionType, disabled: boolean) {
    if (disabled || type !== actionId) return;
    if (Date.now() - lastSelectAtRef.current < DOUBLE_CLICK_GUARD_MS) return;
    deselectAction();
  }

  function selectTarget(playerId: number) {
    setTargetPlayerId(playerId);
    lastTargetSelectAtRef.current = Date.now();
    setError("");
  }

  function deselectTarget() {
    setTargetPlayerId(null);
    setError("");
  }

  function handleTargetClick(playerId: number) {
    if (targetPlayerId === playerId) return;
    selectTarget(playerId);
  }

  function handleTargetDoubleClick(playerId: number) {
    if (targetPlayerId !== playerId) return;
    if (Date.now() - lastTargetSelectAtRef.current < DOUBLE_CLICK_GUARD_MS) return;
    deselectTarget();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!type) {
      setError("Selecione uma ação.");
      return;
    }
    if (needsTarget && !targetPlayerId) {
      setError("Selecione o jogador alvo.");
      return;
    }
    if (type === "coup" && player.coins < 7) {
      setError("Golpe de Estado custa 7 moedas.");
      return;
    }
    if (type === "assassinate" && player.coins < 3) {
      setError("Assassinar custa 3 moedas.");
      return;
    }
    setBusy(true);
    onDeclare(
      {
        type,
        reason: "",
        targetPlayerId: needsTarget ? targetPlayerId : null,
      },
      (result) => {
        setBusy(false);
        if (!result?.ok) {
          setError(result?.error || "Não foi possível declarar a ação.");
        }
      }
    );
  }

  const stepTitle =
    step === "category"
      ? "Escolha o tipo de ação"
      : category === "character" && selectedAction
        ? selectedAction.label
        : category === "general"
          ? mustCoup
            ? "Golpe de Estado"
            : "Ações gerais"
          : "Ações de personagem";

  return (
    <div
      className="panel-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="player-panel action-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher ação"
      >
        <header className="action-modal-header">
          <div className="action-modal-head-main">
            {step === "actions" && !mustCoup && (
              <button
                type="button"
                className="panel-back-btn"
                onClick={goBack}
                aria-label="Voltar"
              >
                ←
              </button>
            )}
            <div className="action-modal-titles">
              <h2>{stepTitle}</h2>
              <div className="action-modal-stats">
                <span className="stat-chip">
                  <span className="stat-chip-value">{player.coins}</span>
                  <span className="stat-chip-label">moedas</span>
                </span>
                <span className="stat-chip">
                  <span className="stat-chip-value">{aliveCards.length}</span>
                  <span className="stat-chip-label">
                    carta{aliveCards.length === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            </div>
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

        <div className="action-modal-body">
          {mustCoup && (
            <div className="action-modal-alert" role="alert">
              Com 10 ou mais moedas você deve realizar um Golpe de Estado.
            </div>
          )}

          {step === "category" && (
            <div className="modal-step category-step">
              <p className="action-modal-lead">
                Escolha entre ações disponíveis a qualquer jogador ou ações que
                exigem um personagem.
              </p>
              <div className="category-picker">
                <button
                  type="button"
                  className="category-card"
                  onClick={() => pickCategory("general")}
                >
                  <span className="category-card-title">Ações gerais</span>
                  <span className="category-card-desc">
                    Renda, Ajuda Externa e Golpe de Estado
                  </span>
                </button>
                <button
                  type="button"
                  className="category-card"
                  onClick={() => pickCategory("character")}
                >
                  <span className="category-card-title">Ações de personagem</span>
                  <span className="category-card-desc">
                    Duque, Capitão, Assassino, Embaixador e Inquisidor
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === "actions" && (
            <form
              id="action-form"
              className="modal-step actions-step action-modal-form"
              onSubmit={submit}
            >
              <section className="action-modal-section">
                <span className="panel-label">
                  {category === "character" && type
                    ? "Ação escolhida · clique duas vezes para desmarcar"
                    : "Selecione a ação"}
                </span>
                <ul className="action-option-list" role="listbox" aria-label="Ações">
                  {displayedActions.map((action) => {
                    const disabled = isActionDisabled(action);
                    const selected = type === action.id;
                    return (
                      <li key={action.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={`action-option ${selected ? "selected" : ""} ${
                            disabled ? "disabled" : ""
                          }`}
                          onClick={() =>
                            handleActionClick(action.id as ActionType, disabled)
                          }
                          onDoubleClick={() =>
                            handleActionDoubleClick(action.id as ActionType, disabled)
                          }
                          disabled={disabled}
                        >
                          <span className="action-option-label">{action.label}</span>
                          <span className="action-option-hint">
                            {selected && category === "character"
                              ? "Clique duas vezes para desmarcar"
                              : action.hint}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {needsTarget && (
                <section className="action-modal-section">
                  <span className="panel-label">
                    Jogador alvo · clique duas vezes no alvo para desmarcar
                  </span>
                  {targets.length === 0 ? (
                    <p className="form-error action-modal-inline-error">
                      Nenhum outro jogador disponível.
                    </p>
                  ) : (
                    <ul className="target-option-list" role="listbox" aria-label="Alvos">
                      {targets.map((t) => {
                        const selected = targetPlayerId === t.id;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`target-option ${selected ? "selected" : ""}`}
                              onClick={() => handleTargetClick(t.id)}
                              onDoubleClick={() => handleTargetDoubleClick(t.id)}
                            >
                              <span className="target-option-name">{t.name}</span>
                              {type === "steal" && (
                                <span className="target-option-meta">
                                  {t.coins} moedas
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </form>
          )}
        </div>

        {step === "actions" && (
          <footer className="action-modal-footer">
            {error && <p className="form-error action-modal-inline-error">{error}</p>}
            <button
              type="submit"
              form="action-form"
              className="btn primary action-modal-submit"
              disabled={busy || !type || (needsTarget && !targetPlayerId)}
            >
              Confirmar ação
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
