(function(){
'use strict';
var d=document,$=function(s,r){return (r||d).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||d).querySelectorAll(s))};
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* header: solid after scroll */
var hdr=$('#hdr');
function onScroll(){ if(hdr) hdr.classList.toggle('is-solid',window.scrollY>40); var s=$('#sticky-cta'); if(s) s.classList.toggle('is-on',window.scrollY>500); }
onScroll(); addEventListener('scroll',onScroll,{passive:true});

/* full-screen menu */
var mb=$('.menu-btn'),menu=$('#menu');
function setMenu(open){
  if(!mb||!menu) return;
  mb.setAttribute('aria-expanded',open); menu.hidden=!open; d.body.classList.toggle('menu-open',open);
  mb.firstElementChild.textContent=open?'メニューを閉じる':'メニューを開く';
  if(open){ var a=$('a',menu); a&&a.focus(); } else mb.focus();
}
if(mb){ mb.addEventListener('click',function(){setMenu(mb.getAttribute('aria-expanded')!=='true')});
  d.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!menu.hidden) setMenu(false); });
  $$('a',menu).forEach(function(a){a.addEventListener('click',function(){setMenu(false)})}); }

/* reveal on scroll */
var targets=$$('[data-reveal],.io');
if('IntersectionObserver' in window && !reduce){
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px',threshold:.08});
  targets.forEach(function(t){io.observe(t)});
} else targets.forEach(function(t){t.classList.add('is-in')});
setTimeout(function(){targets.forEach(function(t){t.classList.add('is-in')})},4000);

/* hero slides (only when real images exist) */
var slides=$$('.hero-bg[data-slides] .hero-img');
if(slides.length>1&&!reduce){ var i=0; setInterval(function(){slides[i].classList.remove('is-on'); i=(i+1)%slides.length; slides[i].classList.add('is-on')},6000); }

/* tabs (WAI-ARIA) */
$$('[data-tabs]').forEach(function(root){
  var tabs=$$('[role="tab"]',root), panels=$$('[role="tabpanel"]',root);
  function select(t,focus){
    tabs.forEach(function(x){var on=x===t;x.setAttribute('aria-selected',on);x.tabIndex=on?0:-1});
    panels.forEach(function(p){p.hidden=p.id!==t.getAttribute('aria-controls')});
    if(focus)t.focus();
  }
  tabs.forEach(function(t,i){
    t.addEventListener('click',function(){select(t)});
    t.addEventListener('keydown',function(e){
      var n=e.key==='ArrowRight'?i+1:e.key==='ArrowLeft'?i-1:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;
      if(n===null)return; e.preventDefault(); select(tabs[(n+tabs.length)%tabs.length],true);
    });
  });
  if(root.hasAttribute('data-hash-tabs')){
    var type=new URLSearchParams(window.__query!==undefined?window.__query:location.search).get('type'); var t=type&&tabs.filter(function(x){return x.dataset.type===type})[0]; if(t)select(t);
  }
});

/* news filter */
var chips=$$('.chips button');
if(chips.length){
  chips.forEach(function(c){c.addEventListener('click',function(){
    chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});
    var cat=c.dataset.cat,n=0;
    $$('[data-filter] .story').forEach(function(s){var show=!cat||s.dataset.cat===cat;s.hidden=!show;if(show)n++});
    var m=$('.empty-msg'); if(m)m.hidden=n>0;
  })});
}

/* subtle page transition */
$$('a[href]').forEach(function(a){
  var h=a.getAttribute('href'); if(!h||h.charAt(0)==='#'||a.target==='_blank'||/^(https?:|mailto:)/.test(h))return;
  a.addEventListener('click',function(e){
    if(e.metaKey||e.ctrlKey||e.shiftKey||reduce||a.pathname===location.pathname)return;
    e.preventDefault(); d.body.classList.add('is-leaving'); setTimeout(function(){location.href=a.href},220);
  });
});
addEventListener('pageshow',function(e){if(e.persisted)d.body.classList.remove('is-leaving')});

