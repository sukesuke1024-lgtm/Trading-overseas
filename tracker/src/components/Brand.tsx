// H-LINK のマーク（Hと赤い弧）とワードマーク。ログイン画面は実物のロゴ画像（assets/brand-lockup.png）を使う
export function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size * 1.38} height={size} viewBox="0 0 72 52" role="img" aria-label="H-LINK" style={{ flex: 'none' }}>
      <g fill="#fff">
        <path d="M2 4h22v6h-4v32h4v6H2v-6h4V10H2zM48 4h22v6h-4v32h4v6H48v-6h4V10h-4z" />
        <rect x="18" y="23" width="36" height="6" />
      </g>
      <path d="M1 41C17 13 55 13 71 41 53 27 19 27 1 41Z" fill="#e41b1b" />
    </svg>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="wm">
      <span className="wm-name"><b>H</b>-LINK</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

// ログイン画面などの背景に流れる光の曲線
export function Streaks() {
  return (
    <svg className="streaks" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sk1" x1="0" x2="1"><stop offset="0" stopColor="#5e90d6" stopOpacity="0" /><stop offset=".5" stopColor="#bcd4ff" stopOpacity=".9" /><stop offset="1" stopColor="#5e90d6" stopOpacity="0" /></linearGradient>
        <linearGradient id="sk2" x1="0" x2="1"><stop offset="0" stopColor="#e41b1b" stopOpacity="0" /><stop offset=".7" stopColor="#ff5a5a" stopOpacity=".8" /><stop offset="1" stopColor="#ff5a5a" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M-20 250C160 190 320 270 480 300S720 250 820 190" fill="none" stroke="url(#sk1)" strokeWidth="2.2" />
      <path d="M-20 290C180 240 340 320 520 340S740 300 820 250" fill="none" stroke="url(#sk1)" strokeWidth="1" opacity=".6" />
      <path d="M300 330C460 350 620 300 820 190" fill="none" stroke="url(#sk2)" strokeWidth="1.6" />
    </svg>
  );
}
