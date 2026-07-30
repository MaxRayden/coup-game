import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "@shared/types/game";
import type { GameActions } from "@/hooks/useGameActions";
import { isTargetOnlyContestAction } from "@shared/constants/actions";
import Chat from "@/components/chat/Chat";
import ActionPanel from "@/components/table/ActionPanel";
import CenterStage from "@/components/table/CenterStage";
import ContestPanel from "@/components/table/ContestPanel";
import JoinRequestsBar from "@/components/table/JoinRequestsBar";
import PlayerSeat from "@/components/table/PlayerSeat";
import { seatPosition } from "@/lib/tableUtils";

export interface TableProps extends GameActions {
  state: GameState;
  meId: number | null;
  isAdmin: boolean;
}

export default function Table({
  state,
  meId,
  isAdmin,
  onDeclareAction,
  onContest,
  onVoteContest,
  onResolve,
  onResolveCounter,
  onChooseDiscard,
  onChooseReturn,
  onAcceptAssassination,
  onDefendAssassination,
  onAcceptCondessaBlock,
  onChallengeCondessaDefense,
  onResolveCondessaDefense,
  onBlockForeignAid,
  onBlockSteal,
  onApproveJoin,
  onRejectJoin,
  onSendChat,
}: TableProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [contestOpen, setContestOpen] = useState(false);
  const lastAutoOpenTurn = useRef<string | null>(null);

  const current = state.players[state.currentTurnIndex];
  const pending = state.pendingAction;
  const me = useMemo(
    () => state.players.find((p) => p.id === meId) ?? null,
    [state.players, meId]
  );

  const isMyTurn =
    state.phase === "playing" &&
    me != null &&
    current?.id === me.id &&
    !me.eliminated &&
    !pending;

  const canActOnSeat = isMyTurn && state.phase === "playing" && !me?.eliminated;

  useEffect(() => {
    const turnKey = `${state.currentTurnIndex}-${current?.id}`;
    if (isMyTurn && lastAutoOpenTurn.current !== turnKey) {
      setPanelOpen(true);
      lastAutoOpenTurn.current = turnKey;
    }
    if (!isMyTurn) {
      lastAutoOpenTurn.current = null;
    }
  }, [isMyTurn, state.currentTurnIndex, current?.id]);

  useEffect(() => {
    if (!pending || pending.status !== "open") {
      setContestOpen(false);
    }
  }, [pending?.id, pending?.status]);

  return (
    <main className="table-screen with-chat">
      <div className="table-column">
        {isAdmin && (
          <JoinRequestsBar
            joinRequests={state.joinRequests ?? []}
            onApproveJoin={onApproveJoin}
            onRejectJoin={onRejectJoin}
          />
        )}

        <div className="table-arena" aria-label="Mesa de jogo">
          <div className="table-felt">
            <CenterStage
              state={state}
              current={current}
              pending={pending}
              me={me}
              isMyTurn={isMyTurn}
              onOpenContest={() => setContestOpen(true)}
              onVoteContest={onVoteContest}
              onResolve={onResolve}
              onResolveCounter={onResolveCounter}
              onChooseDiscard={onChooseDiscard}
              onChooseReturn={onChooseReturn}
              onAcceptAssassination={onAcceptAssassination}
              onDefendAssassination={onDefendAssassination}
              onAcceptCondessaBlock={onAcceptCondessaBlock}
              onChallengeCondessaDefense={onChallengeCondessaDefense}
              onResolveCondessaDefense={onResolveCondessaDefense}
              onBlockForeignAid={onBlockForeignAid}
              onBlockSteal={onBlockSteal}
            />
          </div>

          {state.players.map((player, index) => {
            const pos = seatPosition(index, state.players.length);
            const isTurn =
              state.phase === "playing" &&
              state.currentTurnIndex === index &&
              !player.eliminated;
            const isMine = meId != null && player.id === meId;
            const isMarked =
              pending?.targetPlayerId != null &&
              pending.targetPlayerId === player.id &&
              ["steal", "assassinate", "coup", "investigate"].includes(pending.type);
            return (
              <PlayerSeat
                key={player.id}
                player={player}
                style={pos}
                isTurn={isTurn}
                isMine={isMine}
                isMarked={isMarked}
                onOpen={isMine && canActOnSeat ? () => setPanelOpen(true) : undefined}
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
        pending?.status === "open" &&
        isTargetOnlyContestAction(pending.type) && (
          <ContestPanel
            action={pending}
            viewerId={me?.id ?? null}
            onClose={() => setContestOpen(false)}
            onConfirm={(cb) => {
              onContest((result) => {
                cb?.(result);
                if (result?.ok) setContestOpen(false);
              });
            }}
          />
        )}
    </main>
  );
}
