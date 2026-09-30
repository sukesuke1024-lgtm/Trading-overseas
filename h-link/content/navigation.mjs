export const nav = [
  { path: '/', label: 'HOME', ja: 'ホーム', desktop: false },
  { path: '/business/', label: 'BUSINESS', ja: '事業内容' },
  { path: '/producers/', label: 'PRODUCERS', ja: '生産者の方へ' },
  { path: '/buyers/', label: 'BUYERS', ja: 'バイヤーの方へ' },
  { path: '/selection/', label: 'H-LINK SELECTION', ja: 'H-LINK SELECTION' },
  { path: '/sustainability/', label: 'SUSTAINABILITY', ja: 'サステナビリティ' },
  { path: '/about/', label: 'ABOUT', ja: '私たちについて' },
  { path: '/news/', label: 'NEWS', ja: 'お知らせ・ストーリー' },
  { path: '/contact/', label: 'CONTACT', ja: 'お問い合わせ', desktop: false }
];

export const footerColumns = [
  { title: 'About', links: [['/about/', '私たちについて'], ['/business/', '事業内容']] },
  { title: 'Producers / Buyers', links: [['/producers/', '生産者の方へ'], ['/buyers/', 'バイヤーの方へ']] },
  { title: 'Contents', links: [['/selection/', 'H-LINK SELECTION'], ['/sustainability/', 'サステナビリティ'], ['/news/', 'お知らせ・ストーリー']] },
  { title: 'Support', links: [['/contact/', 'お問い合わせ'], ['/privacy/', 'プライバシーポリシー'], ['/terms/', 'ご利用にあたって']] }
];
