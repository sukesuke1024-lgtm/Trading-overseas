# Mac / Windows で動かす（社内ポータル + 営業CRM）

どちらも Web アプリです。このフォルダのランチャーで、**1回のダブルクリック**でポータルと CRM を同時に起動し、ブラウザを開きます。

## 必要なもの
[Node.js](https://nodejs.org/) 20 以上（LTS）。Mac・Windows とも同じです。

## 起動
| OS | 操作 |
|---|---|
| **Mac** | `H-LINK起動.command` をダブルクリック（初回は 右クリック →「開く」） |
| **Windows** | `H-LINK-start.bat` をダブルクリック |
| 共通（ターミナル） | `node desktop/launch.mjs` |

初回だけ、依存の取得とビルドで数分かかります。以後は数秒で起動します。

- 社内ポータル: http://localhost:3000 / 営業CRM: http://localhost:3001
- 同じネットワークの他の端末（スマホ等）からも開く: `--lan` を付ける（例 `node desktop/launch.mjs --lan`）。社内LAN/VPN内だけで使い、インターネットへ直接公開しないでください。
- 更新後に作り直す: `--rebuild`。ブラウザを自動で開かない: `--no-open`。
- 終了: ウィンドウで Ctrl+C（またはウィンドウを閉じる）。

## データ
保存先は `~/H-LINK-data/`（Windows: `C:\Users\<名前>\H-LINK-data\`）。ソースを更新しても消えません。**毎日バックアップ**してください。`HLINK_DATA_DIR` で変更できます。

## 初回ログイン
従業員番号（社長は `001`）+ 初期PIN `000000` → 認証アプリ（Google/Microsoft Authenticator）で QR を登録 → 自分のPINに変更。
CRM のユーザーは、ポータルの「従業員・権限 → CRM用に書き出し」で作った名簿を、CRM の「設定 → 従業員名簿」で取り込むと作られます。

## 複数人で使う
1台のPC（または社内サーバー）で `--lan` 起動し、各自のブラウザから開きます。常時稼働は Docker（`portal/Dockerfile`、`crm/Dockerfile.server`）が向いています。
- アイコン一式（Mac .icns / Windows .ico / iOS / Android / ファビコン）: 公開URLの `/portal/brand/icons.html`・`/crm/brand/icons.html`、または `public/brand/H-LINK-icons.zip`。ロゴは加工せず、ポータルとCRMは同一ファイル（`cd portal && npm run icons` で両方を同期。テストで不一致を検出）。
