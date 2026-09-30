import { pillars, producerBenefits, buyerSegments, flow, flowModes, proof, trust } from '../content/services.mjs';
import { regions } from '../content/regions.mjs';
import { criteria } from '../content/selection.mjs';
import { pillars as esg, statusLabel, sports } from '../content/sustainability.mjs';
import { stories } from '../content/stories.mjs';
import { slot, btn, icon, url, esc, hasSlotFile, slotUrl } from './util.mjs';
import { sectionHead } from './layout.mjs';
import { site } from '../content/site.mjs';

// ---------- HERO ----------
const heroArt = `<svg class="hero-art" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a42"/><stop offset=".45" stop-color="#6b5f83"/><stop offset=".72" stop-color="#e9a067"/><stop offset="1" stop-color="#f6cf94"/></linearGradient>
<radialGradient id="sun" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1130 610) scale(360)"><stop offset="0" stop-color="#fff2c9" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd58a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>
<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e5a877"/><stop offset=".5" stop-color="#4b5a76"/><stop offset="1" stop-color="#1f2c44"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#hs)"/><rect width="1600" height="900" fill="url(#sun)"/>
<circle cx="1130" cy="610" r="34" fill="#fff4d6"/>
<path d="M0 560L150 470 300 545 470 420 640 540 800 470 980 575 1120 520 1300 585 1460 500 1600 560V700H0z" fill="#56607f" opacity=".75"/>
<path d="M0 620L180 540 360 610 560 500 760 600 940 545 1180 630 1400 570 1600 620V720H0z" fill="#36415f"/>
<rect y="640" width="1600" height="260" fill="url(#sea)"/>
<g stroke="#ffe0a8" stroke-width="2" opacity=".45"><path d="M960 664h340M1010 684h240M1050 706h170M990 730h280"/></g>
<path d="M0 704L200 676 420 706 640 684 860 712 1100 690 1340 716 1600 694V900H0z" fill="#1b263b"/>
<g class="hero-bridge" fill="none" stroke="#101a2c"><path d="M-10 690H1610" stroke-width="10"/>
${[160, 380, 600, 820, 1040, 1260, 1480].map((x) => `<path d="M${x} 690v90" stroke-width="12"/>`).join('')}</g>
<path class="hero-redline" d="M-40 690Q800 470 1640 690" fill="none" stroke="#D71920" stroke-width="7" stroke-linecap="round" pathLength="1"/>
<path d="M-40 702Q800 490 1640 702" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" pathLength="1"/>
</svg>`;

export function hero() {
  const alts = ['hero-producer', 'hero-food', 'hero-logistics'].filter(hasSlotFile);
  const bg = hasSlotFile('hero-landscape')
    ? `<img class="hero-img is-on" src="${slotUrl('hero-landscape')}" alt="" fetchpriority="high">`
    : heroArt;
  const extra = alts.map((id) => `<img class="hero-img" src="${slotUrl(id)}" alt="" loading="lazy">`).join('');
  return `<section class="hero" aria-labelledby="hero-h">
  <div class="hero-bg" ${alts.length ? 'data-slides' : ''}>${bg}${extra}</div>
  <div class="hero-scrim" aria-hidden="true"></div>
  <p class="hero-vlabel" aria-hidden="true">日本の食を、世界の食卓へ</p>
  <div class="wrap hero-in">
    <p class="hero-micro">PRODUCER × MARKET × H-LINK</p>
    <h1 id="hero-h" class="hero-h"><span>つなぐ、越える、</span><span>食の可能性をひらく。</span></h1>
    <p class="hero-sub">日本各地の生産者と、国内外の市場をつなぐ。<br>H-LINKは、販路開拓から商談、物流、品質管理までを支える食品専門商社です。</p>
    <div class="btn-row">${btn('生産者の方へ', '/producers/', 'red')}${btn('バイヤーの方へ', '/buyers/', 'ghost')}</div>
  </div>
  <a class="hero-scroll" href="#statement" aria-label="下へスクロール"><span>SCROLL</span></a>
</section>`;
}

// ---------- BRAND STATEMENT ----------
export const statement = () => `<section class="sec" id="statement"><div class="wrap grid-2">
  <div>
    <p class="eyebrow">BRAND STATEMENT</p>
    <h2 class="h1" data-reveal>良いものが、<br>届くべき場所へ<br>届く仕組みを。</h2>
    <p class="lead" data-reveal>生産者がつくる価値と、市場が求める価値。<br>その間には、営業、商談、物流、品質、情報、言語など多くの壁があります。<br>H-LINKは、その壁を越えるための商流を設計します。</p>
  </div>
  <ol class="chain" aria-label="商流の図：生産者、H-LINK、バイヤー、お客様">
    <li><small>PRODUCER</small><b>生産者</b></li>
    <li class="is-hl"><small>BRIDGE</small><b>H-LINK</b></li>
    <li><small>BUYER</small><b>バイヤー</b></li>
    <li><small>CUSTOMER</small><b>お客様</b></li>
  </ol>
</div></section>`;

