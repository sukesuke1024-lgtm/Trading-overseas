import { site } from '../content/site.mjs';
import { forms } from '../content/forms.mjs';
import { producerFaq, buyerFaq } from '../content/faq.mjs';
import { transactionModels, functions, flowModes, quality, roadmap, trust, buyerSegments, producerBenefits, pillars } from '../content/services.mjs';
import { criteria, selectionPage, selected } from '../content/selection.mjs';
import { pillars as esg, sdgs, statusLabel, sports } from '../content/sustainability.mjs';
import { stories, categories, articleBody, articlePullQuote } from '../content/stories.mjs';
import { en } from '../content/en.mjs';
import { page, pageHead, sectionHead, finalCta } from './layout.mjs';
import { btn, icon, slot, url, esc, markSvg, abs } from './util.mjs';
import * as S from './sections.mjs';
import { formHtml } from './forms-ui.mjs';

const faq = (list) => `<div class="faq">${list.map(([q, a]) => `<details><summary>${q}${icon('plus', 'ico faq-i')}</summary><p>${a}</p></details>`).join('')}</div>`;
const faqLd = (list) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: list.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });

// ================= HOME =================
export const home = () =>
  page({
    path: '/', title: site.tagline, description: site.description, heroDark: true, bodyClass: 'home',
    body: [S.hero(), S.statement(), S.whatWeDo(), S.forProducers(), S.forBuyers(), S.selectionSection(), S.regionStrip(), S.businessFlow(), S.proofSection(), S.esgSection(), S.sportsSection(), S.storiesSection(), finalCta()].join('\n')
  });

// ================= BUSINESS =================
export const business = () =>
  page({
    path: '/business/', title: '事業内容', description: 'H-LINKは、産地と市場をつなぐ食品専門商社。事業モデル、サービス、流通フロー、取引形態、品質管理、今後の展開をご紹介します。', crumbs: [{ name: '事業内容', path: '/business/' }],
    body: [
      pageHead({ eyebrow: 'BUSINESS', h1: '産地と市場をつなぐ、<br>食品専門商社。', lead: 'H-LINKは、生産者がつくる価値を、それを求めるバイヤーへ届ける食品の商社です。', crumbs: [{ name: '事業内容' }] }),
      `<section class="sec"><div class="wrap">${sectionHead({ eyebrow: '01 · BUSINESS MODEL', title: '生産者とバイヤーのあいだに立ち、<br>商流を設計する。' })}
        <ol class="chain chain--lg" aria-label="PRODUCER → H-LINK → BUYER"><li><small>PRODUCER</small><b>生産者</b></li><li class="is-hl"><small>H-LINK</small><b>H-LINK</b></li><li><small>BUYER</small><b>バイヤー</b></li></ol>
        <ul class="tags tags--lg">${functions.map((f) => `<li>${f}</li>`).join('')}</ul></div></section>`,
      `<section class="sec sec--warm"><div class="wrap">${sectionHead({ eyebrow: '02 · SERVICES', title: '4つの柱で、販売を強くする。', lead: 'クリエイティブやAIを別の事業とは考えていません。食を売るための道具として使います。' })}
        <ul class="pillars">${pillars.map((p) => `<li class="pillar"><div class="pillar-b pillar-b--solo"><span class="pn">${p.n}</span><small>${p.en}</small><h3>${p.title}</h3><p>${p.text}</p></div></li>`).join('')}</ul></div></section>`,
      S.businessFlow().replace('<section class="sec sec--warm" id="flow">', '<section class="sec" id="flow">'),
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: '04 · TRANSACTION MODELS', title: '取引の形は、案件に合わせて。', lead: '以下は想定している取引形態です。条件はご相談のうえ、案件ごとに設計します。' })}
        <ul class="models">${transactionModels.map((m, i) => `<li><span class="cn">${String(i + 1).padStart(2, '0')}</span><h3>${m.title}</h3><p>${m.text}</p></li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: '06 · QUALITY / COMPLIANCE', title: '品質と法令遵守を、<br>取引の土台に。' })}</div><ul class="checks">${quality.map((q) => `<li>${q}</li>`).join('')}</ul></div></section>`,
      `<section class="sec sec--warm"><div class="wrap">${sectionHead({ eyebrow: '07 · 08 · EXPANSION', title: '国内から、海外へ。<br>段階的に広げていく。', lead: '展開の順序は現時点の計画です。具体的な地域・時期は、確定後にお知らせします。' })}
        <ol class="roadmap">${roadmap.map((r) => `<li><small>${r.phase}</small><h3>${r.title}</h3><span class="rtag">${r.status}</span><p>${r.text}</p></li>`).join('')}</ol></div></section>`,
      S.regionStrip(), S.trustSection(), finalCta()
    ].join('\n')
  });

