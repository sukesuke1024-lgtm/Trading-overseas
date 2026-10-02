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
