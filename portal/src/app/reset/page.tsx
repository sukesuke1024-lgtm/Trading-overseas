import Link from "next/link";

// ログイン前は Shell が再設定画面を表示します。ログイン済みでこのURLを開いた場合の案内です。
export default function ResetPage() {
  return <div className="card max-w-md p-6 text-[13.5px] text-ink-2">すでにログインしています。PINを変更する場合は、画面右上の鍵アイコンから変更できます。<div className="mt-4"><Link href="/" className="btn btn-primary">ホームへ</Link></div></div>;
}
