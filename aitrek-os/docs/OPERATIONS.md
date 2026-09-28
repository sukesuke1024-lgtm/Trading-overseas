# AITREK OS 運用手順（個人利用）

## 全体像

```
[アプリ] 不具合を自動検知 / 手動報告 ──▶ GitHub Issue（label: bug）
                                              │
                          毎晩 1:00頃 Claude が調査し修正案 PR を作成（label: fix-proposal）
                                              │   ※ 本番には反映しない
                     あなたが内容を確認し、PR に `approved` ラベルを付ける ＝ 許可
                                              │
                          毎晩 2:00  Nightly release（GitHub Actions）
                              ・承認済み・CI 成功・競合なしの PR だけをマージ
                              ・更新履歴とバージョンを記録
                              ・再検証（lint / 型 / ビルド）に成功したら production ブランチを更新
                                              │
                                   Vercel が production を本番へデプロイ
                                              │
                     各端末：次回起動時、または「更新」ボタンで新バージョンに切替
```

**あなたが `approved` を付けない限り、本番は一切変わりません。** 承認後にコミットが追加された PR も反映されません（付け直しが必要）。

## 初期設定（1 回だけ）

### 1. Supabase

1. https://supabase.com でプロジェクトを作成（リージョン：Tokyo）
2. SQL Editor で `aitrek-os/supabase/schema.sql` を全文実行
3. Authentication → Sign In / Providers → Email を有効化
4. Project Settings → API から `Project URL` と `anon public` キーを控える

### 2. Vercel

1. https://vercel.com で GitHub の `Trading-overseas` をインポート
2. **Root Directory**：`aitrek-os`
3. **Environment Variables**

| 変数 | 内容 | 必須 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL | ✔ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon public キー | ✔ |
| `GITHUB_REPORT_TOKEN` | 不具合報告用。GitHub → Settings → Developer settings → Fine-grained tokens で、このリポジトリのみ・**Issues: Read and write のみ**を許可して発行 | 推奨 |
| `GITHUB_REPO` | `sukesuke1024-lgtm/Trading-overseas` | 推奨 |
| `ANTHROPIC_API_KEY` | AI 下書きを Claude で作る場合 | 任意 |

4. Settings → Environments → Production → **Branch Tracking を `production` に変更**（夜間更新でのみ本番が変わるようにする）
5. Settings → Domains で `app.aitrek.jp` などを割り当て
6. GitHub の Actions → **Nightly release (AITREK OS)** → Run workflow を 1 回実行し、`production` ブランチを作成（以降は毎晩自動）

### 3. 最初のログイン（個人利用の設定）

1. 公開された URL を開き、あなたのメールアドレスでログイン → 自動で **Owner** になります
2. その後 Supabase → Authentication → Sign In / Providers で **「Allow new users to sign up」を OFF**
   - 他人がアカウントを作れなくなります。万一ログインできても、メンバー登録されていない人はデータベース側で拒否されます
3. 将来ほかの人を追加する場合：Settings → ユーザー で Email と Role を登録し、Supabase の Authentication → Users → Invite で招待

## 各端末へのインストール

| 端末 | 手順 |
|---|---|
| iPhone / iPad | Safari で開く → 共有ボタン → 「ホーム画面に追加」 |
| Android | Chrome で開く → メニュー → 「アプリをインストール」 |
| Windows / Mac | Chrome / Edge で開く → アドレスバー右のインストールアイコン |

データは Supabase に保存されるため、どの端末でも同じ内容が表示されます。画面は PC・タブレット・スマホの幅に合わせて自動で切り替わります。

## 毎日の確認（承認のしかた）

1. GitHub アプリ（スマホ可）で **Pull requests → ラベル `fix-proposal`** を開く
   （アプリ内 Settings →「承認待ちの修正案」からも開けます）
2. 本文の「原因・修正内容・影響範囲・確認すべき点」を読む
3. 反映してよければ、右側 Labels から **`approved`** を付ける
4. その夜 2:00 に反映され、結果が PR にコメントされます。反映しない場合は PR を Close

## 緊急時

- **すぐ反映したい**：Actions → Nightly release → Run workflow（承認済みのものだけが対象）
- **更新を取り消したい**：
  1. 即時：Vercel → Deployments で 1 つ前のデプロイを選び「Promote to Production」
  2. 恒久：GitHub で該当 PR の「Revert」→ できた PR に `approved` を付ける（その夜に反映）
- **夜間更新を止めたい**：Actions → Nightly release → 「…」→ Disable workflow

## 履歴の管理

| 種類 | 場所 |
|---|---|
| データの訂正履歴（誰が・いつ・どの項目を・何から何へ） | アプリの History → 訂正履歴（CSV 出力可）、各詳細画面の「訂正履歴」。Owner/Admin は任意の変更を元に戻せます（戻した操作も記録）。DB 上は追記専用で、Owner を含め誰も書き換え・削除できません |
| システムの更新履歴（バージョン・日付・内容） | アプリの History → システム更新履歴（`src/lib/changelog.ts`） |
| 不具合の報告・調査・修正・承認・反映の記録 | GitHub の Issue（label: bug）、PR（fix-proposal / approved）、Actions の実行記録 |
| 端末で起きた不具合のログ | アプリの Settings →「この端末の不具合ログ」 |

## 注意

- このリポジトリは **公開** です。Issue・PR は誰でも閲覧できるため、自動報告は取引データ・個人情報を匿名化してから送っています。手動報告に顧客名・金額などを書かないでください。非公開にする場合は、GitHub の Settings → Danger Zone → Change visibility（採用 LP の GitHub Pages は有料プランが必要になります）
- 夜間の修正案作成（1:00）は Claude Code の Routine として登録されています。停止・変更は claude.ai の Routines から行えます
