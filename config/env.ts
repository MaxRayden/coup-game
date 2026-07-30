/** Variáveis de ambiente lidas pelo servidor (Node). */

export function isDevServer(): boolean {
  return process.env.COUP_DEV === "1";
}

export function nodeEnv(): string {
  return process.env.NODE_ENV ?? "development";
}

export function isProduction(): boolean {
  return nodeEnv() === "production";
}
