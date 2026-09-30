# H-LINK 公式サイト

食品専門商社 **H-LINK** の公式サイト（リニューアル版）。旧サイト「Hokkaido Food Bridge」（黒基調の単一HTML）を、ブランドボードと *H-LINK Official Website Build Specification* に沿って作り直したものです。

| | |
|---|---|
| 構成 | HOME / BUSINESS / PRODUCERS / BUYERS / H-LINK SELECTION / SUSTAINABILITY / ABOUT / NEWS（一覧＋記事テンプレート）/ CONTACT / Privacy / Terms / EN（概要） |
| 技術 | 依存ゼロの静的サイト（Node.js 20+ のビルドスクリプト＋素のCSS/JS）。仕様書の「より簡単な構成でよい」に従い、Next.js等は使っていません |
| デザイン | 白／ウォームグレー／ベージュ基調、明朝見出し×ゴシック本文、赤（#D71920）は最小限のアクセント。ヒーローに赤いブリッジラインが一度だけ描かれる |
| 品質 | WCAG AA（axe自動検査）、prefers-reduced-motion対応、375/768/1440pxで横スクロールなし、JSON-LD（Organization / Breadcrumb / Article / FAQ）、sitemap/robots/OGP |

## セットアップ

```bash
cd h-link
npm install          # テスト用（playwright, axe-core）のみ。サイト本体は依存なし
npm run build        # dist/ に出力
npm run preview      # ビルドして http://localhost:4173 で確認
npm test             # ビルド＋自動チェック（禁止表現・リンク切れ・alt・見出し・ブラウザ検査）
npm run assets       # ロゴSVG・ファビコン・OGP画像を再生成（Chromium必要）
```

## コンテンツの編集（`content/` に集約）

| ファイル | 内容 |
|---|---|
| `site.mjs` | サイト名・URL・会社概要・SNS・フォーム送信先 |
| `navigation.mjs` | ナビ・フッター |
| `services.mjs` | 4つの柱・生産者/バイヤー向け・フロー・取引形態・ロードマップ・**実績数値（`proof`）** |
| `regions.mjs` | 地域（北海道＝START、他は「展開予定」） |
| `selection.mjs` / `sustainability.mjs` / `stories.mjs` / `faq.mjs` / `forms.mjs` / `en.mjs` | 各ページの内容 |
| `images.mjs` | 画像スロット定義 |

- **実績数値**：`proof` の `value` に数値を入れると自動で表示（`null` の間は COMING SOON）。
- **ESG／SDGsのステータス**：`current`（取り組み中）／`planned`（計画中）／`target`（将来目標）。事実に合わせて更新してください。
- **記事**：`stories.mjs` に追加（`sample: true` を消すと公開扱い）。

## 画像の差し替え（コード変更なし）

`static/images/<スロットID>.jpg`（`.webp` `.avif` `.png` も可）を置いてビルドするだけで、プレースホルダーが自動で置き換わります。ヒーローは `hero-landscape`（`hero-producer` `hero-food` `hero-logistics` があれば自動でクロスフェード）。

必要な画像スロット：`hero-landscape` `producer-portrait` `farm-field` `fishery` `processing` `buyer-meeting` `hotel-restaurant` `retail-shelf` `logistics` `sports-support` `food-education` `esg-environment` `exhibition` `packaging` `product-detail`（一覧は `content/images.mjs`）。本番では `showSlotLabels: false` に。

## フォーム

4種類（生産者／バイヤー／取材・協業／その他）。入力→詳細（任意）→確認→完了の流れ、必須チェック、同意チェック、ハニーポット＋送信時間チェックによるスパム対策を実装済みです。
**送信先が未設定の間は、送信されません**（完了画面に「テスト表示」と出ます）。Formspree等のPOST可能なURLを `FORM_ENDPOINT` 環境変数（または `content/site.mjs`）に設定してください。ファイル添付を受け付けるかは送信先サービスの仕様に依存します。

## 公開

```bash
SITE_URL=https://www.example.co.jp BASE_PATH=/ FORM_ENDPOINT=https://... npm run build
```
`dist/` をGitHub Pages・Vercel・Netlify等の静的ホスティングに置けば公開できます（サブパス公開は `BASE_PATH=/repo/`）。`.github/workflows/h-link.yml` でPush時にテストします。

## 公開前に必要な実データ（未確認のため空欄・「準備中」にしています）

- 会社概要（所在地・代表者・設立・資本金・許認可）／代表メッセージ
- 連絡先メール、SNSのURL、フォーム送信先
- 実績数値（取引生産者数・バイヤー数・地域数・リピート率・取扱い商品数）
- 選定商品（H-LINK SELECTION）と、「H-LINK SELECTED」表示の運用方針
- SDGsのKPI、各取り組みの実際のステータス、費用・料率・回答目安
- 記事（現在の3本はサンプル・noindex）、プライバシーポリシー／ご利用にあたって（**ひな形。法務確認が必要**）
- 上記の画像素材、本番のロゴデータ（現在のロゴはブランドボードから起こしたSVG再現です）

> 仕様書の方針どおり、事業実績・取引先・認証・受賞・輸出先は一切創作していません。「Hokkaido Food Link」「From Local to Global」は出力に含まれないことをテストで保証しています。