// ================= PRODUCERS =================
const flowSteps = ['エントリー', 'ヒアリング', '商品・供給の確認', '市場との相性確認', '提案の準備', 'バイヤーとのマッチング', 'トライアル発注', '継続取引'];
export const producers = () =>
  page({
    path: '/producers/', title: '生産者の方へ', description: 'あなたの商品を、まだ届いていない市場へ。既存の販路はそのまま。H-LINKが新規販路・商談・物流・販促を支えます。商品のご提案はこちらから。', crumbs: [{ name: '生産者の方へ', path: '/producers/' }], stickyCta: { label: '商品を提案する', href: '/producers/#apply' }, jsonld: [faqLd(producerFaq)],
    body: [
      pageHead({ eyebrow: 'FOR PRODUCERS', h1: 'あなたの商品を、<br>まだ届いていない市場へ。', lead: '自社ECや既存の取引先はそのままに。H-LINKが、新たな接点をつくります。', crumbs: [{ name: '生産者の方へ' }] }),
      `<section class="sec"><div class="wrap grid-2 grid-2--media">${slot('farm-field', { cls: 'wide' })}<div>${sectionHead({ eyebrow: '01 · WHO WE SUPPORT', title: 'こんな生産者を、応援します。' })}<ul class="checks"><li>良い商品があるのに、販路が限られている</li><li>法人向けの営業に手が回らない</li><li>百貨店・ホテル・飲食店などに届けたい</li><li>将来、海外にも挑戦したい</li></ul></div></div></section>`,
      S.whatWeDo(false).replace('<div class="wrap">', `<div class="wrap">${sectionHead({ eyebrow: '02 · WHAT H-LINK DOES', title: 'H-LINKが担うこと。' })}`),
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: '03 · EXISTING CHANNELS', title: '既存の販路は、そのままで。', lead: '自社EC、直売所、既存の取引先。いまの販路を変える必要はありません。H-LINKは、その外側に新しい接点をつくります。' })}</div><ul class="tags">${producerBenefits.map((b) => `<li>${b}</li>`).join('')}</ul></div></section>`,
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: '04 · TARGET BUYERS', title: '想定しているバイヤー。' })}<ul class="segments segments--light">${buyerSegments.map((s) => `<li><small>${s.en}</small><b>${s.ja}</b></li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap">${sectionHead({ eyebrow: '05 · APPLICATION FLOW', title: 'ご提案から、継続取引まで。' })}<ol class="steps-flow">${flowSteps.map((s, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><b>${s}</b></li>`).join('')}</ol></div></section>`,
      `<section class="sec sec--warm"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: '06 · REQUIRED INFORMATION', title: '事前にご用意いただくと<br>スムーズな情報。' })}</div><ul class="checks"><li>商品名・カテゴリ・産地</li><li>卸価格・最小ロット・供給量</li><li>賞味期限・温度帯</li><li>取得している認証（あれば）</li><li>商品写真・規格書・カタログ（あれば）</li></ul></div></section>`,
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: '07 · FEES / TRANSACTION', title: '費用・取引形態。' })}</div><div><p class="lead">取引形態（売買型・仲介型・企画型）により条件が異なります。ご相談の段階で、内容を明確にご案内します。</p><p class="note">※ 具体的な料率・条件は、確定後にこのページへ掲載します。</p></div></div></section>`,
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: '08 · FAQ', title: 'よくあるご質問' })}${faq(producerFaq)}</div></section>`,
      `<section class="sec" id="apply"><div class="wrap grid-2 grid-2--form"><div>${sectionHead({ eyebrow: '09 · PRODUCT SUBMISSION', title: '商品を、提案してください。', lead: 'まずは基本情報だけで大丈夫です。詳しい情報は、あとから追加できます。' })}</div>${formHtml(forms.producer)}</div></section>`,
      finalCta()
    ].join('\n')
  });

