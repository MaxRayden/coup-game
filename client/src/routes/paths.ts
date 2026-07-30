/** Rotas da aplicação (SPA). */
export const ROUTES = {
  /** Splash inicial (sempre ao abrir a URL principal). */
  home: "/",
  /** Boas-vindas — entrar ou criar lobby. */
  welcome: "/inicio",
  /** Sala de espera antes da partida. */
  lobby: "/lobby",
  /** Mesa / partida em andamento ou encerrada. */
  game: "/partida",
  /** Pedido de entrada durante partida. */
  gameJoin: "/partida/entrar",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
