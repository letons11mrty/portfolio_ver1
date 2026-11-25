import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/server/accounts";
import { grantDemoBasicAccess } from "@/lib/server/basicAccess";
import { requestOrigin } from "@/lib/server/requestOrigin";
import { assertDemoAccessEnabled, DEMO_SESSION_SECONDS, DemoAccessError } from "@/lib/server/demoAccessConfig";
import { consumeDemoInvite, limitDemoAttempts, readDemoJson } from "@/lib/server/demoAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const securityHeaders = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
};
function assertHost(request: NextRequest) {
  assertDemoAccessEnabled();
  if (requestOrigin(request) !== process.env.DEMO_PUBLIC_ORIGIN) throw new DemoAccessError("招待メールのURLから開き直してください。", 403);
}
export function GET(request: NextRequest) {
  try { assertHost(request); } catch (error) { return new NextResponse("このページは公開されていません。", { status: error instanceof DemoAccessError ? error.status : 503, headers: securityHeaders }); }
  const nonce = randomBytes(18).toString("base64");
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hacolio デモへのご招待</title>
<style nonce="${nonce}">*{box-sizing:border-box}body{margin:0;padding:32px 22px;min-height:100svh;display:grid;place-items:center;background:#f0efeb;color:#20201e;font-family:Arial,'Noto Sans JP',sans-serif}main{width:100%;max-width:480px}.eyebrow{font-size:12px;letter-spacing:.12em;color:#73736d}h1{font-size:32px;font-weight:500;margin:28px 0}p{font-size:14px;line-height:2}button{margin:24px 0 10px;border:0;background:#20201e;color:#fff;border-radius:4px;padding:16px 24px;min-height:48px;font:inherit;cursor:pointer}button:disabled{opacity:.5;cursor:default}button:focus-visible{outline:3px solid #c64428;outline-offset:4px}#status{color:#a0311c;min-height:2em}.note{font-size:12px;color:#73736d;border-top:1px solid #cccac3;padding-top:20px}a{color:inherit}</style></head>
<body><main><p class="eyebrow">HACOLIO / DEMO</p><h1>Hacolioを試してみる</h1><p>あなた専用のデモ用アカウントで、持ち物と保存場所の管理をお試しいただけます。</p><p>利用期間は開始から24時間です。大切な情報や実際の個人情報は入力せず、サンプルの内容でお試しください。</p><button id="open" type="button">デモを開く ↗</button><p id="status" role="status" aria-live="polite"></p><p class="note">デモでは写真アップロード・AI・通知など、一部の機能は利用できません。期限が切れたデータは自動で削除します。<br><a href="https://letons11mrty.github.io/portfolio_ver1/#project-06">ポートフォリオに戻る</a></p></main>
<script nonce="${nonce}">
let token=location.hash.slice(1);history.replaceState(null,'',location.pathname);const button=document.getElementById('open'),status=document.getElementById('status');
if(!/^[A-Za-z0-9_-]{43}$/.test(token)){button.disabled=true;status.textContent='招待メールのリンクから開いてください。';}
button.addEventListener('click',async()=>{button.disabled=true;status.textContent='デモを準備しています…';try{const response=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const data=await response.json();if(!response.ok)throw new Error(data.error||'デモを開始できませんでした。');token='';location.replace('/');}catch(error){status.textContent=error.message||'接続できませんでした。もう一度お試しください。';button.disabled=false;}});
</script></body></html>`;
  return new NextResponse(html, { headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'` } });
}
export async function POST(request: NextRequest) {
  try {
    assertHost(request);
    if (request.headers.get("origin") !== process.env.DEMO_PUBLIC_ORIGIN) throw new DemoAccessError("招待メールのURLから開き直してください。", 403);
    limitDemoAttempts(request, "accept");
    const body = await readDemoJson(request);
    // Validate cookie configuration before consuming a one-use invitation.
    const response = NextResponse.json({ ok: true }, { headers: securityHeaders });
    grantDemoBasicAccess(response);
    const session = consumeDemoInvite(body.token);
    response.cookies.set(SESSION_COOKIE, session.token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DEMO_SESSION_SECONDS });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof DemoAccessError ? error.message : "デモを開始できませんでした。時間をおいてお試しください。" }, { status: error instanceof DemoAccessError ? error.status : 503, headers: securityHeaders });
  }
}
