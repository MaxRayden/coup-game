export default function NetworkBar({
  connected,
  serverInfo,
  me,
  playerCount,
  phase,
}) {
  const addresses = serverInfo?.addresses ?? [];
  const port = serverInfo?.port ?? 3000;
  const primary = addresses[0];

  return (
    <header className="network-bar">
      <div className="network-brand">
        <span className="network-mark" aria-hidden />
        <span className="network-title">Coup</span>
        <span className="network-sub">controle de partida</span>
      </div>
      <div className="network-status">
        <span
          className={`dot ${connected ? "on" : "off"}`}
          title={connected ? "Conectado" : "Desconectado"}
        />
        {me ? (
          <span className="network-url">
            {me.name}
            {me.isAdmin ? " · admin" : ""}
            {phase === "lobby" ? ` · lobby (${playerCount})` : ""}
          </span>
        ) : primary ? (
          <span className="network-url">
            Rede: http://{primary.address}:{port}
          </span>
        ) : (
          <span className="network-url">Aguardando IP da rede…</span>
        )}
      </div>
    </header>
  );
}
