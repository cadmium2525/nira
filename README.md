# ニラ飛ばし / NIRA THROW

スマホで遊べる、Three.js 製のニラ投げゲームです。8本から2本を選び、ランダムな風を読んで2投の最高飛距離を競います。左右の白線を一度でも越えると、その投球は場外になります。

## 遊び方

1. **ニラを選べ！** 気になる2本をタップして、舞台へ進みます。選んだニラを再びタップすると外せます。
2. **ニラを飛ばせ！** 投球エリアを長押しして、メーターのタイミングを合わせます。そのまま上へスワイプし、指を離すと投げます。スワイプを始めた時点でパワーが決まり、縦の長さで高さ、左右の向きで方向が変わります。
3. **結果発表！** 2投の記録とニラの写真を入れた結果画像を共有できます。

PCではマウスの長押しとドラッグで操作できます。スペースキーを長押しして離すと、中央へ投げられます。音は初期状態でオフです。

## ローカルで動かす

Node.js 22.12以上と npm を用意し、このフォルダーで実行します。

```sh
npm install
npm run dev
```

ブラウザーで `http://127.0.0.1:5173` を開きます。

```sh
npm test
npm run build
```

テストではパワーのタイミング、風の影響、場外判定、着地を確認します。ビルド結果は `dist/` に出力されます。公開用ビルドの確認には `npm run preview` を使い、表示されたURLを開いてください。

## 0円で GitHub Pages に公開する

このゲームには、有料API・有料ホスティング・データベース・APIキーが不要です。結果カードの画像生成やゲームの計算はブラウザー内で行い、同梱のニラ画像を使います。GitHub Free の **公開リポジトリー** と標準の `ubuntu-latest` ランナーで公開できます。GitHub Pages は公開リポジトリーで無料、標準の GitHub Actions ランナーも公開リポジトリーで無料です。[GitHub Pages の提供条件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[GitHub Actions の料金](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

1. GitHub に公開リポジトリーを作ります。
2. このフォルダーのファイルを `main` ブランチへ push します。`package-lock.json` と `.github/workflows/deploy.yml` も含めます。`node_modules/` と `dist/` は含めません。
3. リポジトリーの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
4. **Actions → Deploy to GitHub Pages** で実行結果を確認します。必要なら **Run workflow** で実行してください。
5. 成功後に表示される `https://ユーザー名.github.io/リポジトリー名/` を開きます。

以後は `main` への push で、テスト・ビルド・公開が自動実行されます。`base: './'` の設定により、リポジトリー名のサブディレクトリーにも対応しています。公開URLは投稿文と結果画像に自動で入ります。追加のシークレット登録は不要です。[GitHub Pages のワークフロー設定](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

公開先リポジトリー: [cadmium2525/nira](https://github.com/cadmium2525/nira)。公開URL: [ニラ飛ばし](https://cadmium2525.github.io/nira/)。このURLは Pages のデプロイ成功後に利用できます。

## SNSへの共有

「記録をシェア」は、対応端末でOSの共有画面を開き、結果のPNG画像・投稿文・タグ・ゲームURLを渡します。共有先を選んで、SNS側で投稿を確定してください。Web Share API はHTTPS上で動作し、利用できる共有先や画像・文章の受け取り方は端末とSNSに依存します。[MDN: Navigator.share()](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share)

共有時は紹介文・飛距離・タグ・ゲームURLを一つの本文にまとめ、画像と一緒に渡します。iPhoneの共有先がURLだけを選んで本文を落とすことを避けるため、URLは独立した共有項目にしていません。実機のiPhone版Xでの反映は別途確認が必要です。

ファイル共有に対応しないブラウザーでは画像を保存し、可能な場合は投稿文もコピーします。常設の投稿文コピー・X投稿の補助ボタンは表示しません。SNSのログイン情報や投稿用APIキーはこのゲームでは扱いません。

## 主なファイル

| ファイル | 内容 |
| --- | --- |
| `src/main.ts` | 選択・投球・結果の進行とタッチ操作 |
| `src/scene.ts` | Three.js のニラ・舞台・コース・カメラ |
| `src/simulation.ts` | パワー・風・飛行・場外の判定 |
| `src/share.ts` | 結果PNG・投稿文・共有処理 |
| `public/nira-photo.jpg` | 結果カード用のニラ画像 |
| `.github/workflows/deploy.yml` | テストと GitHub Pages への公開 |

描画には [Three.js](https://threejs.org/) を使用しています。[公式ドキュメント](https://threejs.org/docs/)
