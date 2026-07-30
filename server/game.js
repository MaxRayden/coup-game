/** Estado compartilhado — lobby, ações com contestação e chat. */

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const CHALLENGE_SECONDS = 10;
const MAX_CHAT = 80;
const MAX_REASON = 200;

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
    challengeSeconds: CHALLENGE_SECONDS,
    endedByAdmin: false,
  };
}

let state = createInitialState();
let nextPlayerId = 1;
let nextChatId = 1;
let nextActionId = 1;
let nextJoinRequestId = 1;
let challengeTimer = null;
/** Callback opcional para o servidor rebroadcastar (ex.: tick do timer). */
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
    now: Date.now(),
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
  if (challengeTimer) {
    clearTimeout(challengeTimer);
    challengeTimer = null;
  }
}

function trimReason(text) {
  return String(text ?? "").trim().slice(0, MAX_REASON);
}

function actionLabel(action) {
  if (!action) return "";
  if (action.type === "receive") return `Receber ${action.amount} moeda(s)`;
  if (action.type === "pay") return `Pagar ${action.amount} moeda(s)`;
  if (action.type === "discard") return "Descartar uma carta";
  if (action.type === "other") {
    if (action.targetPlayerName) {
      return `Outra ação → ${action.targetPlayerName}`;
    }
    return "Outra ação";
  }
  return action.type;
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

  if (state.players.length >= MAX_PLAYERS) {
    return { ok: false, error: `Sala cheia (máx. ${MAX_PLAYERS}).` };
  }

  const request = state.joinRequests[idx];
  state.joinRequests.splice(idx, 1);

  const nameTaken = state.players.some(
    (p) => p.name.toLowerCase() === request.name.toLowerCase()
  );
  if (nameTaken) {
    return { ok: false, error: "Esse nome já está na mesa." };
  }

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

function applyActionEffects(action) {
  const player = findById(action.playerId);
  if (!player || player.eliminated) return;

  if (action.type === "receive") {
    const qty = Math.max(0, Math.floor(Number(action.amount) || 0));
    player.coins += qty;
    state.pot = Math.max(0, state.pot - qty);
  } else if (action.type === "pay") {
    const qty = Math.max(0, Math.floor(Number(action.amount) || 0));
    const paid = Math.min(player.coins, qty);
    player.coins -= paid;
    state.pot += paid;
  } else if (action.type === "discard") {
    const alive = player.cards.filter((c) => !c.discarded);
    if (alive.length === 0) return;
    let card = action.cardId ? alive.find((c) => c.id === action.cardId) : null;
    if (!card) card = alive[0];
    card.discarded = true;
    markEliminatedIfNeeded(player);
  }
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

function finalizePendingSuccess() {
  const action = state.pendingAction;
  if (!action) return;
  applyActionEffects(action);
  pushSystemChat(
    `${action.playerName}: ${actionLabel(action)} — ${action.reason}`
  );
  state.pendingAction = null;
  clearChallengeTimer();
  if (state.phase === "playing") {
    advanceTurnInternal();
  }
}

function scheduleChallengeExpiry(endsAt) {
  clearChallengeTimer();
  const delay = Math.max(0, endsAt - Date.now());
  challengeTimer = setTimeout(() => {
    challengeTimer = null;
    const action = state.pendingAction;
    if (!action || action.status !== "open") return;
    if (Date.now() < action.endsAt - 50) {
      scheduleChallengeExpiry(action.endsAt);
      return;
    }
    finalizePendingSuccess();
    notify();
  }, delay);
}

/**
 * Declara ação na vez do jogador (ainda sem efeito até o timer/contestação).
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
  if (!reason) return { ok: false, error: "Explique o motivo da ação." };
  if (!["receive", "pay", "discard", "other"].includes(type)) {
    return { ok: false, error: "Escolha uma ação válida." };
  }

  let amount = Math.max(1, Math.floor(Number(payload?.amount) || 1));
  let cardId = payload?.cardId ?? null;
  let targetPlayerId = null;
  let targetPlayerName = null;

  if (type === "pay" && amount > actor.coins) {
    amount = actor.coins;
  }
  if (type === "pay" && amount <= 0) {
    return { ok: false, error: "Você não tem moedas para pagar." };
  }
  if (type === "discard") {
    const alive = actor.cards.filter((c) => !c.discarded);
    if (alive.length === 0) {
      return { ok: false, error: "Você não tem cartas para descartar." };
    }
    if (cardId && !alive.some((c) => c.id === cardId)) {
      return { ok: false, error: "Carta inválida." };
    }
    if (!cardId) cardId = alive[0].id;
  }

  if (type === "other" && payload?.againstPlayer) {
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

  const endsAt = Date.now() + CHALLENGE_SECONDS * 1000;
  const label = actionLabel({
    type,
    amount,
    targetPlayerName,
  });

  state.pendingAction = {
    id: `act-${nextActionId++}`,
    playerId: actor.id,
    playerName: actor.name,
    type,
    amount: type === "discard" || type === "other" ? null : amount,
    cardId: type === "discard" ? cardId : null,
    targetPlayerId,
    targetPlayerName,
    reason,
    label,
    status: "open",
    endsAt,
    remainingMs: null,
    draftBy: null,
    contest: null,
    resolution: null,
  };

  scheduleChallengeExpiry(endsAt);
  return { ok: true };
}

/** Pausa o timer enquanto alguém escreve a contestação. */
export function beginContestDraft(sessionId) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para contestar." };
  }
  const action = state.pendingAction;
  if (action.status === "contest_draft" && action.draftBy?.sessionId === sessionId) {
    return { ok: true, already: true };
  }
  if (action.status !== "open") {
    return { ok: false, error: "Esta ação não pode mais ser contestada." };
  }
  if (Date.now() > action.endsAt) {
    return { ok: false, error: "O tempo para contestar acabou." };
  }

  const challenger = findBySession(sessionId);
  if (!challenger || challenger.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }
  if (challenger.id === action.playerId) {
    return { ok: false, error: "Você não pode contestar a própria ação." };
  }

  clearChallengeTimer();
  const remainingMs = Math.max(0, action.endsAt - Date.now());
  action.status = "contest_draft";
  action.remainingMs = remainingMs;
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

  const remainingMs = Math.max(0, Number(action.remainingMs) || 0);
  action.status = "open";
  action.draftBy = null;
  action.remainingMs = null;
  action.endsAt = Date.now() + remainingMs;
  scheduleChallengeExpiry(action.endsAt);
  return { ok: true };
}

