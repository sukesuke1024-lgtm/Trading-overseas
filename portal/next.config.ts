import type { NextConfig } from "next";

const isStatic = process.env.STATIC === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  poweredByHeader: false,
  ...(isStatic
    ? {}
    : {
        // サーバー運用時のセキュリティヘッダー（静的書き出しでは付与できない）
        async headers() {
          return [{
            source: "/:path*",
            headers: [
              { key: "X-Frame-Options", value: "DENY" },
              { key: "X-Content-Type-Options", value: "nosniff" },
              { key: "Referrer-Policy", value: "same-origin" },
              { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
              { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
              // Next.js のインライン初期化スクリプトのため script-src に 'unsafe-inline' が必要（外部ドメインは一切許可しない）
              ...(process.env.NODE_ENV === "production"
                ? [{ key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" }]
                : []),
            ],
          }];
        },
      }),
};

export default nextConfig;
