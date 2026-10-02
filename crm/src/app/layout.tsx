import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "AITREK CRM｜海外営業",
  description: "顧客 × 案件 × 活動 × Next Action を一つに。海外事業の営業を前に進める社内CRM",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#101217" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
