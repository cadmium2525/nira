# 結果画像と共有

`src/share.ts` は結果画面に入った時点で `prepareResultCard(result)` を実行し、ニラ写真入りの 1200 × 630 px PNG、共有文、URL を準備します。共有ボタンのクリック時は、準備済みデータを `shareResultCard(prepared)` に直接渡してください。画像生成の完了をクリック内で待たないことで、スマートフォンの共有ダイアログに必要なユーザー操作の権限を保ちます。

共有文には記録、紹介文、`#ニラ飛ばし #NIRATHROW`、ゲーム URL が入ります。URL は実際に開いているページからクエリとハッシュを除いたものなので、GitHub Pages のリポジトリ名を含むパスにも対応します。

## スマートフォン

HTTPS 上で Web Share API とファイル共有を利用できる場合は、画像ファイルと、紹介文・記録・タグ・ゲームURLを含む一つの本文を OS の共有画面へ渡します。`navigator.share({ title, text: prepared.text, files: [prepared.file] })` とし、`url` フィールドは指定しません。

WebKit は `text` と `url` を別々のネイティブ項目として渡すため、URLだけを受け取って文章が欠落することを避ける構成です。[WebKitの共有実装](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/Cocoa/WKShareSheet.mm)

ユーザーが投稿先を選ぶと、そのアプリの投稿画面へ進みます。共有先アプリが画像・文章をどこまで受け取るかは、そのアプリとブラウザーによって異なります。画像と文章の同時共有には [WebKitの未解決報告](https://bugs.webkit.org/show_bug.cgi?id=251500) もあり、実機のiPhone版Xへの受け渡しは別途確認が必要です。ゲーム側から投稿の自動送信や、共有先での本文の反映を保証することはできません。

共有画面を閉じた場合は `cancelled` を返し、成功表示や画像保存を行いません。`shared` は OS の共有操作が完了したことを表し、SNS への公開完了の確認ではありません。

## ファイル共有に対応しないブラウザー

結果画像をダウンロードし、可能な場合は同じ共有文をクリップボードにコピーします。戻り値の `downloaded` はこの保存処理を表し、クリップボードへのコピー成功を保証しません。結果画面の操作は「記録をシェア」「もう一度」「画像保存」のみで、投稿文コピー・X投稿の補助行は表示しません。

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
