# H-LINK 荷物追跡（社内Webアプリ）

海上コンテナ・航空貨物・国内宅配（ヤマト／佐川／日本郵便）・国際宅配（EMS／DHL／UPS）を、番号を貼るだけで **1画面・同じ工程バー** で追跡する。React 19 + TypeScript + Vite。配色はポータルと同じ H-LINK（赤・黒・白）で、暗い表示にも対応。

**使い方（現場向け）は [`docs/MANUAL.md`](docs/MANUAL.md)。** 同じ内容がアプリ内の「使い方」にも表示される。

## 起動
```bash
cd tracker
npm install
npm run dev                                   # 開発（http://localhost:5173、/api は :8080 へ中継）
npm run build                                 # 本番ビルド → dist/
TRACK17_KEY=xxxx TRACKER_TOKEN=長い文字列 npm start   # 配信 + 追跡中継 → http://localhost:8080
npm test && npm run typecheck                 # ロジックのテスト / 型チェック
```
`npm start` は画面(`dist/`)と追跡の中継(`/api/track`)を同じ口で配信する。キーなしで起動すれば手入力モード。

## 構成
| パス | 役割 |
|---|---|
| `src/lib/core.js` | 番号の判別・検査数字・工程・アラート・CSV（UI非依存、テスト対象） |
| `src/lib/store.ts` | 荷物・設定の保存（ブラウザ内 localStorage）。移行・バックアップ記録 |
| `src/lib/api.ts` | 中継サーバー経由の更新 |
| `src/pages/` | ダッシュボード・荷物一覧・設定・使い方 |
| `src/components/` | 詳細パネル・登録フォーム・地図・表示部品 |
| `server/relay.cjs` | 依存なしの配信＋中継。17TRACK 連携、Bearer認証、`dist/` 外は配信しない |
| `docs/MANUAL.md` | 操作マニュアル（アプリ内の「使い方」の原本） |

## 追跡の接続状況
| 手段 | 状況 |
|---|---|
| 国内宅配・国際宅配 | 17TRACK 連携を実装。**模擬応答で確認済み、実APIでの検証は未実施** |
| 海上コンテナ・航空貨物 | 未接続（ShipsGo 等の契約後、`server/relay.cjs` の `PROVIDERS.sea / air` に追加）。それまでは手入力 |

## 方針と制約
- 荷物データはブラウザ内保存。複数人で共有する段階でサーバー保存（DB・ログイン・変更履歴）へ移行する。
- 追跡サービスに送るのは追跡番号だけ。APIキーはサーバーの環境変数にだけ置く。
- 社内LAN／VPN内で使う。インターネットへ直接公開しない。
