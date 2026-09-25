# 海外バイヤー・海外営業 採用LP

90秒の採用動画（`../recruit-video/`）を組み込んだ採用ランディングページです。日本語・英語・簡体中文の3言語で、静的サイトとしてGitHub Pagesなどにそのまま公開できます。

| | |
|---|---|
| 言語 | 日本語 `/`・English `/en/`・简体中文 `/zh/` |
| 構成 | ファーストビュー → 職種の定義 → 紹介動画（3言語字幕・書き起こし付き）→ 仕事内容 → 1日の流れ → 身につく力 → 募集要項・選考の流れ → よくある質問 → エントリー |
| 公開方法 | GitHub Actionsでテストしてから、GitHub Pagesへ自動公開 |
| テスト | 自動チェック123項目（SEO・構造化データ・リンク切れ・7種類の画面幅・アクセシビリティ WCAG 2.1 AA） |

## 画面イメージ

| | PC | スマートフォン |
|---|---|---|
| 日本語 | [ファーストビュー](screenshots/ja-pc-firstview.jpg)・[全体](screenshots/ja-pc-full.jpg) | [ファーストビュー](screenshots/ja-sp-firstview.jpg)・[全体](screenshots/ja-sp-full.jpg) |
| English | [First view](screenshots/en-pc-firstview.jpg)・[Full](screenshots/en-pc-full.jpg) | [First view](screenshots/en-sp-firstview.jpg)・[Full](screenshots/en-sp-full.jpg) |
| 简体中文 | [首屏](screenshots/zh-pc-firstview.jpg)・[全页](screenshots/zh-pc-full.jpg) | [首屏](screenshots/zh-sp-firstview.jpg)・[全页](screenshots/zh-sp-full.jpg) |

## 公開前にお願いしたいこと

`npm run check` を実行すると、未設定の項目が一覧で表示されます。

1. **`site.config.mjs` を設定する**
   - `company.name`: 会社名（言語別）。ヘッダー、フッター、タイトル、構造化データに反映されます。
   - `company.url`: 企業サイトのURL。
   - `entryUrl`: 応募フォームや採用管理システムのURL（`mailto:` も可）。未設定の間は、エントリー欄に「準備中」と表示されます。
   - `privacyUrl`: プライバシーポリシーのURL。
   - `jobPosting`: 勤務地の住所を入れて `enabled: true` にすると、Googleしごと検索向けの求人データ（JobPosting）が出力されます。
2. **募集要項を実際の条件にする**
   - `src/content/{ja,en,zh}.mjs` の `requirements` のうち、`todo: true` の行が対象です（雇用形態・勤務地・給与・勤務時間・休日・応募資格）。
   - 条件を確定したら `todo: true` を消してください。
3. **FAQの「海外出張」「オンライン面接」の回答を、実際の運用と合っているか確認する**

## GitHub Pagesで公開する

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。
2. `main`（または作業ブランチ）にpushすると、テストに通ったあと自動で公開されます。Actionsタブの「Recruitment LP」からも手動で実行できます。
3. 独自ドメインで公開する場合は、**Settings → Secrets and variables → Actions → Variables** に次の2つを追加します。
   - `SITE_URL`: 例 `https://recruit.example.co.jp/`
   - `CNAME`: 例 `recruit.example.co.jp`

   その後、DNSとPagesのCustom domainを設定してください。canonical、hreflang、sitemap、OGPのURLはすべてこの値から作られます。

> `https://<user>.github.io/<repo>/` のようなサブパスで公開すると、`robots.txt` と `llms.txt` がドメイン直下に置かれず、クローラーに読まれません。本番公開では独自ドメイン（またはサブドメイン）をおすすめします。

公開後は、Google Search Console と Bing Webmaster Tools に `sitemap.xml` を登録してください。

## 対策内容

### SEO
- **ページ情報**: 言語ごとに title、meta description、canonical、hreflang（ja / en / zh-Hans / x-default）を設定。
- **見出し**: h1は1つだけにして、見出しの階層を飛ばさない。
- **構造化データ（JSON-LD）**: WebSite、WebPage、BreadcrumbList、Occupation（職種）、VideoObject、FAQPage。会社情報を設定すると Organization と JobPosting も出力。
- **sitemap.xml**: hreflangの相互リンクと動画情報を含む。
- **SNS共有**: 言語別のOGP画像（1200×630）と Twitter Card。
- **表示速度**: 外部フォントもJSライブラリも使わない。CSS約19KB・JS約2KB。動画は `preload="none"` でポスター画像を表示。

### AIO（AI検索・生成AIへの最適化）
- 「海外バイヤーとは」「海外営業とは」を短い定義文で書き、そのまま引用されやすい形にしている。
- FAQをページ本文と構造化データの両方に同じ内容で掲載。
- 動画の内容をHTMLの書き起こしと VideoObject の transcript でテキスト化し、AIが動画の中身を読めるようにしている。
- `llms.txt`: AIアシスタント向けのサイト要約（職種の定義・仕事の流れ・FAQ）。
- `robots.txt`: 主要なAIクローラー（GPTBot、ClaudeBot、PerplexityBot、Google-Extendedなど）のアクセスを明示的に許可。
- 最終更新日をページと構造化データに表示。

### レスポンシブ
- スマホ優先の設計。表示崩れと横スクロールがないことを、7種類の画面幅（320px〜1920px）で自動テストしている。
- 1200px未満はハンバーガーメニュー。スマホでは画面下にエントリーボタンを固定表示。
- iPhoneのノッチ（safe-area）、印刷、「視差効果を減らす」設定（prefers-reduced-motion）に対応。

### 多言語
- 日本語・英語・簡体中文。言語ごとにURLを分けている（自動リダイレクトはしない）。
- 言語切り替えはヘッダーとフッターの両方に配置。
- 動画字幕（WebVTT）は3言語。英語・中国語のページでは、その言語の字幕が最初からオンになる。
- 言語を追加するには、`src/content/` に言語ファイルを追加し、`site.config.mjs` の `languages` に1行追加します。

### アクセシビリティ
- axe-core で WCAG 2.1 AA の違反ゼロ。
- スキップリンク、キーボード操作、Escキーでメニューを閉じる、フォーカスの表示、文字色のコントラスト比AA。

## 開発

```bash
cd lp
npm ci                      # 初回のみ
npm run build               # dist/ を生成
npm test                    # ビルドと自動テスト
SCREENSHOTS=1 npm test      # screenshots/ の画像も更新
npm run check               # 公開前の未設定項目を一覧表示
npm run images              # OGP画像・アイコンを作り直す（見出しを変えたとき）
npm run preview             # http://localhost:4173 で確認
```

| パス | 内容 |
|---|---|
| `site.config.mjs` | 会社名・URL・応募先・求人の構造化データ・言語の設定 |
| `src/content/*.mjs` | 各言語の文章（ページ本文・FAQ・募集要項・動画字幕） |
| `src/template.mjs` | HTMLテンプレート |
| `src/assets/` | CSS・JavaScript |
| `static/` | favicon、アイコン、OGP画像 |
| `build.mjs` | HTML・sitemap・robots.txt・llms.txt・字幕・404ページを生成 |
| `test/site.test.mjs` | 自動テスト |
