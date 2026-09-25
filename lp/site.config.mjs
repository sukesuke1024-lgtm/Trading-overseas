// =====================================================================
// サイト全体の設定。公開前に「★要確認」の項目を実際の情報に書き換えてください。
// `npm run check` で未設定の項目が一覧表示されます。
// =====================================================================
export default {
  // 公開URL（末尾スラッシュあり）。GitHub Actions では Pages の URL が自動で入ります。
  // 独自ドメインを使う場合はここを書き換えるか、環境変数 SITE_URL で上書きします。
  siteUrl: process.env.SITE_URL || 'https://sukesuke1024-lgtm.github.io/KAAS-E-learning/',

  company: {
    // ★要確認: 会社名（言語別）。空のままだとヘッダーは「RECRUIT」表記になります。
    name: { ja: '', en: '', zh: '' },
    // ★要確認: 会社の公式サイトURL
    url: '',
    // ★要確認: ロゴ画像（static/ 配下のパス）。未設定なら文字ロゴを表示します。
    logo: '',
  },

  // ★要確認: エントリー先（応募フォーム・採用管理システムのURL、または mailto:）
  entryUrl: '',
  // ★要確認: プライバシーポリシーのURL
  privacyUrl: '',

  // 求人の構造化データ（Google しごと検索向け JobPosting）。
  // 住所・雇用形態が揃ったら enabled: true にしてください。不完全なまま出すと
  // Search Console でエラーになるため、既定では出力しません。
  jobPosting: {
    enabled: false,
    datePosted: '2026-09-25',
    validThrough: '', // 例: '2027-03-31'
    employmentType: 'FULL_TIME', // FULL_TIME / PART_TIME / CONTRACTOR など
    address: {
      streetAddress: '',
      addressLocality: '', // 市区町村
      addressRegion: '', // 都道府県
      postalCode: '',
      addressCountry: 'JP',
    },
    // 給与（任意）。{ min: 4000000, max: 7000000, unit: 'YEAR' } のように設定
    salary: null,
  },

  video: {
    file: 'assets/video/overseas-buyer-sales-recruit-90s.mp4',
    poster: 'assets/video/poster.jpg',
    uploadDate: '2026-09-25',
    duration: 'PT1M30S',
  },

  // 最終更新日（ページとsitemapに出力）
  dateModified: '2026-09-25',

  languages: [
    { code: 'ja', hreflang: 'ja', path: '', label: '日本語', short: 'JP', ogLocale: 'ja_JP' },
    { code: 'en', hreflang: 'en', path: 'en/', label: 'English', short: 'EN', ogLocale: 'en_US' },
    { code: 'zh', hreflang: 'zh-Hans', path: 'zh/', label: '简体中文', short: '中文', ogLocale: 'zh_CN' },
  ],
  defaultLanguage: 'ja',
};
