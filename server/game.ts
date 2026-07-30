/** Estado compartilhado — lobby, ações com contestação e chat. */
// @ts-nocheck — lógica legada; tipagem incremental via shared/types

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const MAX_CHAT = 80;
const MAX_REASON = 200;
const COUP_MANDATORY_COINS = 10;

const CONTESTABLE_ACTIONS = new Set([
  "tax",
  "steal",
  "assassinate",
  "exchange",
  "exchange_one",
]);
const EXCHANGE_ACTIONS = new Set(["exchange", "exchange_one"]);
const TARGET_ACTIONS = new Set(["coup", "steal", "assassinate", "investigate"]);

function mustPerformCoup(player) {
  return player.coins >= COUP_MANDATORY_COINS;
}

function exchangeCounts(type) {
  if (type === "exchange_one") return { draw: 1, return: 1 };
  return { draw: 2, return: 2 };
}

function isExchangeType(type) {
  return EXCHANGE_ACTIONS.has(type);
}

function isContestableAction(action) {
  return Boolean(action && CONTESTABLE_ACTIONS.has(action.type));
}

function targetOnlyContestError(actionType) {
  if (actionType === "steal") {
    return "Só o alvo da extorsão pode contestar se o ator tem Capitão.";
  }
  if (actionType === "assassinate") {
    return "Só o alvo do assassinato pode contestar se o ator tem Assassino.";
  }
  return "Você não pode contestar esta ação.";
}

/** Só o alvo contesta extorsão e assassinato; demais ações seguem regra aberta. */
function canContestPlayer(challenger, action) {
  if (!challenger || challenger.eliminated) return false;
  if (challenger.id === action.playerId) return false;
  if (action.type === "steal" || action.type === "assassinate") {
    return challenger.id === action.targetPlayerId;
  }
  return true;
}

function canBlockForeignAidPlayer(blocker, action) {
  if (!blocker || blocker.eliminated) return false;
  return blocker.id !== action.playerId;
}

function getContestVoteEligiblePlayers(action, kind) {
  if (kind === "block_duke") {
    return state.players.filter((p) => canBlockForeignAidPlayer(p, action));
  }
  return state.players.filter((p) => canContestPlayer(p, action));
}

function hasContestVote(action, playerId) {
  return action.contestVote?.votes.some((v) => v.playerId === playerId) ?? false;
}

function allEligibleVotedNo(action) {
  const kind = action.contestVote?.kind;
  if (!kind) return false;
  const eligible = getContestVoteEligiblePlayers(action, kind);
  if (eligible.length === 0) return false;
  return eligible.every((p) =>
    action.contestVote.votes.some((v) => v.playerId === p.id && v.vote === "no")
  );
}

function finishContestVoteWithoutChallenger(action) {
  const kind = action.contestVote?.kind;
  action.contestVote = null;
  action.status = "open";
  if (kind === "block_duke") {
    pushSystemChat("Ninguém bloqueou — Ajuda Externa segue.");
  } else {
    pushSystemChat("Ninguém contestou — a ação segue.");
  }
  finalizePendingSuccess();
}

function beginContestVoteIfNeeded(action) {
  if (action.type === "steal" || action.type === "assassinate") {
    return false;
  }
  if (action.type === "foreign_aid") {
    const eligible = getContestVoteEligiblePlayers(action, "block_duke");
    if (eligible.length === 0) return false;
    action.status = "contest_vote";
    action.contestVote = { kind: "block_duke", votes: [] };
    return true;
  }
  if (
    isContestableAction(action) &&
    action.type !== "steal" &&
    action.type !== "assassinate"
  ) {
    const eligible = getContestVoteEligiblePlayers(action, "contest");
    if (eligible.length === 0) return false;
    action.status = "contest_vote";
    action.contestVote = { kind: "contest", votes: [] };
    return true;
  }
  return false;
}

function createCard(index) {
  return { id: `card-${index}`, discarded: false };
}

function createLobbyPlayer({ id, name, sessionId, socketId, isAdmin }) {
  return {
    id,
    name: String(name ?? "").trim() || "Jogador",
    sessionId,
    socketId: socketId ?? null,
    isAdmin: Boolean(isAdmin),
    coins: 2,
    cards: [createCard(1), createCard(2)],
    eliminated: false,
  };
}

function createInitialState() {
  return {
    phase: "lobby", // lobby | playing | finished
    players: [],
    adminId: null,
    currentTurnIndex: 0,
    pot: 0,
    winnerId: null,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    pendingAction: null,
    joinRequests: [],
    chat: [],
    endedByAdmin: false,
  };
}

const state = createInitialState();
let nextPlayerId = 1;
let nextChatId = 1;
let nextActionId = 1;
let nextJoinRequestId = 1;
let nextCardId = 100;
/** Callback opcional para o servidor rebroadcastar estado. */
let onStateChange = null;

export function setStateChangeListener(fn) {
  onStateChange = typeof fn === "function" ? fn : null;
}

function notify() {
  onStateChange?.(publicState());
}

export function getState() {
  return publicState();
}

function publicState() {
  const pending = state.pendingAction
    ? {
        ...state.pendingAction,
        draftBy: state.pendingAction.draftBy
          ? {
              playerId: state.pendingAction.draftBy.playerId,
              playerName: state.pendingAction.draftBy.playerName,
            }
          : null,
      }
    : null;

  return {
    ...state,
    players: state.players.map(({ sessionId, ...rest }) => rest),
    joinRequests: state.joinRequests.map(({ sessionId, socketId, ...rest }) => rest),
    pendingAction: pending,
  };
}

function findBySession(sessionId) {
  return state.players.find((p) => p.sessionId === sessionId);
}

function findById(playerId) {
  return state.players.find((p) => p.id === playerId);
}

function assignAdmin(player) {
  state.players.forEach((p) => {
    p.isAdmin = false;
  });
  if (player) {
    player.isAdmin = true;
    state.adminId = player.id;
  } else {
    state.adminId = null;
  }
}

function ensureAdmin() {
  if (state.adminId && findById(state.adminId)) {
    assignAdmin(findById(state.adminId));
    return;
  }
  assignAdmin(state.players[0] ?? null);
}

function clearChallengeTimer() {
  /* sem cronômetros */
}

function trimReason(text) {
  return String(text ?? "")
    .trim()
    .slice(0, MAX_REASON);
}

function actionLabel(action) {
  if (!action) return "";
  if (action.type === "income") return "Renda — 1 moeda";
  if (action.type === "foreign_aid") return "Ajuda Externa — 2 moedas";
  if (action.type === "coup") {
    return action.targetPlayerName
      ? `Golpe de Estado em ${action.targetPlayerName}`
      : "Golpe de Estado";
  }
  if (action.type === "tax") return "Duque — Taxas (3 moedas)";
  if (action.type === "exchange") return "Embaixador — trocar 2 cartas";
  if (action.type === "exchange_one") return "Inquisidor — trocar 1 carta";
  if (action.type === "investigate") {
    return action.targetPlayerName
      ? `Inquisidor — investigar ${action.targetPlayerName}`
      : "Inquisidor — investigar";
  }
  if (action.type === "steal") {
    return action.targetPlayerName
      ? `Capitão — extorquir ${action.targetPlayerName}`
      : "Capitão — extorquir";
  }
  if (action.type === "assassinate") {
    return action.targetPlayerName
      ? `Assassino — assassinar ${action.targetPlayerName}`
      : "Assassino — assassinar";
  }
  return action.type;
}

