# Hacolioのメール招待デモ

ポートフォリオの「アプリを試す」からメールアドレスを入力し、届いたリンクで本人が「デモを開く」を押すと、専用アカウントを作成します。

- 公開先の想定：`https://demo.hacolio.com`
- 現在のプレビュー：`https://preview.hacolio.com`（設定・データは変更しません）
- 招待リンク：15分・一度だけ利用可能。URLフラグメントにトークンを入れ、ページ表示時にアドレスバーから除去します。
- デモ利用：開始から24時間。アカウントと個人ワークスペースは、期限後のクリーンアップで削除します。新しい申し込み時と毎日のCronでクリーンアップするため、物理削除は利用終了から最大約24時間後です。
- 各利用者に個別の空のワークスペースを作成します。本人のメールアドレスはアプリに保存せず、送信制限用のHMACだけを短期間保持します。メール配信事業者側のログは、そのサービスの保持設定に従います。
- Basic認証情報はメールやポートフォリオのコードへ出しません。リンクの検証後に24時間の署名Cookieを発行します。
- グループ作成、他人への招待、通常ログイン・パスワード変更、管理画面、写真アップロード、AI、外部カタログ、通知等はデモ環境で拒否します。自分の持ち物や保存場所の編集を試せます。

## ファイルと組み込み

`overlay/` がHacolio側の追加ソース、`install.mjs` が既存ファイルへの限定的な組み込み処理です。既存ソースの差し込み位置をすべて確認してから書き込みます。既存プレビューの `cloudflare/wrangler.jsonc` は変更しません。

```powershell
# portfolio-3d フォルダーで実行。--apply がなければ確認のみです。
node integrations/hacolio-demo/install.mjs --target C:\創作\Hacolio
node integrations/hacolio-demo/install.mjs --target C:\創作\Hacolio --apply
```

新しいWorker名は `hacolio-portfolio-demo`、Durable Object名は `portfolio-demo-v1` です。新しいWorkerの名前空間を利用します。既存Workerへのデプロイ、既存DBの移行・コピーは不要です。

`DEMO_ACCESS_ENABLED=1` だけでは有効になりません。デモのデプロイ識別子、オブジェクト名、公開URL、認証設定がすべて一致する場合だけ公開エンドポイントを許可します。

## 公開前の設定

### 1. Resend

Resendで `notify.hacolio.com` を送信ドメインとして追加し、指示されたDNSレコードを設定します。既存の `hacolio.com` や `preview.hacolio.com` のDNSレコードは置き換えません。

送信専用APIキーを作成し、対象ドメインを限定します。送信者は `Hacolio Demo <demo@notify.hacolio.com>` です。独自ドメインを所有しているので、新規ドメインの購入は不要です。

送信回数はサーバー側で、メールアドレスごとに1時間3回、IPごとに1時間5回、デモ全体で24時間40回に制限します。Turnstile検証前の試行にもIP単位の制限があります。無料枠の利用状況はResendアカウント全体でも確認し、有料の超過送信を有効にしないでください。

### 2. Turnstile

Cloudflare TurnstileでManagedウィジェットを作成し、許可ホストに `letons11mrty.github.io` を設定します。独自ドメインへポートフォリオを移す場合は、そのホストも追加し、`DEMO_ALLOWED_ORIGINS` を更新してください。

公開するSite keyとサーバー専用のSecret keyを取得します。サーバーでは成功フラグだけでなく、ホスト名と `demo-invite` アクションも確認します。

### 3. Hacolioのデモ専用Secrets

以下はCloudflareの **hacolio-portfolio-demoだけ** に設定します。チャットや公開リポジトリへ貼り付けないでください。

| 名前 | 内容 |
| --- | --- |
| `BASIC_AUTH_USER` | デモ用の任意のユーザー名 |
| `BASIC_AUTH_PASSWORD` | 新規に生成した32文字以上のランダムな値。previewのものを流用しません |
| `DEMO_ACCESS_SECRET` | 別途生成した32文字以上のランダムな値 |
| `DEMO_RESEND_API_KEY` | Resendの送信専用APIキー |
| `DEMO_TURNSTILE_SECRET` | TurnstileのSecret key |

