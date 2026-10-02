# AITREK CRM — 海外営業の顧客 × 案件 × 活動 × Next Action

「次に誰へ、何をするか」を迷わせないための営業CRM（Phase 1：モックデータ版）。`CRM_ClaudeCode_Implementation_Brief`（実装ブリーフ）を設計制約として実装しています。題材は海外事業（日本産食品の輸出）で、サンプルの社名・氏名はすべて架空です。

## できること（Phase 1）

| 画面 | 内容 |
|---|---|
| ダッシュボード | 今日のタスク・期限超過・今週の商談・要フォロー案件・案件総額（加重）・ステージ別状況・今月の受注見込み・担当別状況・社内ポータルのお知らせ |
| パイプライン | 9列のカンバン（ドラッグ＆ドロップ／スマホはメニュー）。カードに顧客・金額・担当・Next Action・期限 |
| 案件 | 一覧のままステージ・予定受注日・Next Action を編集、並べ替え・絞り込み・CSV。詳細画面でステージバー／Next Action／活動履歴 |
| 顧客 / Customer 360° | 会社・担当者・進行案件・過去案件・Task・活動タイムライン・メモを1画面に集約 |
| 担当者 | 横断検索、主要連絡先・意思決定者のワンクリック切替 |
| Task / Next Action | 期限超過／今日／今週／以降、Next Action 未設定案件の警告 |
| 活動履歴 | チーム全体のタイムライン |
| 設定・監査ログ | 3ロール（Admin / Manager / Sales）と権限マトリクス、操作履歴 |
| 共通 | ログイン／パスワード再設定画面（モック）、`Ctrl/⌘+K` 検索、`N` で活動記録、ダークテーマ |

設計判断（ステージを6段階に統合、最終接触・次回予定・Next Action を入力させず導出、など）は [`docs/`](docs) の設計書にまとめています。

## マニュアル・設計書

| ファイル | 内容 |
|---|---|
| [`docs/AITREK-CRM_操作マニュアル.docx`](docs/AITREK-CRM_操作マニュアル.docx) / `.pdf` | 操作マニュアル（Word は編集可） |
| [`docs/AITREK-CRM_設計書.docx`](docs/AITREK-CRM_設計書.docx) / `.pdf` | 設計レビュー・画面一覧・Customer 360°/Pipeline 設計・ER・権限・セキュリティ・開発順序 |

アプリ内の「マニュアル」画面からもダウンロードできます（`public/docs/`）。文面を変更するときは `scripts/docs-content.mjs` を編集して `npm run docs`（`docx` パッケージと LibreOffice Writer が必要）。

## 起動

```bash
npm install
npm run dev          # http://localhost:3000
npm run build:static # 静的書き出し（out/）。NEXT_PUBLIC_BASE_PATH でサブパス指定
```

デモのデータはブラウザの localStorage に保存されます（「設定 → データ」で初期化）。データ操作はすべて `src/lib/store.ts` に集約しており、本番化（Supabase / PostgreSQL + RLS + Supabase Auth）では同じ関数名のまま差し替えます。

## 構成

```
src/lib/        types / constants（ステージ・為替）/ seed（デモデータ）/ store（状態・永続化・監査）/ selectors（導出）
src/components/ Shell（サイドバー・検索）/ QuickLog / forms / Timeline / ui
src/app/        各画面（顧客・案件の詳細は /customers/view/?id= など。静的書き出しのためクエリで指定）
docs/           マニュアル・設計書（.docx / .pdf）と図
```

## 次の段階

DB 実装 → 認証・権限（RLS）→ API 接続 → テスト → 本番運用（設計書 §開発順序）。