function defaultActionReason(type, targetPlayerName) {
  const labels = {
    income: "Renda — recebo 1 moeda",
    foreign_aid: "Ajuda Externa — recebo 2 moedas",
    coup: `Golpe de Estado — pago 7 e elimino influência de ${targetPlayerName}`,
    tax: "Duque — recebo 3 moedas de taxas",
    steal: `Capitão — extorquir 2 moedas de ${targetPlayerName}`,
    assassinate: `Assassino — pago 3 e elimino uma carta de ${targetPlayerName}`,
    exchange: "Embaixador — compro 2 cartas e devolvo 2",
    exchange_one: "Inquisidor — compro 1 carta e devolvo 1",
    investigate: `Inquisidor — investigo ${targetPlayerName}`,
  };
  return labels[type] ?? "";
}

export function attachSocketSession(socketId, sessionId) {
  const sid = String(sessionId ?? "").trim();
  if (!sid) return { ok: false };

  const player = findBySession(sid);
  if (!player) return { ok: false };

  const oldSocketId =
    player.socketId && player.socketId !== socketId ? player.socketId : null;
  player.socketId = socketId;
  return { ok: true, playerId: player.id, oldSocketId };
}

export function joinLobby({ name, sessionId, socketId }) {
  const sid = String(sessionId ?? "").trim();
  if (!sid) return { ok: false, error: "Sessão inválida." };

  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Digite um nome." };
  if (trimmed.length > 24) return { ok: false, error: "Nome muito longo (máx. 24)." };

  const existing = findBySession(sid);
  if (existing) {
    if (state.phase === "lobby") {
      existing.name = trimmed;
      existing.socketId = socketId;
    } else {
      existing.socketId = socketId;
    }
    return { ok: true, playerId: existing.id, reclaimed: true };
  }

  // Atualiza pedido pendente da mesma sessão
  const existingRequest = state.joinRequests.find((r) => r.sessionId === sid);
  if (existingRequest) {
    existingRequest.name = trimmed;
    existingRequest.socketId = socketId;
    return {
      ok: true,
      pending: true,
      requestId: existingRequest.id,
      reclaimed: true,
    };
  }

  if (state.phase === "playing") {
    return requestJoinDuringGame({ name: trimmed, sessionId: sid, socketId });
  }

  if (state.phase !== "lobby") {
    return {
      ok: false,
      error: "A partida já terminou. Aguarde o retorno ao lobby.",
    };
  }

  if (state.players.length >= MAX_PLAYERS) {
    return { ok: false, error: `Sala cheia (máx. ${MAX_PLAYERS}).` };
  }

  const nameTaken = state.players.some(
    (p) => p.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (nameTaken) return { ok: false, error: "Esse nome já está na sala." };

  const player = createLobbyPlayer({
    id: nextPlayerId++,
    name: trimmed,
    sessionId: sid,
    socketId,
    isAdmin: state.players.length === 0,
  });
  state.players.push(player);
  if (player.isAdmin) state.adminId = player.id;
  else ensureAdmin();

  return { ok: true, playerId: player.id, reclaimed: false };
}

/** Reseta a sala e cria um lobby novo com o jogador como admin. */
export function createNewLobby({ name, sessionId, socketId }) {
  const sid = String(sessionId ?? "").trim();
  if (!sid) return { ok: false, error: "Sessão inválida." };

  const trimmed = String(name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Digite um nome." };
  if (trimmed.length > 24) return { ok: false, error: "Nome muito longo (máx. 24)." };

  clearChallengeTimer();
  nextPlayerId = 1;
  nextChatId = 1;
  nextActionId = 1;
  nextJoinRequestId = 1;
  nextCardId = 100;

  const fresh = createInitialState();
  Object.assign(state, fresh);

  const player = createLobbyPlayer({
    id: nextPlayerId++,
    name: trimmed,
    sessionId: sid,
    socketId,
    isAdmin: true,
  });
  state.players.push(player);
  state.adminId = player.id;
  pushSystemChat(`${player.name} criou um novo lobby.`);

  return { ok: true, playerId: player.id };
}

function requestJoinDuringGame({ name, sessionId, socketId }) {
  if (state.players.length + state.joinRequests.length >= MAX_PLAYERS) {
    return { ok: false, error: `Sala cheia (máx. ${MAX_PLAYERS}).` };
  }

  const nameTaken =
    state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()) ||
    state.joinRequests.some((r) => r.name.toLowerCase() === name.toLowerCase());
  if (nameTaken) {
    return { ok: false, error: "Esse nome já está na sala ou na fila." };
  }

  const request = {
    id: nextJoinRequestId++,
    name,
    sessionId,
    socketId: socketId ?? null,
    requestedAt: Date.now(),
  };
  state.joinRequests.push(request);
  pushSystemChat(`${name} pediu para entrar na partida.`);
  return { ok: true, pending: true, requestId: request.id };
}

export function approveJoinRequest(adminSessionId, requestId) {
  const admin = findBySession(adminSessionId);
  if (!admin || admin.id !== state.adminId) {
    return { ok: false, error: "Só o admin pode aprovar entradas." };
  }
  if (state.phase !== "playing") {
    return { ok: false, error: "Só é possível aprovar durante a partida." };
  }

  const idx = state.joinRequests.findIndex((r) => r.id === Number(requestId));
  if (idx === -1) return { ok: false, error: "Pedido não encontrado." };

  const request = state.joinRequests[idx];

  if (state.players.length >= MAX_PLAYERS) {
    return { ok: false, error: `Sala cheia (máx. ${MAX_PLAYERS}).` };
  }

  const nameTaken = state.players.some(
    (p) => p.name.toLowerCase() === request.name.toLowerCase()
  );
  if (nameTaken) {
    return { ok: false, error: "Esse nome já está na mesa." };
  }

  state.joinRequests.splice(idx, 1);

  const player = createLobbyPlayer({
    id: nextPlayerId++,
    name: request.name,
    sessionId: request.sessionId,
    socketId: request.socketId,
    isAdmin: false,
  });
  state.players.push(player);
  pushSystemChat(`${player.name} entrou na partida (aprovado pelo admin).`);

  return {
    ok: true,
    playerId: player.id,
    sessionId: request.sessionId,
    socketId: request.socketId,
  };
}

export function rejectJoinRequest(adminSessionId, requestId) {
  const admin = findBySession(adminSessionId);
  if (!admin || admin.id !== state.adminId) {
    return { ok: false, error: "Só o admin pode recusar entradas." };
  }

  const idx = state.joinRequests.findIndex((r) => r.id === Number(requestId));
  if (idx === -1) return { ok: false, error: "Pedido não encontrado." };

  const request = state.joinRequests[idx];
  state.joinRequests.splice(idx, 1);
  pushSystemChat(`Pedido de ${request.name} foi recusado.`);

  return {
    ok: true,
    sessionId: request.sessionId,
    socketId: request.socketId,
    name: request.name,
  };
}

export function cancelJoinRequest(sessionId) {
  const idx = state.joinRequests.findIndex((r) => r.sessionId === sessionId);
  if (idx === -1) return { ok: true };
  const request = state.joinRequests[idx];
  state.joinRequests.splice(idx, 1);
  pushSystemChat(`${request.name} cancelou o pedido de entrada.`);
  return { ok: true };
}

export function leaveLobby(sessionId) {
  if (state.phase !== "lobby") return publicState();
  const idx = state.players.findIndex((p) => p.sessionId === sessionId);
  if (idx === -1) return publicState();
  const wasAdmin = state.players[idx].id === state.adminId;
  state.players.splice(idx, 1);
  if (wasAdmin) ensureAdmin();
  return publicState();
}

export function disconnectSocket(socketId) {
  const pendingReq = state.joinRequests.find((r) => r.socketId === socketId);
  if (pendingReq) {
    cancelJoinRequest(pendingReq.sessionId);
  }

  const player = state.players.find((p) => p.socketId === socketId);
  if (!player) return publicState();
  player.socketId = null;

  // Se estava escrevendo contestação, cancela e retoma o timer
  if (
    state.phase === "playing" &&
    state.pendingAction?.status === "contest_draft" &&
    state.pendingAction.draftBy?.sessionId === player.sessionId
  ) {
    cancelContestDraft(player.sessionId);
  }

  if (state.phase === "lobby") return leaveLobby(player.sessionId);
  return publicState();
}

export function startGame(requesterSessionId) {
  if (state.phase !== "lobby") {
    return { ok: false, error: "A partida já começou." };
  }
  const requester = findBySession(requesterSessionId);
  if (!requester || requester.id !== state.adminId) {
    return { ok: false, error: "Só o admin da sala pode iniciar." };
  }
  if (state.players.length < MIN_PLAYERS) {
    return {
      ok: false,
      error: `É preciso pelo menos ${MIN_PLAYERS} jogadores.`,
    };
  }

  clearChallengeTimer();
  nextCardId = 100;
  state.players = state.players.map((p) => ({
    ...p,
    coins: 2,
    cards: [createCard(1), createCard(2)],
    eliminated: false,
  }));
  state.currentTurnIndex = 0;
  state.pot = 0;
  state.winnerId = null;
  state.pendingAction = null;
  state.joinRequests = [];
  state.chat = [];
  state.endedByAdmin = false;
  state.phase = "playing";
  return { ok: true };
}

function activePlayers() {
  return state.players.filter((p) => !p.eliminated);
}

function checkWinner() {
  const alive = activePlayers();
  if (alive.length === 1) {
    state.phase = "finished";
    state.winnerId = alive[0].id;
    clearChallengeTimer();
    state.pendingAction = null;
  }
}

function aliveCardCount(player) {
  return player.cards.filter((c) => !c.discarded).length;
}

function advanceTurnInternal() {
  if (state.phase !== "playing") return;
  const n = state.players.length;
  if (n === 0) return;
  for (let i = 0; i < n; i++) {
    state.currentTurnIndex = (state.currentTurnIndex + 1) % n;
    if (!state.players[state.currentTurnIndex].eliminated) return;
  }
}

function markEliminatedIfNeeded(player) {
  if (aliveCardCount(player) === 0) {
    player.eliminated = true;
    if (state.players[state.currentTurnIndex]?.id === player.id) {
      advanceTurnInternal();
    }
    checkWinner();
  }
}

/** Alvo contestou o Assassino e perdeu — perde as duas cartas e é eliminado; assassino troca carta. */
function finalizeAssassinateTargetFailedChallenge(action) {
  const target = findById(action.targetPlayerId);
  if (target) {
    for (const card of target.cards) {
      if (!card.discarded) card.discarded = true;
    }
    target.eliminated = true;
    pushSystemChat(
      `${target.name} contestou o Assassino incorretamente — perde as duas cartas e está eliminado.`
    );
    checkWinner();
  }

  const actor = findById(action.playerId);
  applyAssassinatePayment(actor);

  beginActorCardSwap(action, () => {
    state.pendingAction = null;
    clearChallengeTimer();
    if (state.phase === "playing") {
      advanceTurnInternal();
    }
  });
}

/** Após ganhar contestação, prova o personagem trocando carta (volta ao baralho, compra outra). */
function swapProofCard(player, cardId) {
  const alive = player.cards.filter((c) => !c.discarded);
  const card =
    alive.find((c) => c.id === cardId) || (alive.length === 1 ? alive[0] : null);
  if (!card) return false;
  const idx = player.cards.findIndex((c) => c.id === card.id);
  if (idx === -1) return false;
  player.cards.splice(idx, 1);
  drawCardsForPlayer(player, 1);
  return true;
}

function beginProofCardSwap(action, playerId, onComplete) {
  const player = findById(playerId);
  if (!player || player.eliminated) {
    onComplete?.();
    return;
  }

  const alive = player.cards.filter((c) => !c.discarded);
  if (alive.length === 0) {
    onComplete?.();
    return;
  }

  if (alive.length === 1) {
    swapProofCard(player, alive[0].id);
    pushSystemChat(`${player.name} trocou uma carta ao provar o personagem.`);
    onComplete?.();
    return;
  }

  clearChallengeTimer();
  action.status = "awaiting_discard";
  action.discard = {
    playerId: player.id,
    playerName: player.name,
    afterActorWinSwap: true,
    actorWinsChallenge: true,
  };
  action._swapComplete = onComplete;
  pushSystemChat(`${player.name} deve escolher uma carta para trocar (prova do personagem).`);
}

function finishBlockShowAfterActorDiscard(action) {
  const defenderId = action.defense?.playerId;
  beginProofCardSwap(action, defenderId, () => {
    if (getBlockKind(action) === "Condessa") {
      finalizeCondessaBlockSuccess();
    } else {
      finalizeBlockSuccess();
    }
  });
}

/** Após ganhar contestação, ator troca carta (prova do personagem). */
function beginActorCardSwap(action, onComplete) {
  beginProofCardSwap(action, action.playerId, onComplete);
}

function finishChallengeDiscardFlow(action, actorWinsChallenge) {
  if (action.actorMustSwapAfterWin && actorWinsChallenge) {
    action.actorMustSwapAfterWin = false;
    beginActorCardSwap(action, () =>
      completeChallengeAfterDiscard({ actorWinsChallenge: true })
    );
    return;
  }
  completeChallengeAfterDiscard({ actorWinsChallenge });
}

function drawCardsForPlayer(player, count) {
  for (let i = 0; i < count; i++) {
    player.cards.push(createCard(nextCardId++));
  }
}

function returnCardsToDeck(player, cardIds) {
  const ids = new Set(cardIds);
  player.cards = player.cards.filter((c) => !ids.has(c.id));
  markEliminatedIfNeeded(player);
}

function applyActionEffects(action) {
  const player = findById(action.playerId);
  if (!player || player.eliminated) return;

  if (action.type === "income") {
    player.coins += 1;
    state.pot = Math.max(0, state.pot - 1);
  } else if (action.type === "foreign_aid") {
    player.coins += 2;
    state.pot = Math.max(0, state.pot - 2);
  } else if (action.type === "tax") {
    player.coins += 3;
    state.pot = Math.max(0, state.pot - 3);
  } else if (action.type === "steal") {
    const target = findById(action.targetPlayerId);
    if (!target || target.eliminated) return;
    const stolen = Math.min(2, Math.max(0, target.coins));
    target.coins -= stolen;
    player.coins += stolen;
  }
}

function applyAssassinatePayment(actor) {
  if (!actor) return;
  actor.coins = Math.max(0, actor.coins - 3);
}

function applyCoupPayment(actor) {
  if (!actor) return;
  actor.coins = Math.max(0, actor.coins - 7);
}

function beginTargetInfluenceLoss(action, onComplete) {
  const target = findById(action.targetPlayerId);
  if (!target || target.eliminated) {
    onComplete();
    return;
  }

  const alive = target.cards.filter((c) => !c.discarded);
  if (alive.length === 0) {
    onComplete();
    return;
  }

  if (alive.length === 1) {
    alive[0].discarded = true;
    markEliminatedIfNeeded(target);
    pushSystemChat(`${target.name} perdeu uma carta.`);
    onComplete();
    return;
  }

  clearChallengeTimer();
  action.status = "awaiting_discard";
  action.discard = {
    playerId: target.id,
    playerName: target.name,
    afterInfluenceLoss: true,
  };
  pushSystemChat(`${target.name} deve escolher uma carta para descartar.`);
}

function completeDeclaredActionAndAdvance(action) {
  pushSystemChat(`${action.playerName}: ${actionLabel(action)} — ${action.reason}`);
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function beginAwaitingReturn(action, onComplete) {
  const player = findById(action.playerId);
  if (!player || player.eliminated) {
    onComplete();
    return;
  }

  const required = action.exchangeReturn ?? 2;
  const alive = player.cards.filter((c) => !c.discarded);
  if (alive.length < required) {
    onComplete();
    return;
  }

  if (alive.length === required) {
    returnCardsToDeck(
      player,
      alive.map((c) => c.id)
    );
    pushSystemChat(`${player.name} devolveu ${required} carta(s).`);
    onComplete();
    return;
  }

  clearChallengeTimer();
  action.status = "awaiting_return";
  action.returnCards = {
    playerId: player.id,
    playerName: player.name,
    required,
  };
  pushSystemChat(`${player.name} comprou cartas e deve devolver ${required}.`);
}

function finalizeExchangeSuccess() {
  const action = state.pendingAction;
  if (!action || !isExchangeType(action.type)) return;

  const actor = findById(action.playerId);
  if (!actor) {
    state.pendingAction = null;
    clearChallengeTimer();
    return;
  }

  const counts = exchangeCounts(action.type);
  action.exchangeDraw = counts.draw;
  action.exchangeReturn = counts.return;
  drawCardsForPlayer(actor, counts.draw);
  beginAwaitingReturn(action, () => completeDeclaredActionAndAdvance(action));
}

function finalizeAssassinateSuccess() {
  const action = state.pendingAction;
  if (!action || action.type !== "assassinate") return;

  const actor = findById(action.playerId);
  if (!actor) {
    state.pendingAction = null;
    clearChallengeTimer();
    return;
  }

  applyAssassinatePayment(actor);
  beginTargetInfluenceLoss(action, () => completeDeclaredActionAndAdvance(action));
}

function finalizeCoupSuccess(action) {
  const actor = findById(action.playerId);
  if (!actor) return;

  applyCoupPayment(actor);
  state.pendingAction = action;
  beginTargetInfluenceLoss(action, () => completeDeclaredActionAndAdvance(action));
}

function finalizeInstantAction(action) {
  if (isExchangeType(action.type)) {
    state.pendingAction = action;
    finalizeExchangeSuccess();
    return;
  }

  applyActionEffects(action);
  pushSystemChat(`${action.playerName}: ${actionLabel(action)} — ${action.reason}`);
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function buildPendingAction(actor, payload) {
  const type = payload.type;
  const targetPlayerId = payload.targetPlayerId ?? null;
  const targetPlayerName = payload.targetPlayerName ?? null;
  const reason = payload.reason;
  const label = actionLabel({ type, targetPlayerName });

  return {
    id: `act-${nextActionId++}`,
    playerId: actor.id,
    playerName: actor.name,
    type,
    targetPlayerId,
    targetPlayerName,
    reason,
    label,
    status: "open",
    endsAt: null,
    remainingMs: null,
    draftBy: null,
    contestVote: null,
    contest: null,
    resolution: null,
  };
}

function startOpenAction(action) {
  action.endsAt = null;
  action.remainingMs = null;
  action.contestVote = null;
  if (beginContestVoteIfNeeded(action)) {
    return;
  }
  action.status = "open";
}

function pushSystemChat(text) {
  state.chat.push({
    id: nextChatId++,
    playerId: null,
    playerName: "Sistema",
    text,
    at: Date.now(),
    system: true,
  });
  if (state.chat.length > MAX_CHAT) {
    state.chat = state.chat.slice(-MAX_CHAT);
  }
}

function acceptCondessaBlockInternal(chatLine) {
  acceptDefenseInternal(chatLine);
}

function getBlockKind(action) {
  return action?.defense?.blockKind ?? "Condessa";
}

function acceptDefenseInternal(chatLine) {
  const action = state.pendingAction;
  if (!action || action.status !== "Condessa_defense") return;

  const blockKind = getBlockKind(action);
  if (chatLine) pushSystemChat(chatLine);

  if (blockKind === "Condessa") {
    const actor = findById(action.playerId);
    applyAssassinatePayment(actor);
    pushSystemChat(
      `Assassinato bloqueado — ${action.defense?.playerName ?? "alvo"} manteve a Condessa.`
    );
  } else {
    pushSystemChat(
      `Bloqueio aceito — a ação de ${action.playerName} não surte efeito.`
    );
  }

  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function finalizeBlockSuccess() {
  const action = state.pendingAction;
  if (!action) return;
  if (getBlockKind(action) === "Condessa") {
    finalizeCondessaBlockSuccess();
    return;
  }
  pushSystemChat(
    `Bloqueio confirmado — a ação de ${action.playerName} não surte efeito.`
  );
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function finalizeBlockFailed() {
  const action = state.pendingAction;
  if (!action) return;
  if (getBlockKind(action) === "Condessa") {
    finalizeCondessaBlockFailed();
    return;
  }
  pushSystemChat(
    `${action.defense?.playerName ?? "Defensor"} não tinha a carta — a ação de ${action.playerName} continua.`
  );
  finalizePendingSuccess();
}

function finalizeCondessaBlockSuccess() {
  const action = state.pendingAction;
  if (!action) return;

  const actor = findById(action.playerId);
  applyAssassinatePayment(actor);
  pushSystemChat(
    `${action.defense?.playerName ?? "Alvo"} provou a Condessa — assassinato bloqueado.`
  );
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function finalizeCondessaBlockFailed() {
  const action = state.pendingAction;
  if (!action || action.type !== "assassinate") return;

  const actor = findById(action.playerId);
  applyAssassinatePayment(actor);
  pushSystemChat(
    `${action.defense?.playerName ?? "Alvo"} não tinha a Condessa — assassinato continua.`
  );
  beginTargetInfluenceLoss(action, () => completeDeclaredActionAndAdvance(action));
}

function finalizePendingSuccess() {
  const action = state.pendingAction;
  if (!action) return;

  if (action.type === "assassinate") {
    finalizeAssassinateSuccess();
    return;
  }

  if (isExchangeType(action.type)) {
    finalizeExchangeSuccess();
    return;
  }

  applyActionEffects(action);
  pushSystemChat(`${action.playerName}: ${actionLabel(action)} — ${action.reason}`);
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

/**
 * Declara ação na vez do jogador.
 */
export function declareAction(sessionId, payload) {
  if (state.phase !== "playing") {
    return { ok: false, error: "A partida não está em andamento." };
  }
  if (state.pendingAction) {
    return { ok: false, error: "Já existe uma ação em andamento." };
  }

  const actor = findBySession(sessionId);
  if (!actor || actor.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }
  const current = state.players[state.currentTurnIndex];
  if (!current || current.id !== actor.id) {
    return { ok: false, error: "Não é a sua vez." };
  }

  const type = payload?.type;
  const reason = trimReason(payload?.reason);
  const validTypes = [
    "income",
    "foreign_aid",
    "coup",
    "tax",
    "steal",
    "assassinate",
    "exchange",
    "exchange_one",
    "investigate",
  ];
  if (!validTypes.includes(type)) {
    return { ok: false, error: "Escolha uma ação válida." };
  }

  if (mustPerformCoup(actor) && type !== "coup") {
    return {
      ok: false,
      error: "Com 10 ou mais moedas você deve realizar um Golpe de Estado.",
    };
  }

  let targetPlayerId = null;
  let targetPlayerName = null;

  if (TARGET_ACTIONS.has(type)) {
    const targetId = Number(payload?.targetPlayerId);
    const target = findById(targetId);
    if (!target || target.eliminated) {
      return { ok: false, error: "Selecione um jogador alvo." };
    }
    if (target.id === actor.id) {
      return { ok: false, error: "Escolha outro jogador como alvo." };
    }
    targetPlayerId = target.id;
    targetPlayerName = target.name;
  }

  if (type === "coup" && actor.coins < 7) {
    return { ok: false, error: "Golpe de Estado custa 7 moedas." };
  }
  if (type === "assassinate" && actor.coins < 3) {
    return { ok: false, error: "Assassinar custa 3 moedas." };
  }

  const finalReason = reason || defaultActionReason(type, targetPlayerName);
  const action = buildPendingAction(actor, {
    type,
    targetPlayerId,
    targetPlayerName,
    reason: finalReason,
  });

  if (type === "income") {
    finalizeInstantAction(action);
    return { ok: true };
  }

  if (type === "investigate") {
    pushSystemChat(`${actor.name}: ${actionLabel(action)} — ${finalReason}`);
    if (state.phase === "playing") {
      advanceTurnInternal();
    }
    return { ok: true };
  }

  if (type === "coup") {
    finalizeCoupSuccess(action);
    return { ok: true };
  }

  state.pendingAction = action;
  startOpenAction(action);
  return { ok: true };
}

/** Pausa o timer enquanto alguém escreve a contestação. Qualquer jogador (exceto o ator) pode contestar. */
export function beginContestDraft(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para contestar." };
  }
  const action = state.pendingAction;
  if (!isContestableAction(action)) {
    return { ok: false, error: "Esta ação não pode ser contestada." };
  }
  if (action.status === "contest_draft") {
    if (action.draftBy?.sessionId === sessionId) {
      return { ok: true, already: true };
    }
    return {
      ok: false,
      error: "Outra pessoa já está contestando esta ação.",
    };
  }
  if (action.status !== "open") {
    return { ok: false, error: "Esta ação não pode mais ser contestada." };
  }

  const challenger = findBySession(sessionId);
  if (!challenger || challenger.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }
  if (challenger.id === action.playerId) {
    return { ok: false, error: "Você não pode contestar a própria ação." };
  }
  if (!canContestPlayer(challenger, action)) {
    return { ok: false, error: targetOnlyContestError(action.type) };
  }

  clearChallengeTimer();
  action.status = "contest_draft";
  action.remainingMs = null;
  action.endsAt = null;
  action.draftBy = {
    playerId: challenger.id,
    playerName: challenger.name,
    sessionId,
  };
  return { ok: true };
}

/** Retoma o timer se o jogador cancelar a escrita da contestação. */
export function cancelContestDraft(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Nada para cancelar." };
  }
  const action = state.pendingAction;
  if (action.status !== "contest_draft") {
    return { ok: false, error: "Nenhum rascunho de contestação." };
  }
  if (action.draftBy?.sessionId !== sessionId) {
    return { ok: false, error: "Só quem iniciou a contestação pode cancelar." };
  }

  action.status = "open";
  action.draftBy = null;
  action.remainingMs = null;
  action.endsAt = null;
  return { ok: true };
}

export function contestAction(sessionId, { reason } = {}) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para contestar." };
  }
  const action = state.pendingAction;

  if (!isContestableAction(action)) {
    return { ok: false, error: "Esta ação não pode ser contestada." };
  }

  if (action.status === "contest_vote") {
    return { ok: false, error: "Use SIM ou NÃO na votação em andamento." };
  }

  if (action.status !== "open") {
    return { ok: false, error: "Esta ação não pode mais ser contestada." };
  }

  const challenger = findBySession(sessionId);
  if (!challenger || challenger.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }
  if (challenger.id === action.playerId) {
    return { ok: false, error: "Você não pode contestar a própria ação." };
  }
  if (!canContestPlayer(challenger, action)) {
    return { ok: false, error: targetOnlyContestError(action.type) };
  }

  clearChallengeTimer();
  action.status = "contested";
  action.draftBy = null;
  action.contest = {
    playerId: challenger.id,
    playerName: challenger.name,
    reason: "",
  };
  pushSystemChat(`${challenger.name} contestou ${action.playerName}.`);
  return { ok: true };
}

export function voteOnContest(sessionId, { vote } = {}) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há votação em andamento." };
  }
  const action = state.pendingAction;
  if (action.status !== "contest_vote" || !action.contestVote) {
    return { ok: false, error: "Não há votação em andamento." };
  }
  if (action.type === "steal" || action.type === "assassinate") {
    return { ok: false, error: "Esta ação não usa votação." };
  }

  const choice = vote === "yes" ? "yes" : vote === "no" ? "no" : null;
  if (!choice) {
    return { ok: false, error: "Escolha SIM ou NÃO." };
  }

  const voter = findBySession(sessionId);
  if (!voter || voter.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }

  const kind = action.contestVote.kind;
  const eligible =
    kind === "block_duke"
      ? canBlockForeignAidPlayer(voter, action)
      : canContestPlayer(voter, action);
  if (!eligible) {
    return { ok: false, error: "Você não pode votar nesta votação." };
  }
  if (hasContestVote(action, voter.id)) {
    return { ok: false, error: "Você já votou." };
  }

  if (choice === "yes") {
    action.contestVote = null;
    if (kind === "block_duke") {
      action.status = "Condessa_defense";
      action.defense = {
        playerId: voter.id,
        playerName: voter.name,
        blockKind: "duke",
      };
      pushSystemChat(
        `${voter.name} bloqueou Ajuda Externa de ${action.playerName} (Duque).`
      );
    } else {
      action.status = "contested";
      action.endsAt = null;
      action.remainingMs = null;
      action.draftBy = null;
      action.contest = {
        playerId: voter.id,
        playerName: voter.name,
        reason: "",
      };
      pushSystemChat(`${voter.name} contestou ${action.playerName}.`);
    }
    return { ok: true };
  }

  action.contestVote.votes.push({
    playerId: voter.id,
    playerName: voter.name,
    vote: "no",
  });

  if (allEligibleVotedNo(action)) {
    finishContestVoteWithoutChallenger(action);
  }

  return { ok: true };
}

/**
 * Prepara o fim da contestação: quem perdeu escolhe a carta a descartar.
 */
function beginAwaitingDiscard({
  loserId,
  actorWinsChallenge,
  actorMustSwapAfterWin = false,
  chatLines,
  afterInfluenceLoss = false,
  afterCondessaShow = false,
  afterCondessaFail = false,
  afterBlockShow = false,
  afterBlockFail = false,
}) {
  const action = state.pendingAction;
  if (!action) return;

  for (const line of chatLines ?? []) pushSystemChat(line);

  if (actorMustSwapAfterWin && actorWinsChallenge) {
    action.actorMustSwapAfterWin = true;
  }

  if (
    action.type === "assassinate" &&
    loserId === action.targetPlayerId &&
    actorWinsChallenge
  ) {
    finalizeAssassinateTargetFailedChallenge(action);
    return;
  }

  const loser = findById(loserId);
  if (!loser || loser.eliminated) {
    if (afterCondessaShow) {
      finalizeCondessaBlockSuccess();
      return;
    }
    if (afterCondessaFail) {
      finalizeCondessaBlockFailed();
      return;
    }
    if (afterBlockShow) {
      finalizeBlockSuccess();
      return;
    }
    if (afterBlockFail) {
      finalizeBlockFailed();
      return;
    }
    completeChallengeAfterDiscard({ actorWinsChallenge });
    return;
  }

  const alive = loser.cards.filter((c) => !c.discarded);
  if (alive.length === 0) {
    if (afterCondessaShow) {
      finalizeCondessaBlockSuccess();
      return;
    }
    if (afterCondessaFail) {
      finalizeCondessaBlockFailed();
      return;
    }
    if (afterBlockShow) {
      finalizeBlockSuccess();
      return;
    }
    if (afterBlockFail) {
      finalizeBlockFailed();
      return;
    }
    completeChallengeAfterDiscard({ actorWinsChallenge });
    return;
  }

  if (alive.length === 1) {
    alive[0].discarded = true;
    markEliminatedIfNeeded(loser);
    pushSystemChat(`${loser.name} perdeu sua última carta.`);
    if (afterCondessaShow) {
      finalizeCondessaBlockSuccess();
      return;
    }
    if (afterCondessaFail) {
      finalizeCondessaBlockFailed();
      return;
    }
    if (afterBlockShow) {
      finalizeBlockSuccess();
      return;
    }
    if (afterBlockFail) {
      finalizeBlockFailed();
      return;
    }
    if (afterInfluenceLoss) {
      completeDeclaredActionAndAdvance({
        playerId: action.playerId,
        playerName: action.playerName,
        label: action.label,
        reason: action.reason,
        type: action.type,
        targetPlayerId: action.targetPlayerId,
        targetPlayerName: action.targetPlayerName,
      });
      return;
    }
    finishChallengeDiscardFlow(action, actorWinsChallenge);
    return;
  }

  clearChallengeTimer();
  action.status = "awaiting_discard";
  action.discard = {
    playerId: loser.id,
    playerName: loser.name,
    actorWinsChallenge: Boolean(actorWinsChallenge),
    afterInfluenceLoss: Boolean(afterInfluenceLoss),
    afterCondessaShow: Boolean(afterCondessaShow),
    afterCondessaFail: Boolean(afterCondessaFail),
    afterBlockShow: Boolean(afterBlockShow),
    afterBlockFail: Boolean(afterBlockFail),
  };
  pushSystemChat(`${loser.name} deve escolher uma carta para descartar.`);
}

function completeChallengeAfterDiscard({ actorWinsChallenge }) {
  const action = state.pendingAction;
  if (!action) return;

  const saved = {
    playerId: action.playerId,
    playerName: action.playerName,
    label: action.label,
    reason: action.reason,
    type: action.type,
    amount: action.amount,
    cardId: action.cardId,
    targetPlayerId: action.targetPlayerId,
    targetPlayerName: action.targetPlayerName,
  };

  if (actorWinsChallenge && saved.type === "assassinate" && state.phase === "playing") {
    const actor = findById(saved.playerId);
    const target = findById(saved.targetPlayerId);
    if (target?.eliminated) {
      applyAssassinatePayment(actor);
      state.pendingAction = null;
      clearChallengeTimer();
      advanceTurnInternal();
      return;
    }
    applyAssassinatePayment(actor);
    beginTargetInfluenceLoss(action, () => completeDeclaredActionAndAdvance(saved));
    return;
  }

  if (actorWinsChallenge && isExchangeType(saved.type) && state.phase === "playing") {
    finalizeExchangeSuccess();
    return;
  }

  if (actorWinsChallenge && state.phase === "playing") {
    applyActionEffects(saved);
    pushSystemChat(`${saved.playerName}: ${saved.label} — ${saved.reason}`);
  }

  state.pendingAction = null;
  clearChallengeTimer();

  if (state.phase !== "playing") return;

  if (actorWinsChallenge) {
    const actor = findById(saved.playerId);
    if (actor && !actor.eliminated) advanceTurnInternal();
    else {
      const current = state.players[state.currentTurnIndex];
      if (!current || current.eliminated) advanceTurnInternal();
    }
  } else {
    const actor = findById(saved.playerId);
    if (!actor || actor.eliminated) {
      const current = state.players[state.currentTurnIndex];
      if (!current || current.eliminated) advanceTurnInternal();
    }
  }
}

/** Perdedor da contestação escolhe qual carta descartar. */
export function chooseChallengeDiscard(sessionId, cardId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Nada para descartar." };
  }
  const action = state.pendingAction;
  if (action.status !== "awaiting_discard" || !action.discard) {
    return { ok: false, error: "Nenhum descarte pendente." };
  }

  const player = findBySession(sessionId);
  if (!player || player.id !== action.discard.playerId) {
    return {
      ok: false,
      error: action.discard.afterActorWinSwap
        ? "Só quem está provando o personagem escolhe a carta."
        : "Só quem perdeu escolhe a carta.",
    };
  }

  const alive = player.cards.filter((c) => !c.discarded);
  const card =
    alive.find((c) => c.id === cardId) || (alive.length === 1 ? alive[0] : null);
  if (!card) return { ok: false, error: "Escolha uma carta válida." };

  if (action.discard.afterActorWinSwap) {
    if (!swapProofCard(player, card.id)) {
      return { ok: false, error: "Escolha uma carta válida." };
    }
    pushSystemChat(`${player.name} trocou uma carta ao provar o personagem.`);
    const onComplete = action._swapComplete;
    action._swapComplete = null;
    action.discard = null;
    if (typeof onComplete === "function") {
      onComplete();
    } else {
      completeChallengeAfterDiscard({ actorWinsChallenge: true });
    }
    return { ok: true };
  }

  card.discarded = true;
  markEliminatedIfNeeded(player);
  pushSystemChat(`${player.name} descartou uma carta.`);

  if (action.discard.afterInfluenceLoss) {
    completeDeclaredActionAndAdvance({
      playerId: action.playerId,
      playerName: action.playerName,
      label: action.label,
      reason: action.reason,
      type: action.type,
      targetPlayerId: action.targetPlayerId,
      targetPlayerName: action.targetPlayerName,
    });
    return { ok: true };
  }

  if (action.discard.afterCondessaShow) {
    finishBlockShowAfterActorDiscard(action);
    return { ok: true };
  }

  if (action.discard.afterCondessaFail) {
    finalizeCondessaBlockFailed();
    return { ok: true };
  }

  if (action.discard.afterBlockShow) {
    finishBlockShowAfterActorDiscard(action);
    return { ok: true };
  }

  if (action.discard.afterBlockFail) {
    finalizeBlockFailed();
    return { ok: true };
  }

  const actorWinsChallenge = action.discard.actorWinsChallenge;
  finishChallengeDiscardFlow(action, actorWinsChallenge);
  return { ok: true };
}