// ---------- WHAT WE DO ----------
export const whatWeDo = (head = true) => `<section class="sec sec--warm"><div class="wrap">
  ${head ? sectionHead({ eyebrow: 'WHAT WE DO', title: '産地と市場のあいだを、<br>一つひとつ整える。', lead: 'クリエイティブやAI、データも、H-LINKでは食を売るための道具として使います。' }) : ''}
  <ul class="pillars">${pillars.map((p) => `<li class="pillar io">
    ${slot(p.slot, { cls: 'pillar-img' })}
    <div class="pillar-b"><span class="pn">${p.n}</span><small>${p.en}</small><h3>${p.title}</h3><p>${p.text}</p></div></li>`).join('')}</ul>
</div></section>`;

// ---------- FOR PRODUCERS ----------
export const forProducers = () => `<section class="sec"><div class="wrap grid-2 grid-2--media">
  ${slot('producer-portrait', { cls: 'tall' })}
  <div>
    <p class="eyebrow">FOR PRODUCERS</p>
    <h2 class="h1" data-reveal>つくることに<br>集中できる環境を。</h2>
    <p class="lead" data-reveal>自社ECや既存販路はそのまま。<br>H-LINKは、生産者単独では届きにくい法人市場・新規地域・海外市場への接点をつくります。</p>
    <ul class="tags">${producerBenefits.map((b) => `<li>${b}</li>`).join('')}</ul>
    <div class="btn-row">${btn('H-LINKに商品を提案する', '/contact/?type=producer', 'red')}${btn('生産者の方へ', '/producers/', 'line')}</div>
  </div>
</div></section>`;

// ---------- FOR BUYERS ----------
export const forBuyers = () => `<section class="sec sec--dark"><div class="wrap">
  <div class="grid-2">
    <div>
      <p class="eyebrow eyebrow--rev">FOR BUYERS</p>
      <h2 class="h1" data-reveal>探す手間を減らし、<br>選ぶ質を上げる。</h2>
      <p class="lead lead--rev" data-reveal>各地の生産者を個別に探すのではなく、<br>H-LINKが品質、供給力、物流適性、ストーリーを整理して提案します。</p>
      <div class="btn-row">${btn('仕入れ相談をする', '/contact/?type=buyer', 'red')}${btn('バイヤーの方へ', '/buyers/', 'ghost')}</div>
    </div>
    <ul class="segments">${buyerSegments.map((s) => `<li><small>${s.en}</small><b>${s.ja}</b></li>`).join('')}</ul>
  </div>
</div></section>`;

// ---------- SELECTION ----------
export const selectionSection = () => `<section class="sec sec--beige"><div class="wrap">
  ${sectionHead({ eyebrow: 'H-LINK SELECTION', title: '選ぶことも、価値になる。', lead: 'H-LINKの基準を満たす商品だけを選定。<br>品質・供給・価格・物語・物流・表示・トレーサビリティを総合的に確認します。' })}
  <ul class="criteria">${criteria.map((c, i) => `<li class="io"><span class="cn">${String(i + 1).padStart(2, '0')}</span><small>${c.en}</small><b>${c.ja}</b><p>${c.text}</p></li>`).join('')}</ul>
  <div class="btn-row">${btn('H-LINK SELECTIONについて', '/selection/', 'dark')}</div>
</div></section>`;

// ---------- REGIONS ----------
export const regionStrip = () => `<section class="sec"><div class="wrap">
  ${sectionHead({ eyebrow: 'REGIONAL ORIGINS', title: '北海道から始まり、<br>日本各地へ。', lead: '地域の魅力を一括りにせず、それぞれの産地の背景まで市場へ届けます。' })}
  <ol class="regions">${regions.map((r) => `<li class="region region--${r.status}"><small>${r.en}</small><b>${r.ja}</b><span class="rtag">${r.label}</span></li>`).join('')}</ol>
  <p class="note">※ 北海道以外の地域は展開予定です。取扱い開始時に更新します。</p>
</div></section>`;

