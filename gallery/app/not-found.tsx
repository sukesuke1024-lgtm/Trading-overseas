import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-mono text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold">ページが見つかりません</h1>
      <Link href="/" className="mt-6 inline-block text-accent underline underline-offset-4">一覧に戻る</Link>
    </main>
  );
}
