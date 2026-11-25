import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { demoAccountDatabase } from "./accounts";
import { sqliteTransaction } from "./sqliteTransaction";
import {
  assertDemoAccessEnabled, demoSecret, DEMO_INVITE_SECONDS, DEMO_SESSION_SECONDS, DemoAccessError,
} from "./demoAccessConfig";

type Row = Record<string, string | number | null>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const privateKey = (value: string) => createHmac("sha256", demoSecret()).update(value).digest("hex");
const ready = new WeakSet<object>();

function database() {
  assertDemoAccessEnabled();
  demoSecret();
  const db = demoAccountDatabase();
  if (!ready.has(db)) {
    db.exec(`CREATE TABLE IF NOT EXISTS portfolio_demo_invites (
      token_hash TEXT PRIMARY KEY, email_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS portfolio_demo_invite_email ON portfolio_demo_invites(email_hash);
    CREATE TABLE IF NOT EXISTS portfolio_demo_limits (
      key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
    );`);
    ready.add(db);
  }
  return db;
}

function prune(db: DatabaseSync, now: number) {
  db.prepare("DELETE FROM portfolio_demo_invites WHERE expires_at<=?").run(now);
  db.prepare("DELETE FROM portfolio_demo_limits WHERE reset_at<=?").run(now);
  // Demo accounts can own only their personal workspace; group creation is disabled.
  db.prepare("DELETE FROM workspaces WHERE kind='personal' AND id IN (SELECT m.workspace_id FROM members m JOIN portfolio_demo_accounts d ON d.user_id=m.user_id WHERE d.expires_at<=?)").run(now);
  db.prepare("DELETE FROM users WHERE id IN (SELECT user_id FROM portfolio_demo_accounts WHERE expires_at<=?)").run(now);
}

export function cleanupDemoAccess() {
  const db = database();
  sqliteTransaction(db, () => prune(db, Date.now()));
}

function limit(entries: { key: string; maximum: number; duration: number }[]) {
  const db = database(), now = Date.now();
  const allowed = sqliteTransaction(db, () => {
    prune(db, now);
    for (const entry of entries) {
      const row = db.prepare("SELECT attempts FROM portfolio_demo_limits WHERE key=? AND reset_at>?").get(entry.key, now) as Row | undefined;
      if (row && Number(row.attempts) >= entry.maximum) return false;
    }
    for (const entry of entries) db.prepare("INSERT INTO portfolio_demo_limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1").run(entry.key, 1, now + entry.duration);
    return true;
  });
  if (!allowed) throw new DemoAccessError("送信回数の上限に達しました。時間をおいてお試しください。", 429);
}

export function limitDemoAttempts(request: Request, kind: "request" | "accept") {
  // Cloudflare supplies this header. Do not accept a client-supplied X-Forwarded-For.
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  limit([{ key: privateKey(`${kind}:ip:${ip}`), maximum: kind === "request" ? 12 : 20, duration: 10 * 60_000 }]);
}

export function normalizeDemoEmail(value: unknown): string {
  if (typeof value !== "string" || value.length > 254 || /[\r\n\u0000]/.test(value)) throw new DemoAccessError("メールアドレスを確認してください。");
  const email = value.trim(), parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || parts[0].length > 64 || /\s/.test(email)
    || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(parts[1])
    || parts[1].includes("..")) throw new DemoAccessError("メールアドレスを確認してください。");
  return `${parts[0]}@${parts[1].toLowerCase()}`;
}

export function reserveDemoInvite(email: string, request: Request) {
  const emailHash = privateKey(`email:${email}`), ip = request.headers.get("cf-connecting-ip") || "unknown";
  limit([
    { key: `mail:${emailHash}`, maximum: 3, duration: 60 * 60_000 },
    { key: privateKey(`mail-ip:${ip}`), maximum: 5, duration: 60 * 60_000 },
    { key: "daily-mail-budget", maximum: 40, duration: 24 * 60 * 60_000 },
  ]);
  const token = randomBytes(32).toString("base64url"), tokenHash = hash(token);
  database().prepare("INSERT INTO portfolio_demo_invites(token_hash,email_hash,expires_at) VALUES (?,?,?)").run(tokenHash, emailHash, Date.now() + DEMO_INVITE_SECONDS * 1000);
  return { token, tokenHash, emailHash };
}

export function markDemoInviteSent(invite: { tokenHash: string; emailHash: string }) {
  // Independent one-use links avoid invalidating each other if provider replies arrive out of order.
  database().prepare("UPDATE portfolio_demo_invites SET sent=1 WHERE token_hash=?").run(invite.tokenHash);
}

