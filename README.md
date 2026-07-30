# Coup — Controle de Partida

App web para acompanhar uma partida presencial de **Coup**: moedas, cartas e turno. Não implementa regras do jogo (blefe, personagens, etc.) — só o placar visual.

O estado fica no servidor e sincroniza em tempo real via WebSocket. Qualquer computador/tablet na mesma rede pode abrir o app pelo IP.

## Como usar

### Desenvolvimento

```bash
npm install
npm run dev
```

- Interface (Vite): http://localhost:5173  
- Servidor Socket: http://localhost:3000  

### Produção (recomendado na mesa)

```bash
npm install
npm run build
npm start
```

O servidor escuta em `0.0.0.0:3000` e imprime os IPs da rede, por exemplo:

```
Local:   http://localhost:3000
Rede:    http://192.168.0.15:3000
```

Nos outros dispositivos da Wi‑Fi/LAN, abra `http://<IP>:3000`.

> Se não conectar, libere a porta 3000 no firewall do Windows ou use outro `PORT`:
> `set PORT=8080 && npm start`

## Fluxo

1. Cada jogador abre o IP da rede e **entra no lobby com o próprio nome**  
2. O primeiro a entrar vira **admin** da sala  
3. Com no mínimo 2 jogadores (máx. 10), o admin clica em **Iniciar partida**  
4. Na sua vez, toque no seu assento, escolha a ação, escreva o motivo e confirme  
5. A ação aparece no centro com **10 segundos** para os outros **contestarem**  
6. Se alguém contestar, o autor escolhe **ganhei**, **perdi** ou **contestar de volta**  
7. Quem perde a contestação **escolhe uma carta** para descartar; se o autor ganha, a ação vale  
8. Sem contestação, o efeito é aplicado e a vez passa  
9. Novos jogadores podem **pedir para entrar** durante a partida; o **admin aprova ou recusa**  
10. Chat lateral; o admin pode **encerrar a partida**  
11. Com 1 sobrevivente (ou encerramento), o admin volta todos ao lobby  

## Stack

- Express + Socket.io (estado compartilhado)  
- React + Vite (interface)
