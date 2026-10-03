// 取引・緊急連絡先・問題報告の型と表示名
export interface Meta { id: string; createdBy?: string; createdAt?: string; updatedBy?: string; updatedAt?: string }

export type DealStatus = 'negotiating' | 'ordered' | 'shipped' | 'delivered' | 'paid' | 'cancelled';
export interface Deal extends Meta {
  title: string; partner: string; partnerCountry?: string; contactPerson?: string; product?: string; quantity?: string;
  amount: number | null; currency: string; terms?: string; status: DealStatus; owner?: string; dueDate?: string; lot?: string; note?: string;
}
export const DEAL_STATUS: Record<DealStatus, string> = { negotiating: '商談中', ordered: '受注', shipped: '出荷済', delivered: '納品済', paid: '入金済', cancelled: 'キャンセル' };
export const TERMS = ['', 'EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DDP'];

export type ContactCat = 'internal' | 'carrier' | 'forwarder' | 'customs' | 'insurance' | 'other';
export interface Contact extends Meta {
  name: string; category: ContactCat; person?: string; phone?: string; email?: string; hours?: string; always?: boolean; modes?: string[]; note?: string;
}
export const CONTACT_CAT: Record<ContactCat, string> = { internal: '社内', carrier: '運送会社', forwarder: '船会社・フォワーダー', customs: '通関業者', insurance: '保険会社', other: 'その他' };

export type IncType = 'delay' | 'damage' | 'temperature' | 'customs' | 'lost' | 'other';
export type IncSev = 'urgent' | 'high' | 'normal';
export interface Incident extends Meta {
  title: string; type: IncType; severity: IncSev; detail?: string; shipmentNo?: string; dealId?: string;
  status: 'open' | 'resolved'; resolution?: string; resolvedBy?: string; resolvedAt?: string;
}
export const INC_TYPE: Record<IncType, string> = { delay: '遅延', damage: '破損・汚損', temperature: '温度異常', customs: '通関の問題', lost: '紛失・誤配', other: 'その他' };
export const INC_SEV: Record<IncSev, string> = { urgent: '緊急', high: '重要', normal: '通常' };
export const sevRank = (s: IncSev) => (s === 'urgent' ? 0 : s === 'high' ? 1 : 2);

export const fmtMoney = (n: number | null | undefined, cur: string) =>
  n == null ? '—' : `${new Intl.NumberFormat('ja-JP').format(n)} ${cur}`;
export const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('ja-JP', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
