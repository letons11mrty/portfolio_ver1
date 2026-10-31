# Kiyoto Ishii — Portfolio

現在のサイトは **index.html** です。

## フォルダ案内

| 場所 | 内容 |
| --- | --- |
| index.html | 現行サイトの入口。普段はこちらを編集 |
| src/ | デザイン・画面切り替え・動画再生のコード |
| public/ | サイトが実際に読み込む画像・動画 |
| materials/ | 録画の原本・プロフィール写真の原本 |
| docs/ | 機能要件・面接用の説明資料 |
| archive/ | 保存しているA案 |
| dist/ | ビルドで生成される公開用ファイル |

## 起動・ビルド

- npm run dev -- --host 127.0.0.1 --port 5175
- 確認URL: http://127.0.0.1:5175/portfolio_ver1/
- npm run build

## ページ

- index.html：現行版
- studio.html：現行デザインの別入口（共通コード・素材を使用）
- book.html：保存しているA案
- page-turn.html：以前のめくりモーション版

## 編集する場所

- 見出し・紹介文・リンク：index.html（studio.htmlも同内容を反映）
- 全体の見た目：src/studio.css
- 作品一覧のレイアウト：src/timeline.css
- 各作品バナー：src/project-covers.css
- スマホ・タブレットのレイアウト：src/responsive.css
- 画面切り替え：src/timeline.js
- 動画の再生制御：src/demo-video.js

## 動画

録画原本は materials/recordings/、表示用は public/ 内です。
表示用は Eve・Lumos・Sukima・Beauty が各作品名のMP4、Hacolioが work05-hacolio/hacolio.mp4 です。
HacolioのMOV原本は、ブラウザ向けにMP4へ変換しています。
原本を追加・変更しただけでは、表示用動画は更新されません。

## 保管データ

archive/a-book-preserved/ にA案を保存しています。
録画・写真の原本は materials/ に残しています。
一時データ、旧動画、試作、重複バックアップ、制作時だけの補助スクリプトは整理済みです。

## GitHub

新版リポジトリ： https://github.com/letons11mrty/portfolio_ver1
公開パス： /portfolio_ver1/
materials/・docs/・archive/ はローカル保管用のためGit管理から除外しています。
dist/ は npm run build で再生成します。

## レスポンシブの動作

スマホでは年表を上部にまとめ、作品バナーを全幅で表示します。画面幅や高さにかかわらず、作品スライドとプロフィール・Aboutへの画面切り替えを維持します。低い画面では見出しや補助情報をコンパクトにして表示領域を確保します。
