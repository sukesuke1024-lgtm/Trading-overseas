import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store/store";
import { AppShell } from "@/components/app-shell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "AITREK OS", template: "%s | AITREK OS" },
  description: "AITREK 海外輸出・海外営業の事業運営システム",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#111318" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[13.5px]">
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
