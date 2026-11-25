export class DemoAccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export const DEMO_REQUEST_PATH = "/api/demo-access/request";
export const DEMO_ACCEPT_PATH = "/api/demo-access/accept";
export const DEMO_SESSION_SECONDS = 24 * 60 * 60;
export const DEMO_INVITE_SECONDS = 15 * 60;

// A preview deployment must never acquire a public signup endpoint by accident.
export function demoAccessEnabled(): boolean {
  return process.env.DEMO_ACCESS_ENABLED === "1"
    && process.env.HACOLIO_DEPLOYMENT === "portfolio-demo"
    && /^portfolio-demo-[a-z0-9-]+$/.test(process.env.HACOLIO_OBJECT_NAME || "")
    && process.env.DEMO_PUBLIC_ORIGIN === "https://demo.hacolio.com"
    && process.env.ACCOUNTS_ENABLED === "1"
    && process.env.BASIC_AUTH_ENABLED === "1"
    && process.env.APP_ENV !== "staging";
}

export function assertDemoAccessEnabled() {
  if (!demoAccessEnabled()) throw new DemoAccessError("このページは公開されていません。", 404);
}

export function isPublicDemoEndpoint(pathname: string, method: string): boolean {
  if (!demoAccessEnabled()) return false;
  return pathname === DEMO_REQUEST_PATH && ["POST", "OPTIONS"].includes(method)
    || pathname === DEMO_ACCEPT_PATH && ["GET", "POST"].includes(method);
}

export function restrictedDemoPath(pathname: string): boolean {
  return /^\/(?:admin(?:\/|$)|api\/(?:admin|account\/google|ai-scan|catalog|companion|group-chat|notifications)(?:\/|$))/.test(pathname)
    || pathname.startsWith("/api/inventory/images/");
}

export function demoSecret(): string {
  const value = process.env.DEMO_ACCESS_SECRET || "";
  if (value.length < 32) throw new DemoAccessError("デモの準備中です。しばらくしてからお試しください。", 503);
  return value;
}

export function demoOrigins(): string[] {
  const values = (process.env.DEMO_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (!values.length || values.some(value => {
    try { const url = new URL(value); return url.origin !== value || url.protocol !== "https:"; }
    catch { return true; }
  })) throw new DemoAccessError("デモの準備中です。しばらくしてからお試しください。", 503);
  return values;
}
