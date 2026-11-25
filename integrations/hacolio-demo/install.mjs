import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const normalized = value => value.replaceAll('\r\n', '\n');

export function prepareDemoIntegration(target) {
  const root = path.resolve(target), files = new Map();
  const read = name => normalized(fs.readFileSync(path.join(root, name), 'utf8'));
  const patch = (name, changes, marker) => {
    let text = read(name);
    if (text.includes(marker)) return;
    for (const [before, after] of changes) {
      if (text.split(before).length !== 2) throw new Error(`Expected exactly one integration anchor in ${name}: ${before.slice(0, 80)}`);
      text = text.replace(before, after);
    }
    files.set(name, text);
  };
  patch('proxy.ts', [
    ['createHash, createHmac, timingSafeEqual', 'createHash, timingSafeEqual'],
    ['import { hasSameOrigin } from "./lib/server/requestOrigin";', 'import { hasSameOrigin } from "./lib/server/requestOrigin";\nimport { signBasicAccess as signAccess } from "./lib/server/basicAccess";\nimport { demoAccessEnabled, isPublicDemoEndpoint, restrictedDemoPath } from "./lib/server/demoAccessConfig";'],
    ['function signAccess(value:string,user:string,password:string){return createHmac("sha256",createHash("sha256").update(JSON.stringify([user,password])).digest()).update("hacolio-staging-access:"+value).digest("base64url");}\n', ''],
    [' if(!staging&&process.env.BASIC_AUTH_ENABLED!=="1")return NextResponse.next();', ' if(!staging&&process.env.BASIC_AUTH_ENABLED!=="1")return NextResponse.next();\n // Portfolio demo entrypoints are public only in an isolated demo deployment.\n if(isPublicDemoEndpoint(request.nextUrl.pathname,request.method)){const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");return response;}\n if(demoAccessEnabled()&&restrictedDemoPath(request.nextUrl.pathname))return NextResponse.json({error:"この機能はデモでは利用できません。"},{status:403,headers:{"Cache-Control":"private, no-store"}});'],
  ], 'Portfolio demo entrypoints');
  patch('lib/server/accounts.ts', [
    ['import { sqliteTransaction } from "./sqliteTransaction";', 'import { sqliteTransaction } from "./sqliteTransaction";\nimport { assertDemoAccessEnabled, demoAccessEnabled } from "./demoAccessConfig";'],
    ['    CREATE TABLE IF NOT EXISTS allowed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);', '    CREATE TABLE IF NOT EXISTS allowed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE);\n    CREATE TABLE IF NOT EXISTS portfolio_demo_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);'],
    ['function transaction<T>(work: () => T): T {', 'export function demoAccountDatabase() { assertDemoAccessEnabled(); return db(); }\n\nfunction transaction<T>(work: () => T): T {'],
    ['  assertAllowed(String(session.user_id));', '  assertAllowed(String(session.user_id));\n  if (demoAccessEnabled()) {\n    const demo = db().prepare("SELECT expires_at FROM portfolio_demo_accounts WHERE user_id=?").get(session.user_id!) as Row | undefined;\n    if (!demo || Number(demo.expires_at) <= Date.now()) throw new AccountError("デモの利用期間が終了しました。ポートフォリオから再度お申し込みください。", 401);\n  }'],
  ], 'export function demoAccountDatabase()');
  patch('app/api/account/route.ts', [
    ['import { normalizeGroupPhoto } from "@/lib/server/groupPhoto";', 'import { normalizeGroupPhoto } from "@/lib/server/groupPhoto";\nimport { demoAccessEnabled } from "@/lib/server/demoAccessConfig";'],
    ['    if (body.action === "login") return sessionResponse(request, await login(request, body));', '    if (demoAccessEnabled() && !["logout", "profile", "switch"].includes(String(body.action))) throw new AccountError("この操作はデモでは利用できません。", 403);\n    if (body.action === "login") return sessionResponse(request, await login(request, body));'],
  ], 'この操作はデモでは利用できません。');
  patch('cloudflare/worker.ts', [
    ["import {catalogProbe,productProbe,foodProbe} from './catalog-probe';", "import {catalogProbe,productProbe,foodProbe} from './catalog-probe';\nimport {demoAccessEnabled,isPublicDemoEndpoint} from '../lib/server/demoAccessConfig';\nimport {cleanupDemoAccess} from '../lib/server/demoAccess';"],
    ['  HACOLIO_OBJECT_NAME?: string;', '  HACOLIO_OBJECT_NAME?: string;\n  DEMO_ACCESS_ENABLED?: string;'],
    ['provisionAdmin(input:AdminAccount):unknown', 'provisionAdmin(input:AdminAccount):unknown; cleanupDemo():unknown'],
    ['  private activity=new AccountActivity();', '  private activity=new AccountActivity();\n  cleanupDemo() { return backendContext.run({storage:this.state.storage},()=>cleanupDemoAccess()); }'],
    ['    const prepared=await bufferedRequest(request,webhook?65536:20_000_000);', '    const demo=demoAccessEnabled();\n    if(demo){const gate=proxy(new NextRequest(request.url,{method:request.method,headers:request.headers}));if(gate.headers.get("x-middleware-next")!=="1")return gate;}\n    const maximum=demo?(isPublicDemoEndpoint(new URL(request.url).pathname,request.method)?4096:1_000_000):20_000_000;\n    const prepared=await bufferedRequest(request,webhook?65536:maximum);'],
    ['export default {\n  async fetch', 'export default {\n  async scheduled(_controller:unknown,environment:Environment) {\n    if(environment.DEMO_ACCESS_ENABLED===\'1\')await environment.HACOLIO.getByName(environment.HACOLIO_OBJECT_NAME||\'\').cleanupDemo();\n  },\n  async fetch'],
  ], 'cleanupDemo()');

  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const name = path.join(prefix, entry.name);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), name);
      else {
        const text = normalized(fs.readFileSync(path.join(dir, entry.name), 'utf8'));
        const existing = path.join(root, name);
        if (fs.existsSync(existing) && normalized(fs.readFileSync(existing, 'utf8')) !== text) throw new Error(`Refusing to overwrite a different integration file: ${name}`);
        files.set(name, text);
      }
    }
  };
  walk(path.join(folder, 'overlay'));
  const base = JSON.parse(read('cloudflare/wrangler.jsonc'));
  const configuration = {
    $schema: base.$schema, name: 'hacolio-portfolio-demo', compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags, main: 'worker.ts',
    assets: { ...base.assets, directory: '../.cloudflare-demo-dist/client' }, workers_dev: false, preview_urls: false,
    routes: [{ pattern: 'demo.hacolio.com', custom_domain: true }],
    vars: { ACCOUNTS_ENABLED: '1', NEXT_PUBLIC_ACCOUNTS_ENABLED: '1', BASIC_AUTH_ENABLED: '1', HACOLIO_CLOUDFLARE: '1',
      APP_ENV: 'demo', HACOLIO_DEPLOYMENT: 'portfolio-demo', HACOLIO_OBJECT_NAME: 'portfolio-demo-v1',
      DEMO_ACCESS_ENABLED: '1', DEMO_PUBLIC_ORIGIN: 'https://demo.hacolio.com',
      DEMO_ALLOWED_ORIGINS: 'https://letons11mrty.github.io', DEMO_EMAIL_FROM: 'Hacolio Demo <demo@notify.hacolio.com>',
      SECURITY_PUSH_ENABLED: '0' },
    durable_objects: base.durable_objects, migrations: base.migrations,
    triggers: { crons: ['0 0 * * *'] },
  };
  files.set('cloudflare/wrangler.demo.jsonc', JSON.stringify(configuration, null, 2) + '\n');
  files.set('cloudflare/vite.demo.config.mts', read('cloudflare/vite.config.mts')
    .replaceAll('.cloudflare-dist', '.cloudflare-demo-dist').replace('configPath:local("wrangler.jsonc")', 'configPath:local("wrangler.demo.jsonc")'));
  const ignore = read('.gitignore');
  if (!ignore.split('\n').includes('.cloudflare-demo-dist/')) files.set('.gitignore', ignore.trimEnd() + '\n\n# Isolated portfolio demo build\n.cloudflare-demo-dist/\n');
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[process.argv.indexOf('--target') + 1];
  if (!process.argv.includes('--target') || !target) throw new Error('Use --target <Hacolio folder> [--apply]. Default is a read-only check.');
  const files = prepareDemoIntegration(target);
  for (const name of files.keys()) console.log(name);
  if (process.argv.includes('--apply')) {
    // All source anchors and new files have been checked before any write.
    for (const [name, text] of files) {
      const destination = path.resolve(target, name);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, text);
    }
    console.log(`Applied ${files.size} files. Existing preview configuration was not changed.`);
  } else console.log(`Checked ${files.size} files; no changes written.`);
}
