import type { NextConfig } from "next";

// STATIC=1 で静的書き出し（GitHub Pages の /crm/ 配下などに設置可能）
const isStatic = process.env.STATIC === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  poweredByHeader: false,
  ...(isStatic
    ? {}
    : {
        // サーバー版のセキュリティヘッダー（静的書き出しでは付与できない）。為替のリアルタイム提供元だけ外部接続を許可する
        async headers() {
          return [{
            source: "/:path*",
            headers: [
              { key: "X-Frame-Options", value: "DENY" },
              { key: "X-Content-Type-Options", value: "nosniff" },
              { key: "Referrer-Policy", value: "same-origin" },
              { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
            ],
          }, {
            // 資料ファイル（PDF・画像）の表示は、ブラウザのPDF表示を妨げないよう、この規則から外す（ファイル側で nosniff を付与）
            source: "/((?!api/files).*)",
            headers: [
              ...(process.env.NODE_ENV === "production"
                ? [{ key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://open.er-api.com https://api.frankfurter.dev https://api.frankfurter.app https://api.twelvedata.com; font-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" }]
                : []),
            ],
          }];
        },
      }),
};

export default nextConfig;
