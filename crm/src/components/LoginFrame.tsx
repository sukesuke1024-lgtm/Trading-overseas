"use client";
import { asset } from "@/lib/asset";

/** ログイン画面の外枠（左：ブランド、右：フォーム） */
export function LoginFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0d0d10] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(900px 500px at 15% 10%, #4a1118 0%, transparent 60%), radial-gradient(700px 500px at 90% 95%, #2a2a31 0%, transparent 55%)" }} />
        <svg className="absolute inset-0 h-full w-full opacity-[.07]" aria-hidden><defs><pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#fff" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="relative"><img src={asset("/brand/logo-horizontal-night.png")} alt="H-LINK" className="h-16 w-auto" /></div>
        <div className="relative max-w-md">
          <p className="mb-3 text-xs font-semibold tracking-[.18em] text-white/55">H-LINK  SALES OPERATING SYSTEM</p>
          <h1 className="text-[34px] font-bold leading-[1.25] tracking-tight">次に誰へ、何をするか。<br />迷わない営業へ。</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/70">つなぐ、越える、食の可能性をひらく。顧客 × 案件 × 活動 × Next Action を一つに、海外バイヤーとの商談を期限と担当者つきで前に進めます。</p>
        </div>
        <p className="relative text-xs text-white/45">© H-LINK — 社内専用システム</p>
      </div>
      <div className="grid place-items-center px-5 py-10">
        <div className="anim-rise w-full max-w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/brand/logo-horizontal.png")} alt="H-LINK" className="mb-8 h-10 w-auto lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  );
}
