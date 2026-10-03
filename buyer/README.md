# H-LINK バイヤーポータル（卸受注ダッシュボード）

国内外のバイヤー向け B2B 受注ダッシュボードのデモ。ビルド不要の静的サイトです。

```
cd buyer && python3 -m http.server 8000   # http://localhost:8000
```

| 画面 | ルート |
|---|---|
| トップ（ダッシュボード・ブランドビジュアル） | `#/` |
| 01 商品検索・カテゴリーフィルター | `#/search` |
| 02 商品詳細・卸価格・在庫・MOQ | `#/product/:id` |
| 03 サンプル依頼フロー（入力→確認→完了） | `#/sample/:id` |
| 04 お気に入り・再注文 | `#/favorites` |
| 05 問い合わせ・チャット | `#/messages` |
| 06 注文・発注履歴・ステータス追跡 | `#/orders` |
| 見積・サンプル依頼 / アカウント設定 | `#/requests` `#/account` |

- データは localStorage に保存（サイドバー下の「デモデータを初期化」で復元）。
- 商品写真は一部のみ。`app.js` の `PRODUCTS` の `img` に画像パスを入れると差し替えできます。

## 公開について（デモ版・関係者限定）

Pages 等の一般公開はしていません。claude.ai の非公開アーティファクトとして置いてあり、閲覧できるのは所有者と、共有設定で許可された人だけです。
URL: https://claude.ai/artifact/GQEAH7myvqNHzLgjx8Zahg （QR: `assets/qr.svg`、マニュアル: `guide.html` / `docs/*.pdf`）
