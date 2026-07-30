import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { Server, type Server as SocketIOServer } from "socket.io";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  getState,
  setStateChangeListener,
  attachSocketSession,
  joinLobby,
  createNewLobby,
  leaveLobby,
  disconnectSocket,
  startGame,
  approveJoinRequest,
  rejectJoinRequest,
  cancelJoinRequest,
  declareAction,
  beginContestDraft,
  cancelContestDraft,
  contestAction,
  voteOnContest,
  resolveContest,
  resolveCounterContest,
  chooseChallengeDiscard,
  chooseReturnCards,
  acceptAssassination,
  defendAssassination,
  acceptCondessaBlock,
  challengeCondessaDefense,
  resolveCondessaDefense,
  blockForeignAid,
  blockSteal,
  nextTurn,
  sendChat,
  returnToLobby,
  endGame,
} from "./game.js";
import { CLIENT_PORT, resolveServerPort } from "../config/ports.js";
import { isDevServer } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = resolveServerPort();
const devMode = isDevServer();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const distPath = path.join(__dirname, "..", "client", "dist");
const hasClientBuild = fs.existsSync(path.join(distPath, "index.html"));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, phase: getState().phase });
});

app.get("/api/network", (_req: Request, res: Response) => {
  res.json({
    addresses: getLanAddresses(),
    port: PORT,
    clientPort: devMode ? CLIENT_PORT : PORT,
    devMode: devMode,
  });
});