/** Jogador devolve 2 cartas após comprar (Embaixador). */
export function chooseReturnCards(sessionId, cardIds) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Nada para devolver." };
  }
  const action = state.pendingAction;
  if (action.status !== "awaiting_return" || !action.returnCards) {
    return { ok: false, error: "Nenhuma devolução pendente." };
  }

  const player = findBySession(sessionId);
  if (!player || player.id !== action.returnCards.playerId) {
    return { ok: false, error: "Só quem comprou as cartas pode devolver." };
  }

  const required = action.returnCards.required ?? 2;
  const ids = Array.isArray(cardIds) ? cardIds : [];
  if (ids.length !== required) {
    return {
      ok: false,
      error: `Selecione exatamente ${required} cartas para devolver.`,
    };
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== required) {
    return { ok: false, error: "Selecione cartas diferentes." };
  }

  const alive = player.cards.filter((c) => !c.discarded);
  const valid = uniqueIds.every((id) => alive.some((c) => c.id === id));
  if (!valid) {
    return { ok: false, error: "Escolha cartas válidas." };
  }

  returnCardsToDeck(player, uniqueIds);
  pushSystemChat(`${player.name} devolveu ${required} cartas.`);

  const saved = {
    playerId: action.playerId,
    playerName: action.playerName,
    label: action.label,
    reason: action.reason,
    type: action.type,
  };
  completeDeclaredActionAndAdvance(saved);
  return { ok: true };
}