// ================= BUYERS =================
export const buyers = () =>
  page({
    path: '/buyers/', title: 'バイヤーの方へ', description: '日本各地の魅力を、必要な形で。複数の生産者を一つの提案で。ホテル・飲食店・百貨店・EC・海外バイヤーの仕入れをH-LINKが支えます。', crumbs: [{ name: 'バイヤーの方へ', path: '/buyers/' }], stickyCta: { label: '仕入れ相談をする', href: '/buyers/#inquiry' }, jsonld: [faqLd(buyerFaq)],
    body: [
      pageHead({ eyebrow: 'FOR BUYERS', h1: '日本各地の魅力を、<br>必要な形で。', lead: '探す手間を減らし、選ぶ質を上げる。H-LINKが、目的に合う商品を整理して提案します。', crumbs: [{ name: 'バイヤーの方へ' }] }),
      `<section class="sec sec--dark"><div class="wrap">${sectionHead({ eyebrow: 'SOLUTIONS', title: '用途に合わせた、仕入れの提案。' })}
        <ul class="models models--dark">${[['ホテルの朝食', 'hotel-restaurant'], ['レストランのメニュー', 'processing'], ['百貨店のフェア', 'retail-shelf'], ['高品質スーパー', 'product-detail'], ['ギフトの企画', 'packaging'], ['ECでの販売', 'exhibition'], ['海外への調達', 'logistics']].map(([t, s], i) => `<li><span class="cn">${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3></li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'FEATURES', title: 'H-LINKだから、<br>できること。' })}${slot('buyer-meeting', { cls: 'wide' })}</div><ul class="checks checks--num">${['複数の生産者を、一つの提案で', '選定された商品のキュレーション', '規格の統一された商品スペック', '供給量のご相談', 'サンプルの手配', '物流のサポート'].map((t) => `<li>${t}</li>`).join('')}</ul></div></section>`,
      S.trustSection(),
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: 'FAQ', title: 'よくあるご質問' })}${faq(buyerFaq)}</div></section>`,
      `<section class="sec" id="inquiry"><div class="wrap grid-2 grid-2--form"><div>${sectionHead({ eyebrow: 'BUYER INQUIRY', title: '仕入れについて、<br>相談する。', lead: '条件が固まっていなくても構いません。ご要望をお聞かせください。' })}</div>${formHtml(forms.buyer)}</div></section>`,
      finalCta({ primary: ['仕入れについて相談する', '/buyers/#inquiry'], secondary: ['商品を提案する', '/contact/?type=producer'] })
    ].join('\n')
  });

