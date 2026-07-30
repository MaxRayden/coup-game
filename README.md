# Coup — Controle de Partida

App web para acompanhar uma partida presencial de **Coup**: moedas, cartas e turno.

O estado fica no servidor e sincroniza em tempo real via WebSocket.

## Portas (importante)

Este projeto **não usa a porta 3000** (evita conflito com outros apps).

| Modo | URL para abrir no navegador | API / Socket |
|------|----------------------------|--------------|
| **Desenvolvimento** (`npm run dev`) | **http://localhost:7000** | porta 7001 (só backend) |
| **Produção** (`npm run build && npm start`) | **http://localhost:7000** | mesma porta 7000 |

> Em dev, **não abra** `localhost:7001` para jogar — essa porta é só da API.  
> Se abrir por engano, o servidor mostra um link para a porta correta.

## Desenvolvimento

```bash
npm install
cp .env.example .env.development   # primeira vez
npm run dev
```

Abra **http://localhost:7000**

Outros dispositivos na rede: use o IP exibido no terminal com a porta **7000**.

## Produção (mesa / LAN)

```bash
npm install
npm run build
npm start
```

Abra **http://localhost:7000** (ou `http://<IP-da-rede>:7000` nos celulares/tablets).

No Windows, se a porta estiver ocupada: `npm run start:local` (libera 7000/7001 antes).

## Deploy para testes

O app roda como **monolito**: Express serve o build do Vite + Socket.io na mesma porta.  
O client conecta no mesmo origin (`io()` sem URL fixa) — ideal para deploy simples.

**Requisitos:** Node ≥ 20, uma instância (estado em memória — não escala horizontalmente).

### Docker (recomendado para teste)

```bash
docker build -t coup-game .
docker run --rm -p 7000:7000 coup-game
```

Abra **http://localhost:7000**

### Render (cloud gratuito)

1. Push do repo no GitHub
2. Render → **New Blueprint** → selecione o repo (`render.yaml` incluso)
3. Aguarde o build; abra a URL gerada

Health check: `GET /api/health`

### Railway / Fly.io / VPS

```bash
npm ci
npm run build
PORT=7000 NODE_ENV=production npm start
```

A plataforma costuma definir `PORT` automaticamente — o servidor respeita `process.env.PORT`.

## Variáveis de ambiente

| Variável | Onde | Descrição |
|----------|------|-----------|
| `COUP_DEV=1` | `.env.development` | Split dev: API 7001 + Vite 7000 |
| `PORT` | dev/prod | Porta do servidor (7001 em dev, 7000 ou `$PORT` em prod) |
| `NODE_ENV=production` | deploy | Modo produção |

Copie `.env.example` para `.env.development` (dev) ou `.env` (local prod).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor (7001) + Vite (7000) com hot reload |
| `npm run build` | Build de produção do client |
| `npm start` | Servidor de produção (cross-platform, sem matar portas) |
| `npm run start:local` | Igual `start`, mas libera portas antes (Windows) |
| `npm run preview` | Build + start local |
| `npm run typecheck` | Verificação TypeScript |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run stop` | Libera portas 7000/7001 (Windows) |

## Configuração (Vite / TS / env)

| Arquivo | Função |
|---------|--------|
| `client/vite.config.ts` | Aliases `@/`, `@shared/`, proxy `/api` e `/socket.io` → 7001 |
| `client/tsconfig.json` | React + paths do client |
| `server/tsconfig.json` | Node + paths do server |
| `shared/tsconfig.json` | Tipos compartilhados (`noEmit`) |
| `tsconfig.json` | Project references (`tsc -b`) |
| `config/ports.ts` | Portas fixas 7000 / 7001 |
| `config/env.ts` | Leitura de `COUP_DEV`, `NODE_ENV` |
| `.env.development` | Dev local (não commitar — use `.env.example`) |

## Estrutura do projeto

```
coup-game/
├── client/                 # React + Vite (TypeScript)
├── server/                 # Express + Socket.io
├── shared/                 # tipos e constantes
├── config/                 # portas e env
├── Dockerfile              # deploy container
└── render.yaml             # blueprint Render
```

### Aliases

- `@/` → `client/src/`
- `@shared/` → `shared/`

## Stack

- Express + Socket.io + tsx
- React + Vite + TypeScript
- ESLint + Prettier
