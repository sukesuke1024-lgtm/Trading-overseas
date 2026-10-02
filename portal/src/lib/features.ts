// 機能の入り切り（ビルド時）。勤怠を外部の勤怠SaaSに任せる場合:  NEXT_PUBLIC_ATTENDANCE=off  （任意で NEXT_PUBLIC_ATTENDANCE_URL=勤怠SaaSのURL）
export const ATTENDANCE_ON = process.env.NEXT_PUBLIC_ATTENDANCE !== "off";
export const ATTENDANCE_URL = process.env.NEXT_PUBLIC_ATTENDANCE_URL || "";
/** 勤怠に関するホーム画面のカード（外すときは非表示） */
export const ATTENDANCE_WIDGETS = ["punch", "attendance", "team", "excel"];