値は `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` 等で個別に生成できます。

Hacolioの `cloudflare` フォルダーから、それぞれ `npm exec -- wrangler secret put <名前> --config wrangler.demo.jsonc` で設定できます。新しいWorkerがまだない場合は、Wranglerが示す作成先が **hacolio-portfolio-demo** であることを確認してください。

### 4. デモのビルドと公開

```powershell
# C:\創作\Hacolio\cloudflare で実行
npm exec -- vite build --config vite.demo.config.mts
# 以下を実行するとデモ専用Workerを公開します。
npm exec -- wrangler deploy --config ../.cloudflare-demo-dist/server/wrangler.json
```

Cloudflareで `demo.hacolio.com` をこの新しいWorkerのCustom Domainにします。新規ホストのDNSレコードが既にある場合は、その用途を確認してから設定してください。`preview.hacolio.com` の既存ルートを変更する必要はありません。

実際のメールを自分のアドレスに送って確認する作業は、設定・公開後に別途必要です。外部プロバイダーとの接続、メール到達、実ドメインでのCookie、Cronの実行はローカルテストでは確認できません。

### 5. ポートフォリオの有効化

GitHubの `letons11mrty/portfolio_ver1` → Settings → Secrets and variables → Actions → Variables に、公開情報として以下を設定します。

| Repository variable | 値 |
| --- | --- |
| `HACOLIO_DEMO_URL` | `https://demo.hacolio.com` |
| `TURNSTILE_SITE_KEY` | TurnstileのSite key（Secret keyではありません） |

次のPagesビルドから「アプリを試す」を表示します。どちらかが未設定の場合は公開ビルドのボタンを非表示にし、既存のFigmaリンクを維持します。`npm run dev` では未設定でもボタンと入力画面を表示し、送信ボタンを「受付準備中」として無効にします。この状態ではTurnstileやメールAPIにも接続しません。秘密のAPIキーやBasic認証情報をGitHub Pagesのフロントエンド設定に入れないでください。

ローカルでは `.env.example` を参考に `.env.local` を作成します。

```dotenv
VITE_HACOLIO_DEMO_URL=https://demo.hacolio.com
VITE_TURNSTILE_SITE_KEY=取得した公開SiteKey
```

## テスト

```powershell
# portfolio-3d で実行。実メール・本番DBには接続しません。
node integrations/hacolio-demo/check.mjs C:\創作\Hacolio
npm run build
```

`check.mjs` は実アプリのコードとメモリ内SQLiteを使い、メール送信・Turnstileだけをモックにします。単回・期限・同時再利用、送信上限、悪意あるOrigin、入力上限、SQL風入力、ユーザー分離、デモの禁止操作、既存previewの認証を検証します。

ブラウザ確認用には、公開URLと仮のSite keyを指定してViteを5176番ポートで起動してから `node integrations/hacolio-demo/browser-check.mjs` を実行します。ブラウザ側のメール・Turnstile通信もモックされます。

`runtime-check.mjs` はlocalhostのWrangler HTTPSプレビューに対して、実際のCloudflareランタイムで招待ページ、CORS、SQLiteによる不正トークン拒否、本文サイズ、Basic認証の保護を確認する補助テストです。Wranglerは `--local-protocol https --local-upstream demo.hacolio.com --port 8795` で起動します。自己署名証明書の許可はこのlocalhost専用テストに限定しています。

## 料金・仕様の参照先

- [Cloudflare Workers料金](https://developers.cloudflare.com/workers/platform/pricing/)
- [SQLite版Durable Objects料金](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Resend料金](https://resend.com/pricing)
- [Resendの送信ドメイン](https://resend.com/docs/dashboard/domains/introduction)
- [Turnstileのサーバー検証](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

コード上の上限とサービスの無料枠は別です。実アカウントの契約や他のアプリと共有する使用量も確認してから公開してください。
