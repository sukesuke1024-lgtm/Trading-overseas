# AITREK OS — 事業運営システム

AITREK の海外輸出・海外営業事業を少人数・AI中心で運営するための社内業務システム（貿易会社OS）です。

```
生産者 → 商品 → 海外バイヤー → 商談 → 見積 → 輸出 → 書類 → 入金 → 利益 → リピート
```

を 1 つの Web アプリで管理し、Dashboard で「今どの案件が・どこで止まり・次に何をすべきか」を把握できます。

## 画面

| メニュー | 内容 |
|---|---|
| Dashboard | 今月売上・粗利・粗利率、商談件数、新規Lead、見積提出数、Sample発送数、成約件数、Shipment数、未入金額、今週/期限超過Task、国別・カテゴリー別案件数、Deal Pipeline、最新Activity、要対応案件（止まっている理由と次の一手）、Payment Alert |
| Producers | 生産者CRM（仕様書②の全項目）、商品・Deal・Activity の紐付け |
| Buyers | 海外バイヤーCRM（仕様書③）、電話番号/Email/Webドメインから国・通貨を自動設定、商品Matching |
| Products | 商品DB（仕様書④）、Producer 必須紐付け、多言語説明 |
| Deals | 13ステージの Kanban（ドラッグ&ドロップ／スマホはセレクト）、Deal詳細（仕様書5の一画面表示） |
| Export | Export Cost Simulator（Incoterms 別の負担範囲・多通貨）、Export Checklist、商品×輸出国の事前確認 |
| Quotations | Deal の原価計算から見積を自動作成、PDF出力 |
| Documents | PI / CI / Packing List / PO / Sales Confirmation / SI / Spec Sheet / Origin Info / Sample Request / Contract を登録データから生成、PDF出力 |
| Finance | 売上・原価・粗利・請求・入金・為替・Producer/Logistics支払・AITREK Revenue、入金期限超過アラート |
| Tasks | Checklist・自動Follow-up・個別Taskの横断管理（担当・期限・Status・Note・添付） |
| Marketing | AI Workspace（Weekly Report 等）、Buyer Outreach、多言語商品Catalog |
| Settings | 会社情報（書類に印字）、為替レート、ユーザー・Role、権限マトリクス、バックアップ |

PDF 出力はブラウザの印刷機能（「PDFに保存」）を使います。書類は A4 レイアウトで、アプリの枠は印刷されません。

## 自動化（仕様書 6）

| トリガー | 自動処理 |
|---|---|
| Deal 作成 | 「商品 × 輸出国」で Export Checklist を生成（国別の当局登録・ラベル要件、冷凍/冷蔵・水産・畜産・農産・酒類などの追加項目を含む）。原価計算の初期値（商品原価・手数料率・為替）を設定 |
| Status 変更 | Activity Log に記録、確度を更新 |
| Quotation 作成 | Deal 履歴に保存、Checklist「見積作成」を完了 |
| Sample へ移動 | Follow-up Task（7日後）を生成 |
| Contract / Order へ移動 | Owner/Admin の契約承認を記録し、Finance レコードを作成 |
| Checklist「Shipment」完了 / Payment へ移動 | Payment確認 Task を生成 |
| 入金済 | Repeat営業 Task（30日後）を生成 |
| 期限接近・超過 / 入金期限超過 | ヘッダーのアラートと Dashboard に表示 |
| Buyer 登録 | 国・通貨を自動設定 |
| Product 登録 | Producer と紐付け、カテゴリー・保存方法・認証を Producer から補完 |

## 権限（仕様書 8）

Role：Owner / Admin / Sales / Trade Operations / Finance / Marketing / Viewer / AI Agent。

契約承認・Price変更（価格承認・見積単価の変更）・Payment（入金確定・支払額変更）・Buyer削除・Producer削除・User追加は **Owner / Admin のみ**。AI Agent は下書きの作成・更新のみで、確定操作はできません。画面側の制御に加え、Supabase 利用時は RLS（`supabase/schema.sql`）で削除・ユーザー管理・設定変更を DB 側でも制限します。

## AI（仕様書 7）

営業Email、Follow-up、Buyer向け商品提案、商談要約、Meeting Note要約、Next Action提案、見積作成補助、Checklist候補生成、商品説明翻訳（英・中・韓）、市場調査メモ、Weekly Business Report。

- `ANTHROPIC_API_KEY` を設定すると Claude（既定 `claude-opus-5`、`AITREK_AI_MODEL` で変更可）で生成します。安全分類器で拒否された場合はサーバー側で自動的に代替モデルへ切り替えます（server-side fallback）。
- 未設定の場合は登録データを差し込んだテンプレートで下書きを作ります。
- 出力はすべて下書きです。契約締結・金銭支払・値決めの最終承認・法務/税務判断・規制適合の最終判断は AI が確定しないよう、プロンプトと権限の両方で制限しています。

## 起動

```bash
cd aitrek-os
npm install
npm run dev   # http://localhost:3000
```

Supabase を設定していない場合は **ローカルモード** で動作します。データはブラウザの localStorage に保存され、初回はサンプルデータ（架空の生産者・バイヤー・案件）が入ります。Settings からユーザー（Role）を切り替えて権限の動作を確認できます。

## 本番運用（Supabase + Vercel）

1. Supabase でプロジェクトを作成し、SQL Editor で `supabase/schema.sql` を実行（テーブル・RLS・Storage バケット `attachments` を作成）
2. Authentication でメール認証を有効化
3. `.env.example` を参考に環境変数を設定
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`（任意）
4. Vercel にこのディレクトリ（Root Directory: `aitrek-os`）をデプロイ。独自ドメイン例：`app.aitrek.jp`
5. 最初にログインしたユーザーが Owner になります。以降のメンバーは Settings で Email と Role を登録してから、その Email でログインしてもらいます（未登録の Email は Viewer として登録されます）

## 構成

```
src/
  app/                 各画面（App Router）と /api/ai
  components/          UI 部品（Kanban, 原価計算, Checklist, 書類プレビュー, AI パネル …）
  lib/
    types.ts           ドメインモデル（DB カラムと同名）
    automation.ts      自動化ルール
    cost.ts            輸出原価・利益計算（Incoterms 別の負担範囲）
    checklist.ts       Export Checklist テンプレート（国別・商品別）
    documents.ts       書類生成
    permissions.ts     Role × 操作の権限
    ai.ts              AI プロンプトとテンプレート
    store/             データ層（ローカル / Supabase を同じ API で切替）
supabase/schema.sql    DB スキーマ・RLS
```

技術スタック：Next.js 16（App Router）/ TypeScript / Tailwind CSS 4 / Supabase（PostgreSQL・Auth・Storage）/ Vercel。

## 今後（Phase 3–4）

Email 連携、物流 Tracking、Buyer Portal / Producer Portal、AI Agent の自動運用。データ層は `Adapter` と `Tx` に集約しているため、Portal や Agent からの書き込みも同じ自動化ルールを通せます。