// ---------- BUSINESS FLOW ----------
const node = (t, cls = '') => `<li class="fnode ${cls}">${t}</li>`;
export const businessFlow = () => `<section class="sec sec--warm" id="flow"><div class="wrap">
  ${sectionHead({ eyebrow: 'BUSINESS FLOW', title: '生産者から、お客様まで。<br>間のすべてを、H-LINKが担う。' })}
  <div class="flow" role="group" aria-label="ビジネスフロー">
    <div class="flow-col"><h3><small>PRODUCER SIDE</small>生産者側</h3><ol>${flow.producerSide.map((t) => node(t)).join('')}</ol></div>
    <div class="flow-col flow-col--hl"><h3><small>H-LINK</small>H-LINKの役割</h3><ol>${flow.hlink.map((t, i) => node(t, 'is-hl')).join('')}</ol></div>
    <div class="flow-col"><h3><small>BUYER SIDE</small>バイヤー側</h3><ol>${flow.buyerSide.map((t) => node(t)).join('')}</ol></div>
  </div>
  <div class="modes" data-tabs>
    <div class="tab-list" role="tablist" aria-label="物流モデルの切り替え">${flowModes.map((m, i) => `<button role="tab" id="mode-t-${m.id}" aria-controls="mode-${m.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${m.title}<small>${m.status}</small></button>`).join('')}</div>
    ${flowModes.map((m, i) => `<div class="tab-panel" role="tabpanel" id="mode-${m.id}" aria-labelledby="mode-t-${m.id}" ${i ? 'hidden' : ''}>
      <p>${m.text}</p><ol class="mflow">${m.steps.map((s) => `<li>${s}</li>`).join('')}</ol></div>`).join('')}
  </div>
</div></section>`;

// ---------- PROOF ----------
export const proofSection = () => `<section class="sec"><div class="wrap">
  ${sectionHead({ eyebrow: 'NUMBERS', title: 'H-LINKの、いま。', lead: '実績の数値は、確認できたものから順に掲載します。' })}
  <dl class="proof" data-source="content/services.mjs">${proof.map((p) => `<div><dt><small>${p.en}</small>${p.label}</dt><dd>${p.value == null ? '<span class="soon">COMING SOON</span>' : `<b>${p.value}</b><span>${p.unit}</span>`}</dd></div>`).join('')}</dl>
</div></section>`;

// ---------- TRUST ----------
export const trustSection = () => `<section class="sec sec--warm"><div class="wrap">
  ${sectionHead({ eyebrow: 'TRUST', title: '安心して取引するために、<br>見えるようにする。', lead: '商品ごとの情報を、同じ形式で整理してお届けします。認証などは、確認できたものだけを掲載します。' })}
  <ul class="trust">${trust.map((t) => `<li>${icon(t.icon, 'ico ico--lg')}<b>${t.label}</b><p>${t.text}</p></li>`).join('')}</ul>
</div></section>`;

// ---------- ESG ----------
export const esgSection = () => `<section class="sec sec--esg"><div class="wrap">
  <div class="esg-head">
    <p class="eyebrow eyebrow--rev">SUSTAINABILITY</p>
    <h2 class="h1" data-reveal>食をつなぐことは、<br>地域の未来をつなぐこと。</h2>
    <p class="lead lead--rev">取り組みは「取り組み中」「計画中」「将来目標」に分けて、正直にお伝えします。</p>
  </div>
  <div class="esg-cols">${esg.map((p) => `<article><span class="esg-k">${p.key}</span><h3><small>${p.en}</small>${p.ja}</h3><ul>${p.items.map(([t, s]) => `<li>${t}<i class="st st--${s}">${statusLabel[s]}</i></li>`).join('')}</ul></article>`).join('')}</div>
  <div class="btn-row">${btn('サステナビリティについて', '/sustainability/', 'ghost')}</div>
</div></section>`;

// ---------- SPORTS ----------
export const sportsSection = () => `<section class="sec"><div class="wrap grid-2 grid-2--media">
  ${slot('sports-support', { cls: 'wide' })}
  <div>
    <p class="eyebrow">SPORTS SUPPORT</p>
    <h2 class="h1" data-reveal>挑戦する人を、<br>食で支える。</h2>
    <p class="lead">${sports.note}</p>
    <ul class="tags">${sports.activities.map((a) => `<li>${a}</li>`).join('')}</ul>
    <p class="note">※ 活動内容は計画中のものを含みます。実施が決まり次第、お知らせします。</p>
  </div>
</div></section>`;

// ---------- STORIES ----------
export const storyCard = (s) => `<article class="story io" data-cat="${s.category}">
  <a href="${url(`/news/${s.slug}/`)}">${slot(s.slot, { cls: 'story-img' })}<div class="story-b"><p class="story-m"><span class="cat">${s.category}</span>${s.sample ? '<span class="sample">サンプル</span>' : `<time datetime="${s.date}">${s.date.replaceAll('-', '.')}</time>`}</p><h3>${s.title}</h3></div></a></article>`;
export const storiesSection = () => `<section class="sec sec--beige"><div class="wrap">
  ${sectionHead({ eyebrow: 'STORIES / JOURNAL', title: '産地と、人と、商談の物語。' })}
  <div class="stories">${stories.map(storyCard).join('')}</div>
  <div class="btn-row">${btn('すべてのストーリー', '/news/', 'dark')}</div>
</div></section>`;