// ================= SELECTION =================
export const selection = () =>
  page({
    path: '/selection/', title: 'H-LINK SELECTION', description: 'H-LINK SELECTIONは、H-LINKの基準を満たす商品を選定する取り組み。品質・供給・物語・トレーサビリティ・物流・市場との相性を総合的に確認します。', crumbs: [{ name: 'H-LINK SELECTION', path: '/selection/' }],
    body: [
      pageHead({ eyebrow: 'H-LINK SELECTION', h1: '選び抜いた理由まで、<br>届ける。', lead: '選ぶことも、価値になる。H-LINKの基準で、商品を選定します。', crumbs: [{ name: 'H-LINK SELECTION' }] }),
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'PHILOSOPHY', title: '選ぶ基準を、<br>言葉にする。', lead: '「良い」の中身を明らかにすることで、生産者にもバイヤーにも、納得のある取引が生まれます。' })}</div><ul class="checks">${selectionPage.standards.map((s) => `<li>${s}</li>`).join('')}</ul></div></section>`,
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: 'EVALUATION STANDARDS', title: '6つの評価軸。' })}<ul class="criteria">${criteria.map((c, i) => `<li><span class="cn">${String(i + 1).padStart(2, '0')}</span><small>${c.en}</small><b>${c.ja}</b><p>${c.text}</p></li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap">${sectionHead({ eyebrow: 'SELECTED PRODUCTS', title: '選定商品。' })}${selected.length ? '' : `<div class="empty"><span class="soon">COMING SOON</span><p>選定商品は、取扱いが決まり次第、産地・生産者の情報とあわせて掲載します。</p></div>`}</div></section>`,
      `<section class="sec sec--warm"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'CERTIFICATION CONCEPT', title: '「H-LINK SELECTED」', lead: '選定した商品に付ける表示を構想しています。運用の方針が確定するまでは、認証やお墨付きとして使用しません。' })}</div><div class="badge" aria-hidden="true">${markSvg('lm')}<b>H-LINK SELECTED</b><small>構想中</small></div></div></section>`,
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'TRACEABILITY / SEASONAL', title: 'トレーサビリティと、季節の選定。', lead: `ロットと出荷の記録が追える運用を設計しています。${selectionPage.seasonal}` })}</div>${slot('product-detail', { cls: 'wide' })}</div></section>`,
      finalCta({ h: 'あなたの商品を、選定の場へ。', primary: ['商品を提案する', '/contact/?type=producer'], secondary: ['仕入れについて相談する', '/contact/?type=buyer'] })
    ].join('\n')
  });

// ================= SUSTAINABILITY =================
export const sustainability = () =>
  page({
    path: '/sustainability/', title: 'サステナビリティ', description: '地域と食の未来を、次の世代へ。H-LINKの環境・社会・ガバナンスへの取り組みを、取り組み中・計画中・将来目標に分けてご紹介します。', crumbs: [{ name: 'サステナビリティ', path: '/sustainability/' }],
    body: [
      pageHead({ eyebrow: 'SUSTAINABILITY', h1: '地域と食の未来を、<br>次の世代へ。', lead: '食をつなぐことは、地域の未来をつなぐこと。取り組みの状況を、正直にお伝えします。', crumbs: [{ name: 'サステナビリティ' }] }),
      ...esg.map((p) => `<section class="sec ${p.key === 'S' ? 'sec--warm' : ''}"><div class="wrap grid-2 grid-2--media">${slot(p.slot, { cls: 'wide' })}<div><p class="eyebrow">${p.en}</p><h2 class="h2">${p.ja}</h2><ul class="esg-list">${p.items.map(([t, s]) => `<li>${t}<i class="st st--${s} st--l">${statusLabel[s]}</i></li>`).join('')}</ul></div></div></section>`),
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: 'SPORTS SUPPORT', title: '挑戦する人を、食で支える。', lead: sports.note })}<ul class="tags">${sports.activities.map((a) => `<li>${a}</li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap">${sectionHead({ eyebrow: 'SDGs MAPPING', title: '関連するSDGs。', lead: 'H-LINKの取り組みと関連の深い目標を整理した参考の対応表です。国連等への加盟・認定を示すものではありません。KPIは設定でき次第、掲載します。' })}
        <div class="table-wrap"><table class="sdg"><caption class="sr">SDGsの対応表</caption><thead><tr><th scope="col">目標</th><th scope="col">課題</th><th scope="col">H-LINKの取り組み</th><th scope="col">KPI</th><th scope="col">状況</th></tr></thead><tbody>${sdgs.map((g) => `<tr><th scope="row"><b>${g.no}</b> ${g.name}</th><td>${g.issue}</td><td>${g.action}</td><td>${g.kpi}</td><td><i class="st st--${g.status} st--l">${statusLabel[g.status]}</i></td></tr>`).join('')}</tbody></table></div></div></section>`,
      finalCta({ h: '地域の未来を、一緒に。', primary: ['協業・取材のご相談', '/contact/?type=media'], secondary: ['お問い合わせ', '/contact/'] })
    ].join('\n')
  });

// ================= ABOUT =================
export const about = () =>
  page({
    path: '/about/', title: '私たちについて', description: 'H-LINKのミッション・ビジョン・バリュー、ブランドストーリー、会社概要、ロゴに込めた意味をご紹介します。', crumbs: [{ name: '私たちについて', path: '/about/' }],
    body: [
      pageHead({ eyebrow: 'ABOUT', h1: '産地と市場をつなぎ、<br>食の可能性をひらく。', lead: 'H-LINKは、北海道を原点に、日本各地の食の価値を届ける食品専門商社です。', crumbs: [{ name: '私たちについて' }] }),
      `<section class="sec"><div class="wrap grid-2"><div><p class="eyebrow">MISSION</p><p class="quote">産地と市場をつなぎ、<br>食の可能性をひらく。</p></div><div><p class="eyebrow">VISION</p><p class="quote quote--s">日本各地の価値ある食が、地域や国境を越えて、<br>必要とされる場所で日常的に選ばれる状態をつくる。</p></div></div></section>`,
      `<section class="sec sec--warm"><div class="wrap">${sectionHead({ eyebrow: 'VALUES', title: '大切にしていること。' })}<ul class="values">${[['TRUST', '信頼'], ['QUALITY', '品質'], ['CONNECTION', 'つながり'], ['CHALLENGE', '挑戦'], ['LOCAL VALUE', '地域の価値'], ['LONG-TERM', '長期の視点']].map(([e, j]) => `<li><b>${e}</b><span>${j}</span></li>`).join('')}</ul></div></section>`,
      `<section class="sec"><div class="wrap grid-2 grid-2--media">${slot('producer-portrait', { cls: 'tall' })}<div>${sectionHead({ eyebrow: 'BRAND STORY / WHY H-LINK', title: '良いものが届かない、<br>その「間」をなくしたい。', lead: '産地には、つくり手の想いと、その土地でしかつくれない味があります。一方、市場には、良いものを探しているバイヤーがいます。その間にある壁を越えるために、H-LINKは生まれました。' })}</div></div></section>`,
      `<section class="sec sec--beige"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'FOUNDER MESSAGE', title: '代表メッセージ。' })}</div><div class="empty"><span class="soon">COMING SOON</span><p>代表メッセージは、準備ができ次第掲載します。</p></div></div></section>`,
      `<section class="sec"><div class="wrap grid-2"><div>${sectionHead({ eyebrow: 'COMPANY PROFILE', title: '会社概要。' })}</div><dl class="profile">${site.company.map(([k, v]) => `<div><dt>${k}</dt><dd>${v ?? '<span class="soon soon--s">準備中</span>'}</dd></div>`).join('')}</dl></div></section>`,
      `<section class="sec sec--warm"><div class="wrap"><div class="grid-2 grid-2--media"><div class="markbox">${markSvg('lm lm--xl')}<b class="wordmark"><i>H</i>-LINK</b></div><div>${sectionHead({ eyebrow: 'BRAND MARK', title: 'ロゴに込めた意味。' })}<dl class="meaning"><div><dt>H</dt><dd>origin / hub / human / horizon<br>原点であり、拠点であり、人であり、地平線。</dd></div><div><dt>橋のかたち</dt><dd>つなぐ（connection）</dd></div><div><dt>赤い弧</dt><dd>境を越える、期待を超える（crossing borders / surpassing expectations）</dd></div><div><dt>北海道</dt><dd>原点であって、限界ではありません。</dd></div></dl></div></div></div></section>`,
      finalCta()
    ].join('\n')
  });

// ================= NEWS =================
export const news = () =>
  page({
    path: '/news/', title: 'お知らせ・ストーリー', description: 'H-LINKのお知らせと、生産者・産地・商談・サステナビリティのストーリー。', crumbs: [{ name: 'お知らせ・ストーリー', path: '/news/' }],
    body: [
      pageHead({ eyebrow: 'NEWS / JOURNAL', h1: 'お知らせ・<br>ストーリー', lead: '産地と、人と、商談の物語。（記事は順次掲載します。現在の記事はサンプルです。）', crumbs: [{ name: 'お知らせ・ストーリー' }] }),
      `<section class="sec"><div class="wrap"><div class="chips" role="group" aria-label="カテゴリで絞り込む"><button type="button" aria-pressed="true" data-cat="">すべて</button>${categories.map((c) => `<button type="button" aria-pressed="false" data-cat="${c}">${c}</button>`).join('')}</div>
        <div class="stories stories--list" data-filter>${stories.map(S.storyCard).join('')}</div><p class="empty-msg" hidden>このカテゴリの記事は、まだありません。</p></div></section>`,
      finalCta()
    ].join('\n')
  });

export const article = (s) => {
  const others = stories.filter((x) => x.slug !== s.slug);
  return page({
    path: `/news/${s.slug}/`, title: s.title, description: s.lead, ogType: 'article', crumbs: [{ name: 'お知らせ・ストーリー', path: '/news/' }, { name: s.title, path: `/news/${s.slug}/` }], noindex: !!s.sample,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: s.title, datePublished: s.date, author: { '@type': 'Organization', name: site.name }, publisher: { '@type': 'Organization', name: site.name }, mainEntityOfPage: abs(`/news/${s.slug}/`) }],
    body: [
      `<article class="art"><header class="phead phead--art"><div class="wrap wrap--narrow"><nav class="crumbs" aria-label="パンくず"><a href="${url('/')}">HOME</a><a href="${url('/news/')}">お知らせ・ストーリー</a><span aria-current="page">${esc(s.title)}</span></nav><p class="story-m"><span class="cat">${s.category}</span>${s.sample ? '<span class="sample">サンプル</span>' : `<time datetime="${s.date}">${s.date.replaceAll('-', '.')}</time>`}</p><h1 class="h1 h1--art">${s.title}</h1><p class="lead lead--lg">${s.lead}</p></div></header>
      <div class="wrap">${slot(s.slot, { cls: 'art-hero' })}</div>
      <div class="wrap wrap--narrow art-body"><p>${articleBody[0]}</p><p>${articleBody[1]}</p><blockquote>${articlePullQuote}</blockquote><p>${articleBody[2]}</p></div>
      <div class="wrap">${slot('processing', { cls: 'art-full' })}</div></article>`,
      `<section class="sec sec--beige"><div class="wrap">${sectionHead({ eyebrow: 'RELATED STORIES', title: '関連するストーリー' })}<div class="stories">${others.map(S.storyCard).join('')}</div></div></section>`,
      finalCta()
    ].join('\n')
  });
};

// ================= CONTACT =================
export const contact = () =>
  page({
    path: '/contact/', title: 'お問い合わせ', description: 'H-LINKへのお問い合わせ。生産者の方（商品のご提案）、バイヤーの方（仕入れ相談）、取材・協業、その他。', crumbs: [{ name: 'お問い合わせ', path: '/contact/' }],
    body: [
      pageHead({ eyebrow: 'CONTACT', h1: 'お問い合わせ', lead: 'ご用件に近いものをお選びください。まずは短い入力から始められます。', crumbs: [{ name: 'お問い合わせ' }] }),
      `<section class="sec"><div class="wrap wrap--narrow" data-tabs data-hash-tabs>
        <div class="tab-list" role="tablist" aria-label="お問い合わせの種類">${Object.values(forms).map((f, i) => `<button role="tab" id="ct-${f.id}" data-type="${f.id}" aria-controls="cp-${f.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${f.tab}</button>`).join('')}</div>
        ${Object.values(forms).map((f, i) => `<div class="tab-panel" role="tabpanel" id="cp-${f.id}" aria-labelledby="ct-${f.id}" ${i ? 'hidden' : ''}>${formHtml(f)}</div>`).join('')}
        <p class="note">${site.contactEmail ? `メール：<a href="mailto:${site.contactEmail}">${site.contactEmail}</a>` : ''}</p></div></section>`
    ].join('\n')
  });

// ================= LEGAL (ひな形) =================
const legal = (path, title, secs) =>
  page({ path, title, description: `H-LINKの${title}です。公開前に内容の確認が必要なひな形です。`, crumbs: [{ name: title, path }], noindex: true,
    body: [pageHead({ eyebrow: 'LEGAL', h1: title, lead: '※ これは公開前に法務確認が必要なひな形です。', crumbs: [{ name: title }] }),
      `<section class="sec"><div class="wrap wrap--narrow legal">${secs.map(([h, t]) => `<h2>${h}</h2><p>${t}</p>`).join('')}</div></section>`].join('\n') });
export const privacy = () => legal('/privacy/', 'プライバシーポリシー', [
  ['1. 取得する情報', 'お問い合わせフォームでご入力いただく氏名・会社名・連絡先・お問い合わせ内容など。'],
  ['2. 利用目的', 'お問い合わせへの対応、商談・取引のご連絡、サービス改善のため。'],
  ['3. 第三者提供', '法令に基づく場合を除き、本人の同意なく第三者に提供しません。'],
  ['4. お問い合わせ窓口', '（窓口の連絡先を記載してください）']
]);
export const terms = () => legal('/terms/', 'ご利用にあたって', [
  ['1. 掲載内容', '本サイトの内容は、正確を期していますが、予告なく変更することがあります。'],
  ['2. 著作権', '本サイトの文章・画像・ロゴの無断転載を禁じます。'],
  ['3. リンク', '（リンクに関する方針を記載してください）']
]);

// ================= ENGLISH =================
export const english = () =>
  page({
    path: '/en/', lang: 'en', title: en.title, description: en.description, heroDark: true, bodyClass: 'home en',
    body: `<section class="hero hero--en"><div class="hero-bg">${S.hero().match(/<svg class="hero-art"[\s\S]*?<\/svg>/)?.[0] ?? ''}</div><div class="hero-scrim" aria-hidden="true"></div><div class="wrap hero-in"><p class="hero-micro">PRODUCER × MARKET × H-LINK</p><h1 class="hero-h"><span>${en.hero.h1}</span></h1><p class="hero-sub">${en.hero.sub}</p><div class="btn-row">${btn(en.producers.cta, '/contact/?type=producer', 'red')}${btn(en.buyers.cta, '/contact/?type=buyer', 'ghost')}</div></div></section>
