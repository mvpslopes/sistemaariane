/** URL do sistema interno (subdomínio sistema). */
export const SISTEMA_APP_URL =
  (import.meta.env.VITE_SISTEMA_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  (import.meta.env.VITE_GESTAO_APP_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://sistema.arianeandradeassessoria.app.br';

const PUBLIC_SITE_HOSTS = new Set([
  'arianeandradeassessoria.app.br',
  'www.arianeandradeassessoria.app.br',
]);

/** Site institucional (domínio raiz) — não o subdomínio do sistema. */
export function isPublicSiteHost(hostname = window.location.hostname): boolean {
  const host = hostname.toLowerCase();
  return PUBLIC_SITE_HOSTS.has(host);
}

export function sistemaLoginUrl(): string {
  return `${SISTEMA_APP_URL}/login`;
}

export function sistemaAppUrl(path = '/app'): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SISTEMA_APP_URL}${clean}`;
}

export function openSistemaLogin(): void {
  window.location.assign(sistemaLoginUrl());
}

/** Redireciona rotas do sistema quando acessadas no domínio da landing. */
export function redirectToSistema(path = '/login'): void {
  window.location.replace(sistemaAppUrl(path));
}

/** @deprecated Use sistemaLoginUrl */
export const gestaoLoginUrl = sistemaLoginUrl;

/** @deprecated Use openSistemaLogin */
export const openGestaoLogin = openSistemaLogin;
