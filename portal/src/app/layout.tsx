import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "ミライHD 社内ポータル",
  description: "株式会社ミライホールディングス 社内ポータル（デモ）— お知らせ・ワークフロー・勤怠・文書・予約・ヘルプデスク・研修",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
