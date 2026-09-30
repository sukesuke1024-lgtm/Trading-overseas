import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "ミライHD 社内ポータル",
  description: "株式会社ミライホールディングス 社内ポータル（デモ）— 勤怠・ワークフロー・お知らせ・文書・予約・ヘルプデスク・研修",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "ミライHD", statusBarStyle: "default" },
  icons: { icon: [{ url: `${B}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" }, { url: `${B}/icon.svg`, type: "image/svg+xml" }], apple: `${B}/icons/apple-touch-icon.png` },
};

// viewportFit: cover で iPhone のノッチ・ホームバー領域まで使い、余白は safe-area で確保する
export const viewport: Viewport = { themeColor: "#0b3d6e", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
