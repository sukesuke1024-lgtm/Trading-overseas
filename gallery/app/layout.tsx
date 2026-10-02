import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "UIKit Gallery",
  description: "Copy-ready Tailwind UI components. Browse, preview, and share.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
              uikit<span className="text-accent">/</span>gallery
            </Link>
            <Link
              href="/submit"
              className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-fg transition hover:brightness-110"
            >
              投稿する
            </Link>
          </div>
        </header>
        {children}
        <footer className="mx-auto mt-24 max-w-6xl px-4 pb-10 text-xs text-muted">
          UIKit Gallery — Tailwind コンポーネント集
        </footer>
      </body>
    </html>
  );
}
