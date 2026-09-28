import type { MetadataRoute } from "next";

// PC・スマホ・タブレットに「アプリとしてインストール」するための定義
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AITREK OS",
    short_name: "AITREK OS",
    description: "AITREK 海外輸出・海外営業の事業運営システム",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#111318",
    theme_color: "#111318",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Deals", url: "/deals" },
      { name: "Tasks", url: "/tasks" },
      { name: "Finance", url: "/finance" },
    ],
  };
}
