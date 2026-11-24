/* ===================================================================
   js/smooth.js : GSAP ScrollSmoother
   - Dimuat SEBELUM animations.js dan script lain yang membuat ScrollTrigger.
   - Parallax objek: tambahkan data-speed="0.8" (lebih lambat) / "1.2" (lebih cepat)
     atau data-lag="0.4" pada elemen DI DALAM #smooth-content.
   =================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || !window.gsap || !window.ScrollTrigger || !window.ScrollSmoother) return;
  if (!document.getElementById('smooth-wrapper')) return;

  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

  var smoother = ScrollSmoother.create({
    wrapper: '#smooth-wrapper',
    content: '#smooth-content',
    smooth: 1.2,          // detik "ketertinggalan" scroll; naikkan = lebih licin
    effects: true,        // mengaktifkan data-speed / data-lag
    smoothTouch: false    // layar sentuh tetap scroll native (lebih responsif)
  });

  root.classList.add('has-smoother');
  window.smoother = smoother;

  /* ---------- Pause saat loader / menu mobile / jendela case terbuka ---------- */
  function syncPause() {
    var loading = root.classList.contains('is-loading');
    var nav = document.getElementById('mobileNav');
    var navOpen = nav && !nav.hasAttribute('inert');
    var cs = document.getElementById('case');
    var caseOpen = cs && !cs.hidden;
    smoother.paused(!!(loading || navOpen || caseOpen));
  }
  var mo = new MutationObserver(syncPause);
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  ['mobileNav', 'case'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) mo.observe(el, { attributes: true, attributeFilter: ['inert', 'hidden'] });
  });
  syncPause();

  /* ---------- Efek curtain: pin .about lewat ScrollTrigger ----------
     position: sticky tidak jalan di dalam #smooth-content (CSS-nya sudah dinetralkan
     lewat html.has-smoother). Hero terangkat selama tinggi hero, About menunggu di tempat. */
  var curtainST = null;
  function heroHeight() {
    var hero = document.querySelector('.curtain .section-intro');
    return hero ? hero.offsetHeight : 0;
  }
  function setupCurtain() {
    var curtain = document.querySelector('.curtain.is-curtain');
    var about = curtain && curtain.querySelector('.about');
    if (!about || curtainST) return !!curtainST;
    curtainST = ScrollTrigger.create({
      trigger: curtain,
      start: 'top top',
      end: function () { return '+=' + heroHeight(); },
      pin: about,
      pinSpacing: false,
      anticipatePin: 1,
      invalidateOnRefresh: true
    });
    return true;
  }
  // curtain.js dimuat setelah file ini, jadi tunggu sampai kelas .is-curtain terpasang
  function waitCurtain() {
    var curtain = document.querySelector('.curtain');
    if (!curtain) return;
    if (setupCurtain()) return;
    var cmo = new MutationObserver(function () {
      if (setupCurtain()) cmo.disconnect();
    });
    cmo.observe(curtain, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('DOMContentLoaded', waitCurtain);
  window.addEventListener('load', function () {
    waitCurtain();
    ScrollTrigger.refresh();
  });

  /* ---------- Link anchor (#work, #about, ...) ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (!hash || hash === '#') return;
    var target = document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    smoother.paused(false); // link dari menu mobile: pastikan scrollTo tidak tertahan status pause

    if (hash === '#home') {
      smoother.scrollTo(0, true);
    } else if (hash === '#about' && curtainST) {
      // About sedang di-pin: tujuannya adalah titik saat hero baru saja terangkat penuh
      smoother.scrollTo(heroHeight(), true);
    } else {
      smoother.scrollTo(target, true, 'top top');
    }
    if (history.replaceState) history.replaceState(null, '', hash);
  });
})();