export function resolveContest(sessionId, { outcome, reason } = {}) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há contestação para resolver." };
  }
  const action = state.pendingAction;
  if (action.status !== "contested") {
    return { ok: false, error: "Nenhuma contestação pendente." };
  }

  const actor = findBySession(sessionId);
  if (!actor || actor.id !== action.playerId) {
    return { ok: false, error: "Só quem fez a ação pode responder." };
  }

  if (outcome !== "won" && outcome !== "lost") {
    return { ok: false, error: "Escolha se você é ou não o personagem." };
  }

  action.resolution = { outcome, reason: trimReason(reason) || "" };

  if (outcome === "won") {
    beginAwaitingDiscard({
      loserId: action.contest.playerId,
      actorWinsChallenge: true,
      actorMustSwapAfterWin: true,
      chatLines: [
        `${action.playerName} provou ser o personagem — ${action.contest.playerName} perde uma carta.`,
      ],
    });
  } else {
    beginAwaitingDiscard({
      loserId: action.playerId,
      actorWinsChallenge: false,
      chatLines: [
        `${action.playerName} não tinha o personagem — perde uma carta.`,
      ],
    });
  }

  return { ok: true };
}

/** Contestador original resolve após "contestar de volta". */
export function resolveCounterContest(sessionId, { outcome, reason }) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há contra-contestação para resolver." };
  }
  const action = state.pendingAction;
  if (action.status !== "counter_pending" || !action.contest || !action.counter) {
    return { ok: false, error: "Nenhuma contra-contestação pendente." };
  }

  const contestant = findBySession(sessionId);
  if (!contestant || contestant.id !== action.contest.playerId) {
    return { ok: false, error: "Só quem contestou primeiro pode resolver." };
  }

  if (outcome !== "won" && outcome !== "lost") {
    return { ok: false, error: "Escolha ganhei ou perdi." };
  }
  const text = trimReason(reason);
  if (!text) return { ok: false, error: "Explique o resultado." };

  action.resolution = { outcome, reason: text, stage: "counter" };

  if (outcome === "won") {
    beginAwaitingDiscard({
      loserId: action.playerId,
      actorWinsChallenge: false,
      chatLines: [
        `${contestant.name} ganhou a contra-contestação de ${action.playerName}: ${text}`,
      ],
    });
  } else {
    beginAwaitingDiscard({
      loserId: action.contest.playerId,
      actorWinsChallenge: true,
      actorMustSwapAfterWin: true,
      chatLines: [
        `${contestant.name} perdeu a contra-contestação de ${action.playerName}: ${text}`,
      ],
    });
  }

  return { ok: true };
}

