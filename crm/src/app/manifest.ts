import type { MetadataRoute } from "next";

export const dynamic = "force-static";
const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// スマホ・PCに「アプリとしてインストール」するための定義（アイコンはポータルと同一。portal の npm run icons で生成）
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "H-LINK CRM",
    short_name: "H-LINK CRM",
    description: "顧客 × 案件 × 活動 × Next Action を一つに。海外事業の営業を前に進める社内CRM",
    id: `${B}/`,
    start_url: `${B}/`,
    scope: `${B}/`,
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#111111",
    lang: "ja",
    icons: [
      { src: `${B}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${B}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${B}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
