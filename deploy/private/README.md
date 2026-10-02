# 外部に公開しない運用（無料）

目的：**顧客・社員のデータが外に漏れない**こと。インターネットに公開せず、許可した人・端末だけが入れる形で、**追加費用なし**で運用します。

## なぜ AWS ではなくこの形か
AWS は常時稼働の構成（ロードバランサ・WAF・NAT など）が**毎月課金**で、「無料で管理」に合いません。このアプリは小規模のため、1台の常時稼働マシンと無料の閉域アクセスで、同等以上に閉じた構成にできます。AWS にする場合は、無料枠（新規アカウントの無料クレジット）が尽きたあと課金されます。

## 構成
```
社員の端末 ──(A: Tailscale の暗号化通信 / B: Cloudflare Access のメール認証)──▶ 常時稼働マシン（Docker）
                                                                 ├ 社内ポータル（127.0.0.1:3000）
                                                                 └ 営業CRM   （127.0.0.1:3001）
```
- **受信ポートを開けません**（ルーターのポート開放なし。コンテナは 127.0.0.1 のみ）。
- アプリ自身の認証（従業員番号 + PIN + 認証アプリ、5回失敗でロック、権限はサーバー側で強制）が**もう一段**あります。
- コンテナは権限最小（`cap_drop: ALL`、読み取り専用、`no-new-privileges`）。データは Docker ボリューム。バックアップは暗号化。

## 1. 動かすマシン（無料で用意する方法）
| 方法 | 費用 | メモ |
|---|---|---|
| 社内の常時起動PC / Mac | 0円 | 電源・スリープ設定を常時稼働に。自動ログイン不要 |
| Oracle Cloud「Always Free」VM | 0円（永久無料枠） | クレジットカード登録が必要。ARM 4コア/24GB まで無料。Ubuntu + Docker を入れる |

## 2. 起動
```bash
cd deploy/private
cp .env.example .env     # 初期PIN・秘密鍵（openssl rand -hex 32）を入れる
docker compose up -d --build
```
Mac / Windows では Docker Desktop を入れます（無料。従業員250人未満・売上10億円未満の会社は無償）。Docker を使わない場合は [`desktop/`](../../desktop/README.md) のランチャーでも動きます（この場合は 127.0.0.1 で起動し、下の A か B で公開）。

## 3. アクセス経路（どちらか）
### A) Tailscale — 無料・ドメイン不要（個人プランは3ユーザーまで）
1. 動かすマシンと各自の端末に Tailscale を入れ、同じアカウントでログイン（端末ごとに承認）。
2. 動かすマシンで：`tailscale serve --bg --https=443 http://127.0.0.1:3000`（ポータル）、`tailscale serve --bg --https=8443 http://127.0.0.1:3001`（CRM）。
3. 表示された `https://<マシン名>.<tailnet>.ts.net/` を開く。**Tailnet 外には見えません**（Funnel は使わない）。
4. 4人以上は Tailscale の有料プラン、または B を使います。

### B) Cloudflare Tunnel + Access — 50ユーザーまで無料（ドメインが必要）
1. ドメインを用意（Cloudflare Registrar は原価販売で年1,500円前後。**唯一の費用**）し、Cloudflare に追加。
2. Zero Trust → Networks → Tunnels でトンネルを作成し、トークンを `.env` の `CLOUDFLARE_TUNNEL_TOKEN` に。Public Hostname を `portal.<ドメイン>` → `http://portal:3000`、`crm.<ドメイン>` → `http://crm:3000`。
3. Zero Trust → Access → Applications で両ホスト名を登録し、ポリシーを「**許可する社員のメールアドレスのみ**」＋ ワンタイムPIN（または Google 認証）に。
4. `docker compose --profile cloudflare up -d`

## 4. 情報漏洩対策チェックリスト
- [ ] **GitHub リポジトリを非公開（Private）にする**（Settings → General → Danger Zone）。現在は公開で、コードと社長名などが誰でも読めます。履歴に実データを入れたことがあれば、そのデータは**漏えい済みとして扱い**、パスワード/PIN を変更する。
- [ ] GitHub Pages の公開を止める（Settings → Pages → Unpublish）。このブランチをマージすると、ポータル/CRM の公開ビルドは**行われなくなります**が、既に公開済みのページは手動で止める必要があります。
- [ ] 実データは**リポジトリに入れない**（`.env`・`data/`・名簿JSON・Excel）。
- [ ] 初期PINは全員が初回に変更。認証アプリ（TOTP）の登録を必須にする。
- [ ] `backup.sh` を毎日実行（暗号化。パスフレーズは別の場所に保管）。復元テストを一度行う。
- [ ] OS とDockerを定期更新（`docker compose pull && docker compose up -d --build`）。
- [ ] 退職者は従業員名簿の退職日を入れて即停止。端末紛失時は管理者がPINリセット。
- [ ] 画面共有・スクショの持ち出しはルールで管理（技術では防げません）。