/** Alvo do assassinato aceita a morte — paga 3 moedas e descarta carta. */
export function acceptAssassination(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há assassinato para aceitar." };
  }
  const action = state.pendingAction;
  if (action.type !== "assassinate" || action.status !== "open") {
    return { ok: false, error: "Esta ação não pode ser aceita agora." };
  }

  const target = findBySession(sessionId);
  if (!target || target.id !== action.targetPlayerId) {
    return { ok: false, error: "Só o alvo pode aceitar a morte." };
  }

  clearChallengeTimer();
  pushSystemChat(`${target.name} aceitou o assassinato.`);

  const actor = findById(action.playerId);
  applyAssassinatePayment(actor);
  beginTargetInfluenceLoss(action, () => completeDeclaredActionAndAdvance(action));
  return { ok: true };
}

/** Alvo do assassinato defende com Condessa — assassino pode contestar depois. */
export function defendAssassination(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há assassinato para defender." };
  }
  const action = state.pendingAction;
  if (action.type !== "assassinate" || action.status !== "open") {
    return { ok: false, error: "Esta ação não pode ser defendida agora." };
  }

  const target = findBySession(sessionId);
  if (!target || target.id !== action.targetPlayerId) {
    return { ok: false, error: "Só o alvo pode defender." };
  }

  clearChallengeTimer();
  action.status = "Condessa_defense";
  action.defense = {
    playerId: target.id,
    playerName: target.name,
    blockKind: "Condessa",
  };
  pushSystemChat(
    `${target.name} defendeu o assassinato de ${action.playerName} (Condessa).`
  );
  return { ok: true };
}

