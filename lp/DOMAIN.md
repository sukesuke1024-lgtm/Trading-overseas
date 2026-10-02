# 独自ドメインで採用LPを公開する（SEO・AIO向け）

社内システム（ポータル/CRM）は検索に出さず、**採用LPだけ**を会社の独自ドメインで公開します。

## 構成
| 用途 | URL 例 | 検索 |
|---|---|---|
| 採用LP（公開） | `https://www.example.co.jp/` | 出す（SEO・AIO の対象） |
| 社内CRM（非公開） | `https://crm.example.co.jp/` | 出さない（Cloudflare Access + noindex） |
| 社内ポータル（非公開） | `https://portal.example.co.jp/` | 同上 |

## 手順
1. **ドメインを取る**：Cloudflare Registrar（原価販売）など。`.co.jp` は法人登記が必要（約3,000〜5,000円/年）、`.com` は約1,500円/年。会社名に近く、短く、ハイフンの少ないものを。
2. **Cloudflare にドメインを追加**（無料プラン）。ネームサーバーを Cloudflare に向ける。
3. **Cloudflare Pages のプロジェクトを作る**（Workers & Pages → Create → Pages → Direct Upload でも可）。プロジェクト名を控える。
4. **GitHub に設定**（`.github/workflows/lp-cloudflare.yml` の冒頭を参照）：Variables に `CF_PAGES_PROJECT`・`SITE_URL`（末尾 `/` つき）・`DISABLE_GITHUB_PAGES=true`、Secrets に `CLOUDFLARE_API_TOKEN`・`CLOUDFLARE_ACCOUNT_ID`。
5. `main` にマージするとビルド・テスト・公開されます。Pages プロジェクトの Custom domains に `www.example.co.jp` を追加（`example.co.jp` → `www` へのリダイレクトも設定）。
6. **確認**：`https://www.example.co.jp/` が開く／`/sitemap.xml`・`/robots.txt` が新ドメインになっている／Google Search Console にドメインを登録してサイトマップを送信。

## メールの到達性（Google / Microsoft から送るため必須）
ドメインに **SPF・DKIM・DMARC** を設定しないと、CRM のメール配信が迷惑メールになります。Google Workspace / Microsoft 365 の管理画面の手順どおりに DNS（Cloudflare）へ追加してください。

## 注意
- 旧URL（`github.io`）は公開を止めます。検索結果に残る場合は Search Console の「削除」から依頼。
- 検索順位はドメインだけで決まりません。内容の充実、構造化データ（実装済み）、被リンク、表示速度が効きます。ドメインは「会社の信頼性」を示す土台です。