if (!hasClientBuild) {
  app.get("/", (_req: Request, res: Response) => {
    const devUrl = `http://localhost:${CLIENT_PORT}`;
    res.type("html").send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Coup — Servidor</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    a { color: #8b4513; font-weight: 600; }
    code { background: #f4efe6; padding: 0.15rem 0.4rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Coup — Servidor ativo</h1>
  <p>Esta porta (<code>${PORT}</code>) é só da API e do Socket.io.</p>
  ${
    devMode
      ? `<p><strong>Abra o jogo em:</strong> <a href="${devUrl}">${devUrl}</a></p>
  <p>Em desenvolvimento use sempre a porta <code>${CLIENT_PORT}</code>, não a ${PORT}.</p>`
      : `<p>Faça o build do client: <code>npm run build && npm start</code></p>
  <p>Depois acesse <code>http://localhost:${PORT}</code> (interface + API juntas).</p>`
  }
  <p><a href="/api/health">/api/health</a></p>
</body>
</html>`);
  });
}

if (hasClientBuild) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

function broadcast() {
  io.emit("game:state", getState());
}

setStateChangeListener(() => {
  broadcast();
});

function disconnectDuplicateSession(
  io: SocketIOServer,
  sessionId: unknown,
  currentSocketId: string
) {
  const sid = String(sessionId ?? "").trim();
  if (!sid || !io) return;
  for (const [id, s] of io.sockets.sockets) {
    if (id === currentSocketId) continue;
    const otherSession = s.data?.sessionId || s.handshake.auth?.sessionId;
    if (otherSession === sid) {
      s.disconnect(true);
    }
  }
}

io.on("connection", (socket) => {
  const handshakeSessionId = socket.handshake.auth?.sessionId;
  if (handshakeSessionId) {
    disconnectDuplicateSession(io, handshakeSessionId, socket.id);
    const restored = attachSocketSession(socket.id, handshakeSessionId);
    if (restored.ok) {
      socket.data.sessionId = handshakeSessionId;
      socket.data.playerId = restored.playerId;
      if (restored.oldSocketId) {
        const old = io.sockets.sockets.get(restored.oldSocketId);
        if (old && old.id !== socket.id) old.disconnect(true);
      }
    }
  }

  socket.emit("game:state", getState());
  socket.emit("server:info", {
    addresses: getLanAddresses(),
    port: PORT,
    clientPort: devMode ? CLIENT_PORT : PORT,
    devMode: devMode,
  });

  socket.on("lobby:join", ({ name, sessionId }, ack) => {
    disconnectDuplicateSession(io, sessionId, socket.id);
    const result = joinLobby({
      name,
      sessionId,
      socketId: socket.id,
    });
    if (result.ok) {
      socket.data.sessionId = sessionId;
      if ("playerId" in result && result.playerId != null) {
        socket.data.playerId = result.playerId;
      }
      if ("requestId" in result && result.requestId != null) {
        socket.data.joinRequestId = result.requestId;
      }
      broadcast();
    }
    if (typeof ack === "function") ack(result);
  });

  socket.on("lobby:create", ({ name, sessionId }, ack) => {
    disconnectDuplicateSession(io, sessionId, socket.id);
    const result = createNewLobby({
      name,
      sessionId,
      socketId: socket.id,
    });
    if (result.ok) {
      socket.data.sessionId = sessionId;
      if (result.playerId != null) {
        socket.data.playerId = result.playerId;
      }
      socket.data.joinRequestId = null;
      broadcast();
    }
    if (typeof ack === "function") ack(result);
  });

  socket.on("lobby:leave", (payload, maybeAck) => {
    const ack = typeof payload === "function" ? payload : maybeAck;
    const sessionId =
      (typeof payload === "object" && payload?.sessionId) || socket.data.sessionId;

    if (sessionId) {
      leaveLobby(sessionId);
      cancelJoinRequest(sessionId);
      socket.data.sessionId = null;
      socket.data.playerId = null;
      socket.data.joinRequestId = null;
      broadcast();
    }
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("lobby:start", (ack) => {
    const result = startGame(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("join:cancel", (ack) => {
    const result = cancelJoinRequest(socket.data.sessionId);
    socket.data.joinRequestId = null;
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("join:approve", ({ requestId }, ack) => {
    const result = approveJoinRequest(socket.data.sessionId, requestId);
    if (result.ok) {
      broadcast();
      if (result.socketId) {
        const target = io.sockets.sockets.get(result.socketId);
        if (target) {
          target.data.playerId = result.playerId;
          target.data.joinRequestId = null;
          target.emit("join:approved", { playerId: result.playerId });
        }
      }
    }
    if (typeof ack === "function") ack(result);
  });

  socket.on("join:reject", ({ requestId }, ack) => {
    const result = rejectJoinRequest(socket.data.sessionId, requestId);
    if (result.ok) {
      broadcast();
      if (result.socketId) {
        const target = io.sockets.sockets.get(result.socketId);
        if (target) {
          target.data.joinRequestId = null;
          target.emit("join:rejected", {
            error: "Seu pedido de entrada foi recusado pelo admin.",
          });
        }
      }
    }
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:declare", (payload, ack) => {
    const result = declareAction(socket.data.sessionId, payload);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:beginContest", (ack) => {
    const result = beginContestDraft(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:cancelContest", (ack) => {
    const result = cancelContestDraft(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:contest", (payload, ack) => {
    const result = contestAction(socket.data.sessionId, payload ?? {});
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:voteContest", (payload, ack) => {
    const result = voteOnContest(socket.data.sessionId, payload ?? {});
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:resolve", (payload, ack) => {
    const result = resolveContest(socket.data.sessionId, payload ?? {});
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:resolveCounter", (payload, ack) => {
    const result = resolveCounterContest(socket.data.sessionId, payload ?? {});
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:chooseDiscard", (payload, ack) => {
    const result = chooseChallengeDiscard(socket.data.sessionId, payload?.cardId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:chooseReturn", (payload, ack) => {
    const result = chooseReturnCards(socket.data.sessionId, payload?.cardIds);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:acceptAssassination", (ack) => {
    const result = acceptAssassination(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:defendAssassination", (ack) => {
    const result = defendAssassination(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:acceptCondessaBlock", (ack) => {
    const result = acceptCondessaBlock(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:challengeCondessaDefense", (ack) => {
    const result = challengeCondessaDefense(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:resolveCondessaDefense", (payload, ack) => {
    const result = resolveCondessaDefense(socket.data.sessionId, payload ?? {});
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:blockForeignAid", (ack) => {
    const result = blockForeignAid(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("action:blockSteal", (ack) => {
    const result = blockSteal(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("turn:next", (ack) => {
    const result = nextTurn(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("chat:send", (payload, ack) => {
    const result = sendChat(socket.data.sessionId, payload?.text);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("game:end", (ack) => {
    const result = endGame(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("game:returnLobby", (ack) => {
    const result = returnToLobby(socket.data.sessionId);
    if (result.ok) broadcast();
    if (typeof ack === "function") ack(result);
  });

  socket.on("disconnect", () => {
    disconnectSocket(socket.id);
    broadcast();
  });
});

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        results.push({ name, address: net.address });
      }
    }
  }
  return results;
}

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error("");
    console.error(`  Erro: porta ${PORT} já está em uso.`);
    console.error("  Rode: npm run stop");
    console.error("  Ou encerre o processo que usa essa porta e tente de novo.");
    console.error("");
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, "0.0.0.0", () => {
  const addrs = getLanAddresses();
  console.log("");
  console.log("  Coup — Controle de Partida");
  console.log("  ──────────────────────────");
  if (devMode) {
    console.log(`  API/Socket (dev):  http://localhost:${PORT}`);
    console.log(`  JOGO (abra aqui):  http://localhost:${CLIENT_PORT}`);
    if (addrs.length) {
      for (const a of addrs) {
        console.log(`  Rede (jogo):       http://${a.address}:${CLIENT_PORT}`);
      }
    }
  } else {
    console.log(`  Local:   http://localhost:${PORT}`);
    if (addrs.length) {
      for (const a of addrs) {
        console.log(`  Rede:    http://${a.address}:${PORT}  (${a.name})`);
      }
    } else {
      console.log("  Rede:    nenhum IP LAN detectado");
    }
  }
  console.log("");
  if (!hasClientBuild && devMode) {
    console.log(`  Desenvolvimento: npm run dev → http://localhost:${CLIENT_PORT}`);
    console.log(`  Não use localhost:${PORT} no navegador (só API).`);
    console.log("");
  } else if (!hasClientBuild) {
    console.log("  Produção: npm run build && npm start");
    console.log("");
  }
});