/** Assassino aceita a defesa com Condessa sem contestar. */
export function acceptCondessaBlock(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há defesa para aceitar." };
  }
  const action = state.pendingAction;
  if (action.status !== "Condessa_defense") {
    return { ok: false, error: "Nenhuma defesa ou bloqueio pendente." };
  }

  const actor = findBySession(sessionId);
  if (!actor || actor.id !== action.playerId) {
    return {
      ok: false,
      error: "Só quem fez a ação pode aceitar ou contestar o bloqueio.",
    };
  }

  const blockKind = getBlockKind(action);
  const label =
    blockKind === "Condessa"
      ? "Condessa"
      : blockKind === "duke"
        ? "Duque"
        : "Capitão/Embaixador";
  acceptDefenseInternal(
    `${actor.name} aceitou o bloqueio (${label}) de ${action.defense?.playerName}.`
  );
  return { ok: true };
}

/** Quem fez a ação contesta a defesa/bloqueio declarado. */
export function challengeCondessaDefense(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há defesa para contestar." };
  }
  const action = state.pendingAction;
  if (action.status !== "Condessa_defense") {
    return { ok: false, error: "Nenhuma defesa ou bloqueio pendente." };
  }

  const actor = findBySession(sessionId);
  if (!actor || actor.id !== action.playerId) {
    return { ok: false, error: "Só quem fez a ação pode contestar o bloqueio." };
  }

  const blockKind = getBlockKind(action);
  const label =
    blockKind === "Condessa"
      ? "Condessa"
      : blockKind === "duke"
        ? "Duque"
        : "Capitão/Embaixador";

  clearChallengeTimer();
  action.status = "Condessa_challenged";
  action.endsAt = null;
  pushSystemChat(
    `${actor.name} contestou — duvida que ${action.defense?.playerName} tem ${label}.`
  );
  return { ok: true };
}

