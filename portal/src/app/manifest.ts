import type { MetadataRoute } from "next";

export const dynamic = "force-static";
const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// スマホ・PCに「アプリとしてインストール」するための定義（アイコンは npm run icons で自動生成）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "H-LINK 社内ポータル",
    short_name: "H-LINK",
    description: "勤怠入力・申請承認・Excel連携（勤怠ブック→賃金計算ブック）の社内ポータル",
    id: `${B}/`,
    start_url: `${B}/`,
    scope: `${B}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#111111",
    lang: "ja",
    icons: [
      { src: `${B}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${B}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${B}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "勤怠・打刻", url: `${B}/attendance/`, icons: [{ src: `${B}/icons/icon-192.png`, sizes: "192x192" }] },
      { name: "申請・承認", url: `${B}/workflow/`, icons: [{ src: `${B}/icons/icon-192.png`, sizes: "192x192" }] },
      { name: "お知らせ", url: `${B}/news/`, icons: [{ src: `${B}/icons/icon-192.png`, sizes: "192x192" }] },
    ],
  };
}
