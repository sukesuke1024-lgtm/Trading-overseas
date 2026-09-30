// 画像スロット。static/images/<id>.(avif|webp|jpg|png) を置くだけで自動的に差し替わります（コード変更不要）。
export const slots = {
  'hero-landscape': { label: 'ヒーロー（風景）', tone: 'dusk', ratio: '16/9', alt: '朝日に照らされた北海道の海と山。橋が地域をつなぐ。' },
  'hero-producer': { label: 'ヒーロー2（生産者）', tone: 'field', ratio: '16/9', alt: '畑で作物を手にする生産者。' },
  'hero-food': { label: 'ヒーロー3（食）', tone: 'warm', ratio: '16/9', alt: '産地の食材。' },
  'hero-logistics': { label: 'ヒーロー4（物流）', tone: 'sea', ratio: '16/9', alt: '港から出荷される食品。' },
  'producer-portrait': { label: '生産者ポートレート', tone: 'field', ratio: '4/5', alt: '生産者のポートレート。' },
  'farm-field': { label: '農場・畑', tone: 'field', ratio: '4/3', alt: '広がる畑。' },
  fishery: { label: '漁業', tone: 'sea', ratio: '4/3', alt: '漁港と漁船。' },
  processing: { label: '加工現場', tone: 'neutral', ratio: '4/3', alt: '食品の加工現場。' },
  'buyer-meeting': { label: 'バイヤー商談', tone: 'neutral', ratio: '4/3', alt: '生産者とバイヤーの商談。' },
  'hotel-restaurant': { label: 'ホテル・レストラン', tone: 'warm', ratio: '4/3', alt: 'ホテルやレストランでの食材の仕入れ。' },
  'retail-shelf': { label: '小売の売場', tone: 'warm', ratio: '4/3', alt: '小売店の売場。' },
  logistics: { label: '物流', tone: 'sea', ratio: '4/3', alt: '出荷を待つコンテナとトラック。' },
  'sports-support': { label: 'スポーツ支援', tone: 'field', ratio: '16/9', alt: '地域のユースチームのスポーツ活動。' },
  'food-education': { label: '食育', tone: 'warm', ratio: '4/3', alt: '子どもたちが参加する食育の場。' },
  'esg-environment': { label: '環境活動', tone: 'sea', ratio: '16/9', alt: '自然環境を守る活動。' },
  exhibition: { label: '展示会', tone: 'neutral', ratio: '4/3', alt: '展示会のブース。' },
  packaging: { label: 'パッケージ', tone: 'warm', ratio: '4/3', alt: '商品のパッケージ。' },
  'product-detail': { label: '商品ディテール', tone: 'warm', ratio: '4/3', alt: '商品のクローズアップ。' }
};