/** Defensor responde à contestação do bloqueio: mostrar carta ou perder. */
export function resolveCondessaDefense(sessionId, { outcome }) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há contestação para resolver." };
  }
  const action = state.pendingAction;
  if (action.status !== "Condessa_challenged") {
    return { ok: false, error: "Nenhuma contestação de bloqueio pendente." };
  }

  const defender = findBySession(sessionId);
  if (!defender || defender.id !== action.defense?.playerId) {
    return { ok: false, error: "Só quem bloqueou/defendeu pode responder." };
  }

  if (outcome !== "show" && outcome !== "lose") {
    return { ok: false, error: "Escolha mostrar a carta ou perder uma influência." };
  }

  const blockKind = getBlockKind(action);
  const label =
    blockKind === "Condessa"
      ? "Condessa"
      : blockKind === "duke"
        ? "Duque"
        : "Capitão/Embaixador";

  clearChallengeTimer();

  if (outcome === "show") {
    pushSystemChat(
      `${defender.name} mostrou ${label} — ${action.playerName} perde uma carta.`
    );
    beginAwaitingDiscard({
      loserId: action.playerId,
      afterCondessaShow: blockKind === "Condessa",
      afterBlockShow: blockKind !== "Condessa",
      chatLines: [],
    });
  } else {
    pushSystemChat(
      `${defender.name} não tinha ${label} — perde uma carta e a ação continua.`
    );
    beginAwaitingDiscard({
      loserId: defender.id,
      afterCondessaFail: blockKind === "Condessa",
      afterBlockFail: blockKind !== "Condessa",
      chatLines: [],
    });
  }

  return { ok: true };
}

