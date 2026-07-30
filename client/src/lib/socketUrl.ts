import { devSocketUrl } from "@shared/constants/ports";

/** Em dev conecta direto na 7001; em prod usa o mesmo origin. */
export function getSocketServerUrl(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  return devSocketUrl(window.location.hostname);
}
