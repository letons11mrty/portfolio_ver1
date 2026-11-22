# わびさび版 リニューアル

## 差し替え・追加するファイル
- index.html（全面的に書き直し）
- src/wabi.css（前回の版を置き換え。これ1枚で見た目が完結）
- src/wabi.js（新規。動画の再生とフェードだけを担当）

旧CSS（studio.css / timeline.css / project-covers.css / scroll-reveal.css / responsive.css / finishing.css）と
旧JS（timeline.js / navigation.js / demo-video.js / scroll-reveal.js）は読み込んでいません。
消さずに残しておけば、いつでも元に戻せます（念のため今の index.html は studio.html などに退避推奨）。

## 構成の変更
1. 年表のカード型スライドを廃止 → 「目録」（一〜六の一覧）＋作品を縦に並べる巻物型に
2. ノートPC・スマホのデバイス枠を廃止 → 画面は紙に置いたような枠なしの画像
3. 縦書きの見出し、作品ごとに左右を入れ替える非対称レイアウト
4. 動画の自動再生を廃止 → 「操作デモを再生する」を押したときだけ読み込み・再生
5. 動きはゆっくりしたフェードのみ（「視差効果を減らす」設定ではオフ）

## 引き続き手作業で必要なこと
- book.html / page-turn.html の artiste-site → artist-site
  sed -i 's#artiste-site#artist-site#g' book.html page-turn.html
- 画像パスは元の index.html と同じものを使っています。npm run dev で表示確認を
