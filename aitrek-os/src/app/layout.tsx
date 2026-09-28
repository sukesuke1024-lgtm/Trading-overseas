import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store/store";
import { AppShell } from "@/components/app-shell";
import { PwaUpdater } from "@/components/pwa";
import { ErrorReporter } from "@/components/error-reporter";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "AITREK OS", template: "%s | AITREK OS" },
  description: "AITREK 海外輸出・海外営業の事業運営システム",
  robots: { index: false, follow: false },
  applicationName: "AITREK OS",
  appleWebApp: { capable: true, title: "AITREK OS", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

// viewportFit: cover で iPhone のノッチ・ホームバー領域まで使い、余白は safe-area で確保する
export const viewport: Viewport = { themeColor: "#111318", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-[13.5px]">
        <StoreProvider>
          <AppShell>{children}</AppShell>
          <PwaUpdater />
          <ErrorReporter />
        </StoreProvider>
      </body>
    </html>
  );
}
