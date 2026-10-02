/** サーバー版（ログイン・共有データ・APIあり）か、静的デモ版（各端末のブラウザ内だけ）か。ビルド時に NEXT_PUBLIC_MODE=server で切り替える */
export const SERVER = process.env.NEXT_PUBLIC_MODE === "server";
