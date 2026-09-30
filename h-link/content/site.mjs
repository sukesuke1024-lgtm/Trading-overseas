// サイト全体の設定。値を変えるだけで全ページに反映されます。
export const site = {
  name: 'H-LINK',
  tagline: 'つなぐ、越える、食の可能性をひらく。',
  description:
    '日本各地の生産者と、国内外の市場をつなぐ。H-LINKは、販路開拓から商談、物流、品質管理までを支える食品専門商社です。',
  // 公開URL（canonical / OGP / sitemap に使用）。環境変数 SITE_URL でも上書き可
  url: (process.env.SITE_URL || 'https://example.com').replace(/\/$/, ''),
  // サブパス公開（GitHub Pages等）の場合は BASE_PATH=/repo/ を指定
  basePath: (process.env.BASE_PATH || '/').replace(/\/?$/, '/'),
  // フォーム送信先（Formspree等のPOST可能なURL）。未設定の間は「テスト表示」になり、送信されません
  formEndpoint: process.env.FORM_ENDPOINT || '',
  // 未設定なら「準備中」表示。設定するとフッター・お問い合わせに出ます
  contactEmail: '',
  // 画像スロットのIDラベルを表示（本番で画像が揃ったら false）
  showSlotLabels: true,
  social: [
    { name: 'Instagram', url: '' },
    { name: 'YouTube', url: '' },
    { name: 'LinkedIn', url: '' },
    { name: 'X', url: '' }
  ],
  // 会社概要。null は「準備中」と表示（事実が確定したら文字列を入れる）
  company: [
    ['会社名', 'H-LINK'],
    ['事業内容', '食品の企画・仕入・販売、販路開拓、物流・品質管理の調整'],
    ['所在地', null],
    ['代表者', null],
    ['設立', null],
    ['資本金', null],
    ['取引銀行', null],
    ['許認可・登録', null]
  ]
};
