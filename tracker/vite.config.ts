import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 開発時は /api を中継サーバー(8080)へ。本番は server/relay.js が dist/ と /api を同じ口で配信する
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
});
