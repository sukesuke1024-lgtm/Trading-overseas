# H-LINK CRM — 海外営業の顧客 × 案件 × 活動 × Next Action

「次に誰へ、何をするか」を迷わせないための営業CRM（Phase 1：モックデータ版）。`CRM_ClaudeCode_Implementation_Brief`（実装ブリーフ）を設計制約として実装しています。題材は海外事業（日本産食品の輸出）で、サンプルの社名・氏名はすべて架空です。

## できること（Phase 1）

| 画面 | 内容 |
|---|---|
| ダッシュボード | 今日のタスク・期限超過・今週の商談・要フォロー案件・案件総額（加重）・ステージ別状況・今月の受注見込み・担当別状況・営業部のお知らせ・ポータルのお知らせ |
| パイプライン / 案件 / 顧客（Customer 360°）/ 担当者 / Task / 活動履歴 | 営業の基本。一覧のままインライン編集、ドラッグ移動、CSV、配信停止の切替 |
| **見積・粗利の自動計算** | 商品・数量・Incoterms・コストから、販売単価・粗利・損益分岐・為替の影響を自動計算（営業初心者向けのガイド付き）。案件の明細に反映 |
| **契約可否の判定フロー** | 決済条件（前払い／一部前払い／L/C／D/P／D/A・O/A）・保証会社（貿易保険）・信用調査・与信限度・規制・粗利・為替で自動分岐し、GO／条件付きGO／保留／撤退を判定。フロー図に経路を表示し、案件に記録 |
| **為替・為替予約** | 現在レート（ECB 参考レート）・TTS/TTB の目安・60日推移・予約レートの試算・為替予約の登録／評価損益／案件ごとのカバー状況 |
| **商品カタログ（電子）** | 日英のカタログ。単一ファイルの電子カタログ（HTML）、電子チラシ（A4・PDF保存）。仕入原価は社外向け資料に出さない |
| **メール配信・チラシ** | 宛先の絞り込み（配信停止は自動除外）→ 電子チラシを本文に挿入 → プレビュー → 送信（メールソフト／コピー／CSV／Webhook）。宛先ごとに活動履歴へ自動記録 |
| **売上と仕訳** | カタログ → 案件の明細 → 売上 → 仕訳の金額を一致させ、照合。入金登録（銀行手数料・為替差損益）、再計上、仕訳CSV（社内ポータルの勘定科目コード） |
| **営業部のお知らせ** | 営業部（従業員名簿の部署）と Manager 以上だけに表示。公式URLの添付が必須 |
| **困った時は（逆引き辞典）** | 25の困りごとを言葉で検索。手順・避けること・相談先・関連画面 |
| 設定 | **従業員名簿**（社内ポータルと一致。「CRM用に書き出し」を取込）、3ロールの権限、営業ステージ、監査ログ |
| 共通 | H-LINK ロゴ／ブランド配色、ログイン画面、`Ctrl/⌘+K` 検索、`N` で活動記録、ダークテーマ |

設計判断（ステージを6段階に統合、最終接触・次回予定・Next Action を導出、明細単価の固定、など）は [`docs/`](docs) の設計書にまとめています。

## 2つの動かし方（社内ポータルと同じ）

| モード | 認証 | データ | 用途 |
|---|---|---|---|
| **デモ（static）** | ユーザーを選ぶだけ（確認コードは画面表示） | 各端末のブラウザ内 | GitHub Pages `/crm/` で公開・見せる用 |
| **サーバー（server）** | 従業員番号 + PIN（scrypt）+ 認証アプリ（TOTP）。5回失敗で15分ロック、12時間セッション、PIN変更・管理者リセットで他端末を失効 | サーバー上の `db.json`（全員で共有）。資料ファイルもサーバーに保存 | 社内で実際に使う |

サーバー版は、**権限をサーバー側でも強制**します（`src/server/ops.ts`）。Sales は自分の担当の顧客・案件・Task・活動だけ変更でき、他人の分・名簿・与信方針・承認は変更できません（Sales には仕入原価・売上・仕訳をそもそも配信しません）。操作は「変更されたレコードだけ」を送るため、同時に別のレコードを編集しても上書きし合いません（10秒ごとに他の人の変更を取り込みます）。監査ログの操作者はサーバーが確定します。

```bash
cd crm
npm install
npm run build:server
CRM_INITIAL_PIN=<初期PIN> npm run serve     # 画面・API の起動と、公的情報の毎時の自動更新（LAN内の端末からも開けます）
```

