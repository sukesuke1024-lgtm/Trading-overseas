import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開発時は /api を中継サーバー(8080)へ。本番は server/relay.js が dist/ と /api を同じ口で配信する
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(`2.2 (${stamp} UTC)`) }, // ログイン画面に表示。更新が反映されたか確認できる
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
});