<section class="sec"><div class="wrap grid-2"><div><p class="eyebrow">BRAND STATEMENT</p><h2 class="h1">${en.statement}</h2><p class="lead">${en.statementBody}</p></div><ol class="chain"><li><small>PRODUCER</small><b>Producer</b></li><li class="is-hl"><small>BRIDGE</small><b>H-LINK</b></li><li><small>BUYER</small><b>Buyer</b></li><li><small>CUSTOMER</small><b>Customer</b></li></ol></div></section>
<section class="sec sec--warm"><div class="wrap"><ul class="models">${en.pillars.map(([t, d], i) => `<li><span class="cn">0${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ul></div></section>
<section class="sec"><div class="wrap grid-2"><div><h2 class="h2">${en.producers.h}</h2><p class="lead">${en.producers.p}</p></div><div><h2 class="h2">${en.buyers.h}</h2><p class="lead">${en.buyers.p}</p></div></div><div class="wrap"><p class="note">${en.origin}</p></div></section>
<section class="fcta"><div class="wrap"><h2 class="h1">${en.cta}</h2><div class="btn-row">${btn(en.producers.cta, '/contact/?type=producer', 'red')}${btn(en.buyers.cta, '/contact/?type=buyer', 'ghost')}</div><p class="note note--rev">The full site is currently available in Japanese.</p></div></section>`
  });

export const notFound = () =>
  page({ path: '/404.html', title: 'ページが見つかりません', description: 'お探しのページは見つかりませんでした。URLが変更されたか、削除された可能性があります。', noindex: true,
    body: `<section class="phead"><div class="wrap"><p class="eyebrow">404</p><h1 class="h1">ページが見つかりません</h1><p class="lead">URLが変更されたか、削除された可能性があります。</p><div class="btn-row">${btn('ホームへ戻る', '/', 'red')}</div></div></section>` });
