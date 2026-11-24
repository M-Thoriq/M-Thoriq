/* curtain.js
 * Curtain reveal: hero ter-scroll naik seperti tirai, sementara section About sudah menunggu diam di belakangnya.
 *
 * Cara kerja (CSS di style.css, blok CURTAIN REVEAL):
 *  - About ditarik ke atas sebesar tinggi hero (margin-top negatif) dan di-pin dengan position: sticky; top: 0.
 *  - Hero berada di lapisan lebih atas (z-index 2).
 *  - Elemen .curtain__spacer menambah tinggi pembungkus sebesar tinggi hero, sehingga About tetap diam selama
 *    hero menggulir keluar, lalu menggulir normal setelahnya (tanpa celah dengan section Work).
 *
 * Tinggi hero tidak tetap (min-height 100svh, bisa lebih tinggi di HP), jadi nilainya disimpan di --hero-h
 * dan diperbarui lewat ResizeObserver. Efek hanya aktif jika JS berjalan dan pengguna tidak meminta
 * prefers-reduced-motion; selain itu halaman tetap berupa alur normal (hero lalu About).
 */
(() => {
  'use strict';

  const wrap = document.querySelector('.curtain');
  const hero = document.getElementById('home');
  const about = document.getElementById('about');
  if (!wrap || !hero || !about) return;
  // Rollback cepat: <div class="curtain" data-curtain="off"> mematikan efek (halaman kembali ke alur normal)
  if (wrap.dataset.curtain === 'off') return;

  const motionOK = matchMedia('(prefers-reduced-motion: no-preference)');
  let on = false;
  let refreshTimer = 0;

  function apply() {
    on = motionOK.matches;
    wrap.classList.toggle('is-curtain', on);
    wrap.style.setProperty('--hero-h', on ? hero.offsetHeight + 'px' : '0px');
  }
  apply();

  new ResizeObserver(() => {
    const before = wrap.style.getPropertyValue('--hero-h');
    apply();
    if (wrap.style.getPropertyValue('--hero-h') !== before) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { if (window.ScrollTrigger) ScrollTrigger.refresh(); }, 120);
    }
  }).observe(hero);
  motionOK.addEventListener('change', apply);

  // Karena About di-pin, posisi "alaminya" selalu 0 sehingga lompat ke #about lewat scrollIntoView/anchor tidak bergerak.
  // Tujuan yang benar adalah saat hero sudah sepenuhnya terangkat: scrollY = tinggi hero.
  const anchorTop = target => (on && target === about) ? hero.offsetHeight : null;

  document.addEventListener('click', e => {
    if (e.defaultPrevented || !on) return;
    const a = e.target.closest('a[href="#about"]');
    if (!a) return;
    e.preventDefault();
    window.scrollTo({ top: hero.offsetHeight, behavior: 'smooth' });
  });

  if (on && location.hash === '#about') {
    requestAnimationFrame(() => window.scrollTo({ top: hero.offsetHeight, behavior: 'instant' }));
  }

  window.CurtainReveal = { anchorTop };
})();
