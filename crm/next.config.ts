import type { NextConfig } from "next";

// STATIC=1 で静的書き出し（GitHub Pages の /crm/ 配下などに設置可能）
const isStatic = process.env.STATIC === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  poweredByHeader: false,
};

export default nextConfig;
