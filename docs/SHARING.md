# 結果画像と共有

`src/share.ts` は結果画面に入った時点で `prepareResultCard(result)` を実行し、ニラ写真入りの 1200 × 630 px PNG、共有文、URL を準備します。共有ボタンのクリック時は、準備済みデータを `shareResultCard(prepared)` に直接渡してください。画像生成の完了をクリック内で待たないことで、スマートフォンの共有ダイアログに必要なユーザー操作の権限を保ちます。

共有文には記録、紹介文、`#ニラ飛ばし #NIRATHROW`、ゲーム URL が入ります。URL は実際に開いているページからクエリとハッシュを除いたものなので、GitHub Pages のリポジトリ名を含むパスにも対応します。

## スマートフォン

HTTPS 上で Web Share API とファイル共有を利用できる場合は、画像ファイル、共有文、ゲーム URL を OS の共有画面へまとめて渡します。ユーザーが投稿先を選ぶと、そのアプリの投稿画面へ進みます。共有先アプリが画像・文章・URL のどこまで受け取るかは、そのアプリとブラウザーによって異なります。ゲーム側から投稿の自動送信や SNS への画像添付を保証することはできません。

共有画面を閉じた場合は `cancelled` を返し、成功表示や画像保存を行いません。`shared` は OS の共有操作が完了したことを表し、SNS への公開完了の確認ではありません。

## ファイル共有に対応しないブラウザー

結果画像をダウンロードし、可能な場合は共有文をクリップボードにコピーします。戻り値の `downloaded` はこの保存処理を表し、クリップボードへのコピー成功を保証しません。ページの UI にも共有文を表示するか、独立したコピーボタンを用意すると、クリップボード制限がある環境でも投稿できます。

`getXShareUrl(result)` は文章入りの X 投稿画面へのリンクを作成します。このリンクから結果画像を自動添付することはできないため、保存した画像を投稿画面で選ぶ必要があります。

再プレイでカードを作り直すときは、古い `prepared.url` を `URL.revokeObjectURL()` で解放してください。`downloadResultCard(prepared)` はカードの保存専用ボタンにも使用できます。

## 写真素材

- ファイル: `public/nira-photo.jpg`（元画像と同じ寸法、JPEG 品質 90、約 262 KB）
- 生成方法: 組み込み image_gen ツール
- 生成画像を同寸法のJPEGに変換し、このリポジトリーに同梱しています。

最終プロンプト:

```text
Use case: photorealistic-natural
Asset type: photograph for a mobile browser game's share-result card
Primary request: A beautiful photorealistic still-life photograph of fresh Japanese garlic chives (nira), recognizable long flat deep green leaves with a few pale cut bases, in a loose gently fanned bunch.
Scene/backdrop: seamless warm ivory cream matte surface and background, editorial food photography.
Composition/framing: square crop, bunch centered diagonally from lower left to upper right with clean margins so it can be cropped into a portrait inset; the leaves fill most of the image, no other vegetables, no bowl, no hands.
Lighting/mood: warm soft natural light, fine soft shadows, appetizing fresh leafy texture.
Color palette: deep forest and vibrant leaf greens against warm ivory.
Constraints: actual realistic photo style, no text, no logos, no watermark, no border, no illustration.
```

写真は公開ディレクトリに同梱され、`import.meta.env.BASE_URL` を使って読み込まれます。外部画像への依存や Canvas のクロスオリジン制限を避けています。