function cancelBlockedAction(message) {
  pushSystemChat(message);
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

/** Bloqueia Ajuda Externa com Duque — abre votação entre os jogadores. */
export function blockForeignAid(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para bloquear." };
  }
  const action = state.pendingAction;
  if (action.type !== "foreign_aid") {
    return { ok: false, error: "Esta ação não pode ser bloqueada agora." };
  }
  if (action.status === "contest_vote") {
    return { ok: false, error: "Use SIM ou NÃO na votação em andamento." };
  }
  if (action.status !== "open") {
    return { ok: false, error: "Esta ação não pode ser bloqueada agora." };
  }

  const blocker = findBySession(sessionId);
  if (!blocker || !canBlockForeignAidPlayer(blocker, action)) {
    return { ok: false, error: "Você não pode bloquear esta ação." };
  }

  clearChallengeTimer();
  action.status = "Condessa_defense";
  action.defense = {
    playerId: blocker.id,
    playerName: blocker.name,
    blockKind: "duke",
  };
  pushSystemChat(
    `${blocker.name} bloqueou Ajuda Externa de ${action.playerName} (Duque).`
  );
  return { ok: true };
}

/** Alvo bloqueia extorsão com Capitão ou Embaixador. */
export function blockSteal(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para bloquear." };
  }
  const action = state.pendingAction;
  if (action.type !== "steal" || action.status !== "open") {
    return { ok: false, error: "Esta ação não pode ser bloqueada agora." };
  }

  const blocker = findBySession(sessionId);
  if (!blocker || blocker.id !== action.targetPlayerId) {
    return { ok: false, error: "Só o alvo pode bloquear a extorsão." };
  }

  clearChallengeTimer();
  action.status = "Condessa_defense";
  action.defense = {
    playerId: blocker.id,
    playerName: blocker.name,
    blockKind: "captain_ambassador",
  };
  pushSystemChat(
    `${blocker.name} bloqueou a extorsão de ${action.playerName} (Capitão/Embaixador).`
  );
  return { ok: true };
}

/** Admin encerra a partida atual. */
export function endGame(requesterSessionId) {
  const requester = findBySession(requesterSessionId);
  if (!requester || requester.id !== state.adminId) {
    return { ok: false, error: "Só o admin pode encerrar a partida." };
  }
  if (state.phase !== "playing") {
    return { ok: false, error: "Não há partida em andamento." };
  }

  clearChallengeTimer();
  state.pendingAction = null;
  state.joinRequests = [];
  state.winnerId = null;
  state.endedByAdmin = true;
  state.phase = "finished";
  pushSystemChat(`${requester.name} (admin) encerrou a partida.`);
  return { ok: true };
}

export function nextTurn(sessionId) {
  if (state.phase !== "playing") return { ok: false, error: "Fora de jogo." };
  const requester = findBySession(sessionId);
  const current = state.players[state.currentTurnIndex];
  if (!requester || !current || requester.id !== current.id) {
    return { ok: false, error: "Só o jogador da vez pode passar." };
  }
  return {
    ok: false,
    error: "Você deve realizar uma ação — não é possível passar a vez.",
  };
}

export function sendChat(sessionId, text) {
  const player = findBySession(sessionId);
  if (!player) return { ok: false, error: "Entre na sala para conversar." };
  if (state.phase === "lobby") {
    // chat liberado no lobby também
  } else if (state.phase !== "playing" && state.phase !== "finished") {
    return { ok: false, error: "Chat indisponível." };
  }

  const msg = String(text ?? "")
    .trim()
    .slice(0, 280);
  if (!msg) return { ok: false, error: "Mensagem vazia." };

  state.chat.push({
    id: nextChatId++,
    playerId: player.id,
    playerName: player.name,
    text: msg,
    at: Date.now(),
    system: false,
  });
  if (state.chat.length > MAX_CHAT) {
    state.chat = state.chat.slice(-MAX_CHAT);
  }
  return { ok: true };
}

export function returnToLobby(requesterSessionId) {
  const requester = findBySession(requesterSessionId);
  if (!requester || requester.id !== state.adminId) {
    return { ok: false, error: "Só o admin pode reiniciar." };
  }

  clearChallengeTimer();
  nextCardId = 100;
  state.players = state.players.map((p) => ({
    ...p,
    coins: 2,
    cards: [createCard(1), createCard(2)],
    eliminated: false,
  }));
  state.phase = "lobby";
  state.currentTurnIndex = 0;
  state.pot = 0;
  state.winnerId = null;
  state.pendingAction = null;
  state.joinRequests = [];
  state.chat = [];
  state.endedByAdmin = false;
  ensureAdmin();
  return { ok: true };
}
