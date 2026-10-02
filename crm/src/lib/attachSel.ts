// 資料ライブラリで選んだファイルを、メール配信画面の添付に引き継ぐ（同じブラウザ内の一時保存）
const KEY = "hlink-crm.attachSel";
export const loadAttachSel = (): string[] => { try { const r = sessionStorage.getItem(KEY); return r ? (JSON.parse(r) as string[]) : []; } catch { return []; } };
export const saveAttachSel = (ids: string[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* noop */ } };
export function downloadText(name: string, text: string, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
