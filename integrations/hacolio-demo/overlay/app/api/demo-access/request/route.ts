import { NextRequest, NextResponse } from "next/server";
import { assertDemoBasicConfigured } from "@/lib/server/basicAccess";
import { requestOrigin } from "@/lib/server/requestOrigin";
import { assertDemoAccessEnabled, demoOrigins, DemoAccessError } from "@/lib/server/demoAccessConfig";
import { cancelDemoInvite, limitDemoAttempts, markDemoInviteSent, normalizeDemoEmail, readDemoJson, reserveDemoInvite, sendDemoInvite, verifyDemoChallenge } from "@/lib/server/demoAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers(origin?: string) {
  return { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", Vary: "Origin",
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } : {}) };
}
function allowedOrigin(request: NextRequest) {
  assertDemoAccessEnabled();
  if (requestOrigin(request) !== process.env.DEMO_PUBLIC_ORIGIN) throw new DemoAccessError("送信先を確認してください。", 403);
  const origin = request.headers.get("origin");
  if (!origin || !demoOrigins().includes(origin)) throw new DemoAccessError("ポートフォリオからお申し込みください。", 403);
  return origin;
}
export function OPTIONS(request: NextRequest) {
  try { return new NextResponse(null, { status: 204, headers: headers(allowedOrigin(request)) }); }
  catch (error) { return NextResponse.json({ error: "送信元を確認できませんでした。" }, { status: error instanceof DemoAccessError ? error.status : 503, headers: headers() }); }
}
export async function POST(request: NextRequest) {
  let origin: string | undefined;
  try {
    origin = allowedOrigin(request);
    assertDemoBasicConfigured();
    limitDemoAttempts(request, "request");
    const body = await readDemoJson(request), email = normalizeDemoEmail(body.email);
    await verifyDemoChallenge(body.challenge, origin);
    const invite = reserveDemoInvite(email, request);
    try {
      await sendDemoInvite(email, invite.token, invite.tokenHash);
      markDemoInviteSent(invite);
    } catch (error) { cancelDemoInvite(invite.tokenHash); throw error; }
    return NextResponse.json({ message: "招待メールを送信しました。15分以内にメールのリンクを開いてください。" }, { status: 202, headers: headers(origin) });
  } catch (error) {
    const status = error instanceof DemoAccessError ? error.status : 503;
    return NextResponse.json({ error: error instanceof DemoAccessError ? error.message : "現在お申し込みを受け付けられません。時間をおいてお試しください。" }, { status, headers: { ...headers(origin), ...(status === 429 ? { "Retry-After": "3600" } : {}) } });
  }
}
