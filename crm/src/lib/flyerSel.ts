// カタログで選んだ商品を、メール配信画面のチラシに引き継ぐ（同じブラウザ内の一時保存）
const KEY = "hlink-crm.flyerSel";
export interface FlyerSel { ids: string[]; title: string; subtitle: string }
export const loadFlyerSel = (): FlyerSel | null => { try { const r = sessionStorage.getItem(KEY); return r ? (JSON.parse(r) as FlyerSel) : null; } catch { return null; } };
export const saveFlyerSel = (s: FlyerSel) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 保存できなくても画面は動く */ } };
export function downloadText(name: string, text: string, type = "text/html;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
