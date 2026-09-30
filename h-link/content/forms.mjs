const REGIONS = ['北海道', '東北', '北陸', '関東', '中部', '関西', '中国', '四国', '九州・沖縄', 'その他'];
const CATEGORIES = ['農産物', '水産物', '畜産物', '乳製品', '米・穀物', '加工食品', '飲料・酒類', '菓子・スイーツ', 'その他'];
const TEMPS = ['常温', '冷蔵', '冷凍', '複数の温度帯'];

// short: 最初に入力する項目 / detail: 任意の詳細項目
export const forms = {
  producer: {
    id: 'producer', tab: '生産者の方', submit: '商品を提案する',
    short: [
      { name: 'company', label: '会社名・屋号', required: true, autocomplete: 'organization' },
      { name: 'contact', label: 'ご担当者名', required: true, autocomplete: 'name' },
      { name: 'email', label: 'メールアドレス', type: 'email', required: true, autocomplete: 'email' },
      { name: 'tel', label: '電話番号', type: 'tel', autocomplete: 'tel' },
      { name: 'region', label: '産地・所在地', type: 'select', options: REGIONS, required: true },
      { name: 'category', label: '商品カテゴリ', type: 'select', options: CATEGORIES, required: true },
      { name: 'product', label: '商品名', required: true, full: true }
    ],
    detail: [
      { name: 'price', label: '卸価格（税抜）', hint: '例：1kgあたり／1ケースあたり' },
      { name: 'moq', label: '最小ロット（MOQ）' },
      { name: 'supply', label: '供給量（年間・月間）' },
      { name: 'shelf', label: '賞味期限・消費期限' },
      { name: 'temp', label: '温度帯', type: 'select', options: TEMPS },
      { name: 'cert', label: '取得している認証', hint: '取得済みのものだけをご記入ください' },
      { name: 'export', label: '輸出の経験', type: 'select', options: ['あり', 'なし', '検討中'] },
      { name: 'web', label: 'WebサイトまたはSNS', type: 'url' },
      { name: 'file', label: '商品資料（規格書・カタログなど）', type: 'file', full: true, hint: 'PDF・画像／10MBまで' },
      { name: 'notes', label: 'ご質問・補足', type: 'textarea', full: true }
    ]
  },
  buyer: {
    id: 'buyer', tab: 'バイヤーの方', submit: '仕入れについて相談する',
    short: [
      { name: 'company', label: '会社名', required: true, autocomplete: 'organization' },
      { name: 'contact', label: 'ご担当者名', required: true, autocomplete: 'name' },
      { name: 'email', label: 'メールアドレス', type: 'email', required: true, autocomplete: 'email' },
      { name: 'tel', label: '電話番号', type: 'tel', autocomplete: 'tel' },
      { name: 'category', label: '探しているカテゴリ', type: 'select', options: CATEGORIES, required: true },
      { name: 'area', label: '国内／海外', type: 'select', options: ['国内', '海外', 'どちらも'], required: true },
      { name: 'request', label: 'ご要望の内容', type: 'textarea', required: true, full: true }
    ],
    detail: [
      { name: 'budget', label: '予算感', type: 'select', options: ['〜10万円', '10〜50万円', '50〜100万円', '100〜500万円', '500万円〜', '未定'] },
      { name: 'qty', label: '希望数量' },
      { name: 'delivery', label: '納品エリア' },
      { name: 'date', label: '希望納期', type: 'date' },
      { name: 'temp', label: '温度帯', type: 'select', options: TEMPS }
    ]
  },
  media: {
    id: 'media', tab: '取材・協業', submit: '送信する',
    short: [
      { name: 'company', label: '会社名・媒体名', required: true, autocomplete: 'organization' },
      { name: 'contact', label: 'ご担当者名', required: true, autocomplete: 'name' },
      { name: 'email', label: 'メールアドレス', type: 'email', required: true, autocomplete: 'email' },
      { name: 'request', label: 'ご依頼・ご提案の内容', type: 'textarea', required: true, full: true }
    ],
    detail: [{ name: 'tel', label: '電話番号', type: 'tel' }, { name: 'web', label: 'Webサイト', type: 'url' }]
  },
  other: {
    id: 'other', tab: 'その他', submit: '送信する',
    short: [
      { name: 'contact', label: 'お名前', required: true, autocomplete: 'name' },
      { name: 'email', label: 'メールアドレス', type: 'email', required: true, autocomplete: 'email' },
      { name: 'request', label: 'お問い合わせ内容', type: 'textarea', required: true, full: true }
    ],
    detail: [{ name: 'company', label: '会社名（任意）' }, { name: 'tel', label: '電話番号' }]
  }
};
