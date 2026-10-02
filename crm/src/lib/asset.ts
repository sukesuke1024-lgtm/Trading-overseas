/** 静的書き出し（サブパス公開）でも画像が読めるよう、basePath を付ける */
export const asset = (p: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${p}`;
/** 社内ポータルの URL。別のURLで運用する場合は NEXT_PUBLIC_PORTAL_URL に設定する（未設定のときは同じサイトの /portal/） */
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || "../portal/";
export const AITREK_OS_URL = process.env.NEXT_PUBLIC_OS_URL || "../aitrek-os/";
