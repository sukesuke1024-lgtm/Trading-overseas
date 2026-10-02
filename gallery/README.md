# UIKit Gallery

Tailwind コンポーネントのギャラリーサイト（Next.js 16 + Tailwind v4 + SQLite）。

- 一覧: 検索・カテゴリ絞り込み・新着/人気ソート
- 詳細: サンドボックス iframe でライブプレビュー、コードコピー、いいね
- 投稿: ライブプレビュー付きフォーム → SQLite（`data/gallery.db`）に保存
- API: `GET/POST /api/components`, `POST /api/components/:slug/like`

```bash
cd gallery
npm install
npm run dev      # http://localhost:3000
```

初回アクセス時に `data/gallery.db` が作られ、サンプル 13 件が投入されます。

## 注意

- 認証・レート制限はまだありません（誰でも投稿・いいね可能）。公開前に追加してください。
- プレビューは `sandbox="allow-scripts"`（same-origin なし）の iframe 内で実行され、Tailwind は `public/tailwind-browser.js` をローカル配信しています。