1. 表示されたURLをブラウザで開く。従業員番号（社長は `001`）と初期PIN（既定 `000000`。`CRM_INITIAL_PIN` で変更）でログイン
2. 初回のみ、QR を認証アプリ（Google/Microsoft Authenticator 等）で読み取り、6桁コードを入力
3. 続けて、自分のPIN（4〜8桁）に変更
4. Admin が「設定 → 従業員名簿」でポータルの `hlink-roster.json` を取り込む（全員のログインアカウントが作られます）。PINを忘れた・端末を紛失した人は、Admin が「PINをリセット」

| 環境変数 | 内容 |
|---|---|
| `CRM_DATA_DIR` | データ保存先（既定 `./data`）。**毎日バックアップ**してください（`db.json`・`files/`・`authlog.jsonl`・`secret.key`） |
| `CRM_INITIAL_PIN` | 初期PIN（初回ログイン時に必ず変更） |
| `CRM_SESSION_SECRET` | セッション署名・認証アプリ秘密鍵の暗号化に使う鍵（未設定時は `secret.key` を自動生成） |
| `CRM_SEED` | `demo` にすると、サンプルデータ入りで初期化（既定は名簿と与信方針だけの空の状態） |
| `CRM_REFRESH_MINUTES` | 公的情報の更新間隔（既定60分。0で停止） |

コンテナ：`docker build -f Dockerfile.server -t hlink-crm-server . && docker run -d -p 3000:3000 -v hlink-crm-data:/data hlink-crm-server`（タグ `crm-v*` を付けると、GitHub Actions が `ghcr.io/<owner>/hlink-crm` に公開します）。
**社内ネットワーク（またはVPN）内で使い、インターネットへ直接公開しないでください。** https はリバースプロキシで。メール配信の Webhook 送信は、サーバー版では外部接続を許可していないため使えません（`.eml` 下書きは使えます）。

## 社内ポータルとの関係・別URL

- **従業員名簿**：CRM のユーザーは、H-LINK 社内ポータルの従業員名簿と同じ番号・氏名・部署（権限：管理者→Admin／役員→Manager／従業員→Sales）。ポータルの「従業員・権限」→「CRM用に書き出し」で作った `hlink-roster.json` を、CRM の「設定 → 従業員名簿」で取り込みます。
- **別のURL**：
  - 同じ公開サイトの別パス `/crm/`（`.github/workflows/lp.yml` が `/portal/` と一緒に公開）
  - 独自ドメイン：`docker build -t hlink-crm --build-arg NEXT_PUBLIC_PORTAL_URL=https://portal.example.co.jp/ .`（nginx。`deploy/nginx.conf`）
  - 専用リポジトリ + GitHub Pages：`deploy/pages-standalone.yml`
  - ポータルへのリンクは `NEXT_PUBLIC_PORTAL_URL`（未設定時は `../portal/`）。保存キーは `hlink-crm.*` で、ポータルとは共有しません。

## マニュアル・設計書

| ファイル | 内容 |
|---|---|
| [`docs/H-LINK-CRM_操作マニュアル.docx`](docs/H-LINK-CRM_操作マニュアル.docx) / `.pdf` | 操作マニュアル（Word は編集可。付録に判定フロー全質問・逆引き辞典の一覧） |
| [`docs/H-LINK-CRM_設計書.docx`](docs/H-LINK-CRM_設計書.docx) / `.pdf` | 設計レビュー・追加要件の設計・画面一覧・ER・権限・セキュリティ・開発順序 |

アプリ内の「マニュアル」画面からもダウンロードできます（`public/docs/`）。文面は `scripts/docs-content.mjs`（判定フローと辞典の付録は `src/lib` から自動生成）を編集して `npm run docs`（`docx` パッケージと LibreOffice Writer が必要）。

## 起動

```bash
npm install
npm run dev          # http://localhost:3000
npm run build:static # 静的書き出し（out/）。NEXT_PUBLIC_BASE_PATH でサブパス指定
npm test             # 粗利計算・仕訳・照合・判定フロー・名簿・為替の自動テスト
```

デモのデータはブラウザの localStorage に保存されます（「設定 → データ」で初期化）。データ操作はすべて `src/lib/store.ts` に集約しており、本番化（Supabase / PostgreSQL + RLS + Supabase Auth）では同じ関数名のまま差し替えます。

## 構成

```
src/lib/        types / constants / seed（デモデータ）/ store（状態・永続化・監査）/ selectors（導出）
                calc（見積）/ flow（判定）/ fx（為替）/ journal（売上・仕訳）/ roster（名簿）/ flyer（カタログ・チラシ）/ help（辞典）
src/components/ Shell（サイドバー・検索）/ QuickLog / forms / Timeline / ui
src/app/        各画面（顧客・案件の詳細は /customers/view/?id= など。静的書き出しのためクエリで指定）
docs/           マニュアル・設計書（.docx / .pdf）と図
```

## 次の段階

DB 実装 → 認証・権限（RLS）→ API 接続 → テスト → 本番運用（設計書 §開発順序）。