export function contestAction(sessionId, { reason }) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há ação para contestar." };
  }
  const action = state.pendingAction;

  // Aceita vindo do rascunho (timer pausado) ou, se ainda open, pausa e confirma
  if (action.status === "open") {
    const paused = beginContestDraft(sessionId);
    if (!paused.ok) return paused;
  }

  if (action.status !== "contest_draft") {
    return { ok: false, error: "Esta ação não pode mais ser contestada." };
  }
  if (action.draftBy?.sessionId !== sessionId) {
    return { ok: false, error: "Outra pessoa já está contestando." };
  }

  const challenger = findBySession(sessionId);
  if (!challenger || challenger.eliminated) {
    return { ok: false, error: "Jogador inválido." };
  }

  const text = trimReason(reason);
  if (!text) return { ok: false, error: "Explique a contestação." };

  clearChallengeTimer();
  action.status = "contested";
  action.endsAt = null;
  action.remainingMs = null;
  action.draftBy = null;
  action.contest = {
    playerId: challenger.id,
    playerName: challenger.name,
    reason: text,
  };
  return { ok: true };
}

/**
 * Prepara o fim da contestação: quem perdeu escolhe a carta a descartar.
 */
function beginAwaitingDiscard({ loserId, actorWinsChallenge, chatLines }) {
  const action = state.pendingAction;
  if (!action) return;

  for (const line of chatLines ?? []) pushSystemChat(line);

  const loser = findById(loserId);
  if (!loser || loser.eliminated) {
    // Sem perdedor válido — só aplica/avança
    completeChallengeAfterDiscard({ actorWinsChallenge });
    return;
  }

  const alive = loser.cards.filter((c) => !c.discarded);
  if (alive.length === 0) {
    completeChallengeAfterDiscard({ actorWinsChallenge });
    return;
  }

  // Uma carta só: descarta automaticamente
  if (alive.length === 1) {
    alive[0].discarded = true;
    markEliminatedIfNeeded(loser);
    pushSystemChat(`${loser.name} perdeu sua última carta.`);
    completeChallengeAfterDiscard({ actorWinsChallenge });
    return;
  }

  clearChallengeTimer();
  action.status = "awaiting_discard";
  action.discard = {
    playerId: loser.id,
    playerName: loser.name,
    actorWinsChallenge: Boolean(actorWinsChallenge),
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
  };

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
    return { ok: false, error: "Só quem perdeu escolhe a carta." };
  }

  const alive = player.cards.filter((c) => !c.discarded);
  const card = alive.find((c) => c.id === cardId) || (alive.length === 1 ? alive[0] : null);
  if (!card) return { ok: false, error: "Escolha uma carta válida." };

  card.discarded = true;
  markEliminatedIfNeeded(player);
  pushSystemChat(`${player.name} descartou uma carta.`);

  const actorWinsChallenge = action.discard.actorWinsChallenge;
  completeChallengeAfterDiscard({ actorWinsChallenge });
  return { ok: true };
}

