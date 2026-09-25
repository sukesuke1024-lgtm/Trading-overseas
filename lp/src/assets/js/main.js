// Progressive enhancement only: the page is fully usable without JavaScript.
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  // Mobile menu
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('global-nav');
  function setMenu(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
  }

  // Reveal on scroll
  var items = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    items.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  // Sticky entry button (mobile): show after the hero, hide over the entry section
  var sticky = document.querySelector('.sticky-entry');
  var hero = document.querySelector('.hero');
  var entry = document.getElementById('entry');
  if (sticky && hero && entry && 'IntersectionObserver' in window) {
    var heroVisible = true;
    var entryVisible = false;
    var update = function () { sticky.classList.toggle('is-visible', !heroVisible && !entryVisible); };
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(function (e) { entryVisible = e[0].isIntersecting; update(); }).observe(entry);
  }
})();