/* forms */
$$('form[data-form]').forEach(function(f){
  var step=1, endpoint=f.dataset.endpoint, started=Date.now();
  var steps=$$('[data-step]',f), stepper=$$('.steps li',f), st=$('.form-status',f);
  var btnBack=$('[data-act="back"]',f), btnDetail=$('[data-act="detail"]',f), btnConfirm=$('[data-act="confirm"]',f), btnSend=$('[data-act="send"]',f);
  var consent=$('input[name="consent"]',f);
  f.elements._t.value=String(started);
  function show(n,initial){
    step=n;
    steps.forEach(function(s){s.hidden=Number(s.dataset.step)!==n});
    stepper.forEach(function(li){ if(Number(li.dataset.s)===n)li.setAttribute('aria-current','step'); else li.removeAttribute('aria-current'); });
    btnBack.hidden=n===1||n===4; btnDetail.hidden=n!==1; btnConfirm.hidden=!(n===1||n===2); btnSend.hidden=n!==3;
    $('.consent',f).hidden=n===4; $('.form-actions',f).hidden=n===4;
    if(initial)return;
    var h=$('[data-step="'+n+'"]',f); if(h){ h.setAttribute('tabindex','-1'); h.focus(); }
  }
  function fieldError(el,msg){
    var e=d.getElementById(el.id+'-e'); if(e)e.textContent=msg||''; if(msg)el.setAttribute('aria-invalid','true'); else el.removeAttribute('aria-invalid');
  }
  function validate(scope){
    var first=null;
    $$('input,select,textarea',scope).forEach(function(el){
      if(el.type==='hidden'||el.name==='website_hp')return; var v=(el.type==='checkbox'?el.checked:el.value.trim()), msg='';
      if(el.required&&!v) msg=el.type==='checkbox'?'ご同意が必要です。':'この項目は必須です。';
      else if(el.type==='email'&&v&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg='メールアドレスの形式をご確認ください。';
      else if(el.type==='url'&&v&&!/^https?:\/\/.+/.test(v)) msg='https:// から始まるURLをご入力ください。';
      else if(el.type==='file'&&el.files&&el.files[0]&&el.files[0].size>10*1024*1024) msg='10MB以内のファイルをお選びください。';
      fieldError(el,msg); if(msg&&!first)first=el;
    });
    if(first){first.focus();return false}return true;
  }
  function label(el){var l=$('label[for="'+el.id+'"]',f);return l?l.firstChild.textContent.trim():el.name}
  function summary(){
    var dl=$('.confirm',f); dl.innerHTML='';
    $$('.field',f).forEach(function(w){var el=$('input,select,textarea',w); if(!el)return; var v=el.type==='file'?(el.files[0]?el.files[0].name:''):el.value.trim(); if(!v)return;
      var row=d.createElement('div'),dt=d.createElement('dt'),dd=d.createElement('dd'); dt.textContent=label(el); dd.textContent=v; row.appendChild(dt); row.appendChild(dd); dl.appendChild(row)});
  }
  btnDetail.addEventListener('click',function(){ if(validate($('[data-step="1"]',f))) show(2); });
  btnConfirm.addEventListener('click',function(){
    if(!validate($('[data-step="'+step+'"]',f))) return;
    summary(); show(3);
  });
  btnBack.addEventListener('click',function(){ show(1); });
  if(consent) consent.addEventListener('change',function(){fieldError(consent,'')});
  f.addEventListener('submit',function(e){
    e.preventDefault(); if(step!==3) return;
    if(!validate(f)) { show(1); return; }
    if(f.elements.website_hp.value){ show(4); return; }           // honeypot
    if(Date.now()-started<2500){ st.textContent='入力内容をご確認のうえ、もう一度お試しください。'; return; } // too-fast
    if(!endpoint){ show(4); var p=d.createElement('p'); p.className='demo'; p.textContent='【テスト表示】送信先が未設定のため、内容はどこにも送信されていません。'; $('.done',f).appendChild(p); return; }
    btnSend.disabled=true; st.textContent='送信しています…';
    var data=new FormData(f); data.delete('website_hp');
    fetch(endpoint,{method:'POST',body:data,headers:{Accept:'application/json'}}).then(function(r){
      if(!r.ok) throw new Error(r.status); st.textContent=''; show(4);
    }).catch(function(){ btnSend.disabled=false; st.textContent='送信に失敗しました。時間をおいて再度お試しください。'; });
  });
  /* progressive: without JS all steps are visible; with JS start at step 1 */
  show(1,true);
});
})();
