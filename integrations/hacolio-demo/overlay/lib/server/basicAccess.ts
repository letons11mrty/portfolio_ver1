import { createHash, createHmac } from "node:crypto";
import type { NextResponse } from "next/server";
import { assertDemoAccessEnabled, DEMO_SESSION_SECONDS, DemoAccessError } from "./demoAccessConfig";

export function signBasicAccess(value: string, user: string, password: string) {
  return createHmac("sha256", createHash("sha256").update(JSON.stringify([user, password])).digest())
    .update("hacolio-staging-access:" + value).digest("base64url");
}

export function assertDemoBasicConfigured() {
  assertDemoAccessEnabled();
  if (!process.env.BASIC_AUTH_USER || (process.env.BASIC_AUTH_PASSWORD || "").length < 32) {
    throw new DemoAccessError("デモの準備中です。しばらくしてからお試しください。", 503);
  }
}

export function grantDemoBasicAccess(response: NextResponse) {
  assertDemoBasicConfigured();
  const expiry = String(Date.now() + DEMO_SESSION_SECONDS * 1000);
  const signature = signBasicAccess(expiry, process.env.BASIC_AUTH_USER!, process.env.BASIC_AUTH_PASSWORD!);
  response.cookies.set("hacolio-development-access", expiry + "." + signature,
    { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DEMO_SESSION_SECONDS });
}