export function resolveContest(sessionId, { outcome, reason }) {
  if (state.phase !== "playing" || !state.pendingAction) {
    return { ok: false, error: "Não há contestação para resolver." };
  }
  const action = state.pendingAction;
  if (action.status !== "contested") {
    return { ok: false, error: "Nenhuma contestação pendente." };
  }

  const actor = findBySession(sessionId);
  if (!actor || actor.id !== action.playerId) {
    return { ok: false, error: "Só quem fez a ação pode resolver." };
  }

  const text = trimReason(reason);
  if (!text) return { ok: false, error: "Explique o resultado." };

  if (outcome === "counter") {
    action.status = "counter_pending";
    action.counter = {
      playerId: actor.id,
      playerName: actor.name,
      reason: text,
    };
    pushSystemChat(
      `${actor.name} contestou de volta ${action.contest.playerName}: ${text}`
    );
    return { ok: true };
  }

  if (outcome !== "won" && outcome !== "lost") {
    return { ok: false, error: "Escolha ganhei, perdi ou contestar de volta." };
  }

  action.resolution = { outcome, reason: text };

  if (outcome === "won") {
    beginAwaitingDiscard({
      loserId: action.contest.playerId,
      actorWinsChallenge: true,
      chatLines: [
        `${action.playerName} ganhou a contestação de ${action.contest.playerName}: ${text}`,
      ],
    });
  } else {
    beginAwaitingDiscard({
      loserId: action.playerId,
      actorWinsChallenge: false,
      chatLines: [
        `${action.playerName} perdeu a contestação de ${action.contest.playerName}: ${text}`,
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
      chatLines: [
        `${contestant.name} perdeu a contra-contestação de ${action.playerName}: ${text}`,
      ],
    });
  }

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
  if (state.pendingAction) {
    return { ok: false, error: "Resolva a ação em andamento primeiro." };
  }
  const requester = findBySession(sessionId);
  const current = state.players[state.currentTurnIndex];
  if (!requester || !current || requester.id !== current.id) {
    return { ok: false, error: "Só o jogador da vez pode passar." };
  }
  advanceTurnInternal();
  return { ok: true };
}

export function sendChat(sessionId, text) {
  const player = findBySession(sessionId);
  if (!player) return { ok: false, error: "Entre na sala para conversar." };
  if (state.phase === "lobby") {
    // chat liberado no lobby também
  } else if (state.phase !== "playing" && state.phase !== "finished") {
    return { ok: false, error: "Chat indisponível." };
  }

  const msg = String(text ?? "").trim().slice(0, 280);
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
