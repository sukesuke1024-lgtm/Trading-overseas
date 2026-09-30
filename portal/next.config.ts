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
            ],
          }];
        },
      }),
};

export default nextConfig;
