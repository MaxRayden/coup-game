/** Portas — fonte única para client, server e Vite. */

export const CLIENT_PORT = 7000;
export const SERVER_DEV_PORT = 7001;
export const SERVER_PROD_PORT = 7000;

export function resolveServerPort(): number {
  if (process.env.PORT) return Number(process.env.PORT);
  if (process.env.COUP_DEV === "1") return SERVER_DEV_PORT;
  return SERVER_PROD_PORT;
}

export function devClientUrl(host = "localhost"): string {
  return `http://${host}:${CLIENT_PORT}`;
}

export function serverUrl(port: number, host = "localhost"): string {
  return `http://${host}:${port}`;
}

/** URL do Socket.io em dev (evita proxy WS do Vite, que falha quando o backend reinicia). */
export function devSocketUrl(hostname: string): string {
  return `http://${hostname}:${SERVER_DEV_PORT}`;
}