export function cancelDemoInvite(tokenHash: string) {
  database().prepare("DELETE FROM portfolio_demo_invites WHERE token_hash=?").run(tokenHash);
}

export function consumeDemoInvite(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new DemoAccessError("招待リンクを確認してください。", 410);
  const db = database(), now = Date.now();
  return sqliteTransaction(db, () => {
    prune(db, now);
    const invite = db.prepare("SELECT token_hash FROM portfolio_demo_invites WHERE token_hash=? AND sent=1 AND expires_at>?").get(hash(value), now);
    if (!invite) throw new DemoAccessError("この招待リンクは期限切れ、または使用済みです。ポートフォリオから再度お申し込みください。", 410);
    const userId = randomUUID(), workspaceId = randomUUID(), token = randomBytes(32).toString("base64url");
    const expiresAt = now + DEMO_SESSION_SECONDS * 1000, createdAt = new Date(now).toISOString();
    // No email address or usable password is stored in the demo application.
    db.prepare("INSERT INTO users VALUES (?,?,?,?,?)").run(userId, `demo_${userId.replaceAll("-", "")}`, "デモユーザー", "", now);
    db.prepare("INSERT INTO allowed_accounts VALUES (?)").run(userId);
    db.prepare("INSERT INTO workspaces(id,name,kind) VALUES (?,?,'personal')").run(workspaceId, "自分の持ち物");
    db.prepare("INSERT INTO members(workspace_id,user_id,role) VALUES (?,?,'owner')").run(workspaceId, userId);
    const locationId = randomUUID();
    const data = { locations: [{ id: locationId, name: "サンプルの保存場所", parentId: null, createdAt }], items: [] };
    db.prepare("INSERT INTO inventories(workspace_id,data) VALUES (?,?)").run(workspaceId, JSON.stringify(data));
    db.prepare("INSERT INTO portfolio_demo_accounts VALUES (?,?)").run(userId, expiresAt);
    db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(hash(token), userId, workspaceId, expiresAt);
    db.prepare("DELETE FROM portfolio_demo_invites WHERE token_hash=?").run(hash(value));
    return { token, expiresAt };
  });
}

export async function readDemoJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new DemoAccessError("送信形式を確認してください。", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new DemoAccessError("入力内容を確認してください。");
  const chunks: Uint8Array[] = []; let length = 0;
  for (;;) {
    const next = await reader.read(); if (next.done) break;
    length += next.value.byteLength;
    if (length > 4096) { await reader.cancel(); throw new DemoAccessError("入力内容が長すぎます。", 413); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new DemoAccessError("入力内容を確認してください。"); }
}

export async function verifyDemoChallenge(token: unknown, requestOrigin: string) {
  const secret = process.env.DEMO_TURNSTILE_SECRET;
  if (!secret || typeof token !== "string" || !token || token.length > 2048) throw new DemoAccessError("確認操作をやり直してください。", 400);
  let result: { success?: boolean; hostname?: string; action?: string };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch { throw new DemoAccessError("確認サービスに接続できませんでした。時間をおいてお試しください。", 503); }
  if (!result.success || result.action !== "demo-invite" || result.hostname !== new URL(requestOrigin).hostname) throw new DemoAccessError("確認操作をやり直してください。", 400);
}

export async function sendDemoInvite(email: string, token: string, idempotencyKey: string) {
  const apiKey = process.env.DEMO_RESEND_API_KEY, from = process.env.DEMO_EMAIL_FROM;
  if (!apiKey || !from || /[\r\n]/.test(from)) throw new DemoAccessError("デモの準備中です。しばらくしてからお試しください。", 503);
  const link = `${process.env.DEMO_PUBLIC_ORIGIN}/api/demo-access/accept#${token}`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from, to: [email], subject: "Hacolio デモへのご招待",
        text: `Hacolioのデモにお申し込みいただき、ありがとうございます。\n\n次のリンクを開き、「デモを開く」を押してください。\n${link}\n\nリンクの有効期限は15分、デモの利用期間は開始から24時間です。\nデモではご自身専用の架空データを使用します。一部の外部連携機能は利用できません。\n\nお心当たりがない場合は、このメールを破棄してください。` }),
    });
    if (!response.ok) throw new Error();
  } catch { throw new DemoAccessError("メールを送信できませんでした。時間をおいてお試しください。", 503); }
}
