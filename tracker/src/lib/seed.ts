import type { Contact, Deal, Incident } from './domain.ts';

// サーバーなしのデモで最初に表示する例（実在しない会社・番号）
const t = new Date().toISOString();
export const seedDeals = (): Deal[] => [
  { id: 'D-0002', title: '冷凍ホタテ 国内向け', partner: '東京サンプル商事', product: '冷凍ホタテ貝柱', quantity: '300ケース', amount: 850000, currency: 'JPY', terms: '', status: 'ordered', owner: 'デモ', lot: 'LOT-2610-B', createdAt: t, createdBy: 'demo' },
  { id: 'D-0001', title: 'ホタテ貝柱 1コンテナ', partner: 'Sample Trading Pte', partnerCountry: 'シンガポール', product: '冷凍ホタテ貝柱', quantity: '20t', amount: 1200000, currency: 'USD', terms: 'CIF', status: 'shipped', owner: 'デモ', lot: 'LOT-2610-A', dueDate: '', createdAt: t, createdBy: 'demo' },
];
export const seedContacts = (): Contact[] => [
  { id: 'C-0001', name: '社内 緊急連絡窓口（サンプル）', category: 'internal', phone: '000-0000-0000', always: true, hours: '24時間', modes: [], note: 'デモ用の架空の番号です', createdAt: t },
  { id: 'C-0002', name: 'ヤマト運輸 法人窓口（サンプル）', category: 'carrier', phone: '0120-000-000', hours: '平日 9:00-18:00', modes: ['hokkaido', 'mainland'], note: 'デモ用の架空の番号です', createdAt: t },
  { id: 'C-0003', name: '通関業者 夜間連絡（サンプル）', category: 'customs', phone: '000-1111-2222', always: true, modes: ['sea', 'air'], note: 'デモ用の架空の番号です', createdAt: t },
];
export const seedIncidents = (): Incident[] => [
  { id: 'I-0001', title: 'コンテナの温度が上昇（サンプル）', type: 'temperature', severity: 'urgent', detail: '-18℃設定のところ -9℃を表示。船会社に確認中。', shipmentNo: 'CSQU3054383', dealId: 'D-0001', status: 'open', createdBy: 'demo', createdAt: t },
];
