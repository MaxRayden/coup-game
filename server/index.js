import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import {
  getState,
  setStateChangeListener,
  joinLobby,
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
  resolveContest,
  resolveCounterContest,
  chooseChallengeDiscard,
  nextTurn,
  sendChat,
  returnToLobby,
  endGame,
} from "./game.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ["GET", "POST"] },
});

const distPath = path.join(__dirname, "..", "client", "dist");
const hasClientBuild = fs.existsSync(path.join(distPath, "index.html"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, phase: getState().phase });
});

app.get("/api/network", (_req, res) => {
  res.json({ addresses: getLanAddresses(), port: PORT });
});

if (hasClientBuild) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

function broadcast() {
  io.emit("game:state", getState());
}

setStateChangeListener(() => {
  broadcast();
});

io.on("connection", (socket) => {
  socket.emit("game:state", getState());
  socket.emit("server:info", {
    addresses: getLanAddresses(),
    port: PORT,
  });

  socket.on("lobby:join", ({ name, sessionId }, ack) => {
    const result = joinLobby({
      name,
      sessionId,
      socketId: socket.id,
    });
    if (result.ok) {
      socket.data.sessionId = sessionId;
      if (result.playerId != null) {
        socket.data.playerId = result.playerId;
      }
      if (result.requestId != null) {
        socket.data.joinRequestId = result.requestId;
      }
      broadcast();
    }
    if (typeof ack === "function") ack(result);
  });

  socket.on("lobby:leave", (payload, maybeAck) => {
    const ack = typeof payload === "function" ? payload : maybeAck;
    const sessionId =
      (typeof payload === "object" && payload?.sessionId) ||
      socket.data.sessionId;

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
    const result = chooseChallengeDiscard(
      socket.data.sessionId,
      payload?.cardId
    );
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

httpServer.listen(PORT, "0.0.0.0", () => {
  const addrs = getLanAddresses();
  console.log("");
  console.log("  Coup — Controle de Partida");
  console.log("  ──────────────────────────");
  console.log(`  Local:   http://localhost:${PORT}`);
  if (addrs.length) {
    for (const a of addrs) {
      console.log(`  Rede:    http://${a.address}:${PORT}  (${a.name})`);
    }
  } else {
    console.log("  Rede:    nenhum IP LAN detectado");
  }
  console.log("");
  if (!hasClientBuild) {
    console.log("  Sem build do client. Em dev: npm run dev (Vite na porta 5173).");
    console.log("  Em produção: npm run build && npm start");
    console.log("");
  }
});
