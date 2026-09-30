export const pillars = [
  { n: '01', title: '販路開拓', en: 'Market Access', text: 'ホテル、飲食店、百貨店、小売、EC、海外バイヤーへの提案。', slot: 'hotel-restaurant' },
  { n: '02', title: '商談・取引設計', en: 'Deal Design', text: '見積、条件交渉、契約、受発注、継続取引の設計。', slot: 'buyer-meeting' },
  { n: '03', title: '物流・品質管理', en: 'Logistics & QA', text: '規格、ロット、温度帯、賞味期限、表示、トレーサビリティ。', slot: 'logistics' },
  { n: '04', title: 'ブランド・販売支援', en: 'Brand & Sales', text: '商品ストーリー、販促素材、売場提案、企画提案。', slot: 'packaging' }
];

export const producerBenefits = ['新規販路', '法人営業代行', '商品規格整理', '販促支援', '物流設計', '市場フィードバック', '継続受注支援'];

export const buyerSegments = [
  { en: 'Hotels', ja: 'ホテル' },
  { en: 'Restaurants', ja: 'レストラン・飲食店' },
  { en: 'Department stores', ja: '百貨店' },
  { en: 'Premium supermarkets', ja: '高品質志向のスーパー' },
  { en: 'Gift / EC companies', ja: 'ギフト・EC事業者' },
  { en: 'Overseas importers', ja: '海外の輸入事業者' }
];

// H-LINKの機能（ビジネスモデル図用）
export const functions = ['調達', '選定', '企画', '営業', '商談', '物流', '品質管理', '請求', 'データ還元'];

// フロー図
export const flow = {
  producerSide: ['生産者', '商品スクリーニング', '規格・供給力の確認', 'H-LINKによる提案'],
  hlink: ['市場調査', 'バイヤーへの提案', '商談', '受発注・請求', '物流の調整', '販売フィードバック'],
  buyerSide: ['ホテル・飲食店・小売・EC・海外', 'お客様']
};

export const flowModes = [
  {
    id: 'direct',
    title: '直送モデル',
    en: 'Direct shipment',
    status: '基本形',
    text: '生産者からバイヤーへ直接出荷。商談・請求・品質確認はH-LINKが担い、物流は生産者の出荷体制を活かします。',
    steps: ['生産者', 'H-LINK（商談・請求・品質確認）', 'バイヤー', 'お客様']
  },
  {
    id: 'consolidated',
    title: '集約物流モデル',
    en: 'Consolidated logistics',
    status: '将来構想',
    text: '複数の産地の商品をまとめて届ける仕組み。取扱いが広がった段階での導入を想定しています（現在は構想段階です）。',
    steps: ['複数の生産者', 'H-LINK（集約・品質確認）', '一括配送', 'バイヤー・お客様']
  }
];

// 取引形態（想定）。条件は案件ごとに個別に設計します
export const transactionModels = [
  { title: '売買型', text: 'H-LINKが商品を仕入れ、バイヤーへ販売します。価格・数量・納期は取引条件として整理します。' },
  { title: '仲介・手数料型', text: '生産者とバイヤーの取引をH-LINKがつなぎ、成約に応じた条件で進めます。' },
  { title: '企画・販促型', text: '売場提案、フェア企画、販促素材づくりなど、販売を強くするための企画を組み合わせます。' }
];

export const quality = ['規格・ロットの整理', '温度帯の管理', '賞味期限・消費期限の確認', '表示の確認', 'トレーサビリティ', 'クレーム・リコール対応の手順', '情報管理'];

export const roadmap = [
  { phase: 'PHASE 1', title: '北海道から始める', status: '現在の注力地域', text: '北海道を原点に、生産者との関係づくりと国内バイヤーへの提案から。' },
  { phase: 'PHASE 2', title: '日本各地へ広げる', status: '展開予定', text: '産地ごとの背景を大切にしながら、取り扱う地域を段階的に広げます。' },
  { phase: 'PHASE 3', title: '海外の市場へ', status: '展開予定', text: '国内での実績と体制づくりを踏まえ、海外バイヤーとの取引を進めます。具体的な地域は確定後にお知らせします。' }
];

export const proof = [
  { key: 'producers', label: '取引生産者数', en: 'Partner producers', value: null, unit: '社' },
  { key: 'buyers', label: 'バイヤー数', en: 'Buyers', value: null, unit: '社' },
  { key: 'regions', label: '取扱い地域', en: 'Regions', value: null, unit: '地域' },
  { key: 'repeat', label: 'リピート率', en: 'Repeat rate', value: null, unit: '%' },
  { key: 'sku', label: '取扱い商品数', en: 'SKU count', value: null, unit: '品' }
];

export const trust = [
  { icon: 'temp', label: '温度帯', text: '常温・冷蔵・冷凍を商品ごとに明記' },
  { icon: 'shelf', label: '賞味期限', text: '賞味・消費期限と納品可能期間を整理' },
  { icon: 'region', label: '産地', text: '産地・生産者の背景を商品情報に添える' },
  { icon: 'trace', label: 'トレーサビリティ', text: 'ロットと出荷の記録を残す運用を設計' },
  { icon: 'volume', label: '供給量', text: '年間・月間の供給力を事前に確認' },
  { icon: 'cert', label: '認証', text: '取得している認証は、確認できたものだけを表示' },
  { icon: 'flow', label: '問い合わせ対応', text: 'ご連絡から回答までの流れを明示' }
];
