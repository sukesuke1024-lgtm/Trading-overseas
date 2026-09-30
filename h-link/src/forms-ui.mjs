import { site } from '../content/site.mjs';
import { url, esc } from './util.mjs';

function field(f, formId) {
  const id = `${formId}-${f.name}`;
  const req = f.required ? ' required aria-required="true"' : '';
  const lab = `<label for="${id}">${f.label}${f.required ? '<span class="req">必須</span>' : '<span class="opt">任意</span>'}</label>`;
  const hint = f.hint ? `<p class="hint" id="${id}-h">${f.hint}</p>` : '';
  const desc = f.hint ? ` aria-describedby="${id}-h ${id}-e"` : ` aria-describedby="${id}-e"`;
  let ctl;
  if (f.type === 'select') ctl = `<select id="${id}" name="${f.name}"${req}${desc}><option value="">選択してください</option>${f.options.map((o) => `<option>${o}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') ctl = `<textarea id="${id}" name="${f.name}" rows="5"${req}${desc}></textarea>`;
  else ctl = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}"${f.autocomplete ? ` autocomplete="${f.autocomplete}"` : ''}${f.type === 'file' ? ' accept=".pdf,image/*"' : ''}${req}${desc}>`;
  return `<div class="field${f.full ? ' full' : ''}">${lab}${ctl}${hint}<p class="err" id="${id}-e" role="alert"></p></div>`;
}

export function formHtml(form, { title } = {}) {
  const id = `f-${form.id}`;
  const fields = (arr) => arr.map((f) => field(f, id)).join('');
  return `<form class="form" id="${id}" data-form="${form.id}" data-endpoint="${esc(site.formEndpoint)}" novalidate method="post" action="${esc(site.formEndpoint || '#')}">
  ${title ? `<h3 class="form-title">${title}</h3>` : ''}
  <ol class="steps" aria-label="入力の流れ"><li data-s="1" aria-current="step">入力</li><li data-s="2">詳細（任意）</li><li data-s="3">確認</li><li data-s="4">完了</li></ol>
  <div class="hp" aria-hidden="true"><label>ご記入不要<input type="text" name="website_hp" tabindex="-1" autocomplete="off"></label></div>
  <input type="hidden" name="_form" value="${form.id}"><input type="hidden" name="_t" value="">
  <fieldset class="step" data-step="1"><legend class="sr">基本情報</legend><div class="grid-f">${fields(form.short)}</div></fieldset>
  <fieldset class="step" data-step="2" hidden><legend>詳細（任意）</legend><p class="hint">分かる範囲で結構です。空欄のまま確認へ進めます。</p><div class="grid-f">${fields(form.detail)}</div></fieldset>
  <div class="step" data-step="3" hidden><h4>入力内容のご確認</h4><dl class="confirm"></dl></div>
  <div class="consent"><input type="checkbox" id="${id}-c" name="consent" required aria-describedby="${id}-c-e"><label for="${id}-c"><a href="${url('/privacy/')}" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します<span class="req">必須</span></label><p class="err" id="${id}-c-e" role="alert"></p></div>
  <div class="form-actions">
    <button type="button" class="btn btn--line" data-act="back" hidden>戻る</button>
    <button type="button" class="btn btn--dark" data-act="detail"><span>詳細を入力する（任意）</span></button>
    <button type="button" class="btn btn--red" data-act="confirm"><span>入力内容を確認する</span></button>
    <button type="submit" class="btn btn--red" data-act="send" hidden><span>${form.submit}</span></button>
  </div>
  <p class="form-status" role="status" aria-live="polite"></p>
  <div class="done" data-step="4" hidden tabindex="-1"><h4>送信を受け付けました</h4><p>お問い合わせありがとうございます。内容を確認のうえ、担当者よりご連絡します。</p></div>
  <noscript><p class="hint">JavaScriptが無効のため、項目はすべて表示されます。</p></noscript>
</form>`;
}
