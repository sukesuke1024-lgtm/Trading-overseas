// status: current(取り組み中) / planned(計画中) / target(将来目標)
export const pillars = [
  {
    key: 'E', en: 'ENVIRONMENT', ja: '環境', slot: 'esg-environment',
    items: [
      ['フードロスの削減', 'planned'], ['適切な梱包', 'planned'], ['地産の活用', 'current'],
      ['物流の効率化', 'planned'], ['責任ある漁業・農業', 'target'], ['環境保全活動への参加', 'target']
    ]
  },
  {
    key: 'S', en: 'SOCIAL', ja: '社会', slot: 'sports-support',
    items: [
      ['生産者の収入機会づくり', 'current'], ['地域での雇用', 'target'], ['食育', 'planned'],
      ['スポーツ支援', 'planned'], ['若い世代・次世代の支援', 'planned'], ['地域イベントへの参加', 'planned'], ['多様性と協働', 'target']
    ]
  },
  {
    key: 'G', en: 'GOVERNANCE', ja: '統治', slot: 'processing',
    items: [
      ['トレーサビリティ', 'planned'], ['明確な取引条件', 'current'], ['品質基準', 'planned'],
      ['クレーム・リコール対応', 'planned'], ['情報管理', 'current'], ['コンプライアンス', 'current']
    ]
  }
];

export const statusLabel = { current: '取り組み中', planned: '計画中', target: '将来目標' };

export const sports = {
  activities: ['商品の提供', '栄養面のサポート', 'イベント支援', 'ユースチームへの支援', '食育 × スポーツ', '地域のアスリートとの連携'],
  note: '地域に根ざした、身近な応援を大切にします。'
};

// SDGs（参考の対応表。国連等との提携・認定を示すものではありません）
export const sdgs = [
  { no: 2, name: '飢餓をゼロに', issue: '食の安定した供給', action: '産地と市場の間の流通課題を整理し、必要とされる場所に届ける', kpi: '設定予定', status: 'planned' },
  { no: 8, name: '働きがいも経済成長も', issue: '生産者の販路が限られること', action: '新たな取引機会の創出', kpi: '設定予定', status: 'current' },
  { no: 9, name: '産業と技術革新の基盤', issue: '流通・情報の非効率', action: '規格・情報の標準化、データの還元', kpi: '設定予定', status: 'planned' },
  { no: 12, name: 'つくる責任つかう責任', issue: 'フードロス・過剰梱包', action: '需要に合わせた提案と適切な梱包の検討', kpi: '設定予定', status: 'planned' },
  { no: 13, name: '気候変動に具体的な対策を', issue: '輸送による環境負荷', action: '物流の効率化、地産の活用', kpi: '設定予定', status: 'planned' },
  { no: 14, name: '海の豊かさを守ろう', issue: '水産資源の持続性', action: '責任ある漁業に取り組む生産者との連携', kpi: '設定予定', status: 'target' },
  { no: 15, name: '陸の豊かさも守ろう', issue: '農地・自然環境の維持', action: '環境に配慮する農業との連携', kpi: '設定予定', status: 'target' },
  { no: 17, name: 'パートナーシップで目標を達成しよう', issue: '産地・企業・地域の分断', action: '生産者・バイヤー・地域との協働', kpi: '設定予定', status: 'current' }
];
