import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "H-LINK 社内ポータル",
  description: "H-LINK 社内ポータル — 勤怠入力・申請承認・Excel連携（勤怠ブック→賃金計算ブック）",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "H-LINK", statusBarStyle: "default" },
  icons: { icon: [{ url: `${B}/icons/favicon-32.png`, sizes: "32x32", type: "image/png" }, { url: `${B}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }], apple: `${B}/icons/apple-touch-icon.png` },
};

// viewportFit: cover で iPhone のノッチ・ホームバー領域まで使い、余白は safe-area で確保する
export const viewport: Viewport = { themeColor: "#111111", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
