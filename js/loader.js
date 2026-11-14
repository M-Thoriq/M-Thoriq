/* loader.js
 * Layar loading untuk kunjungan pertama dalam satu sesi (sessionStorage).
 * Menunggu aset yang benar-benar dipakai: font, semua <img>, dan video hero (+ shader jika WebGPU ada).
 * Angka persentase = progres nyata, dengan batas minimum tampil dan batas maksimum menunggu.
 * Animasi keluar murni CSS; setelah loader mulai terbuka dikirim event "loader:done"
 * agar animasi masuk hero (animations.js) mulai tepat waktu.
 */
(() => {
  'use strict';

  const html = document.documentElement;
  const loader = document.getElementById('loader');
  if (!loader || !html.classList.contains('is-loading')) { loader?.remove(); return; }

  const MIN_MS = 1200;   // tampil minimal, agar tidak berkedip saat aset sudah ada di cache
  const MAX_MS = 8000;   // jangan pernah menahan pengunjung lebih lama dari ini
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const numEl = loader.querySelector('.loader__num');
  const barEl = loader.querySelector('.loader__bar');
  const t0 = performance.now();
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- daftar aset yang ditunggu ---------- */
  const tasks = [];
  function track(promise, weight = 1) {
    const t = { weight, done: false };
    tasks.push(t);
    const done = () => { t.done = true; };
    Promise.resolve(promise).then(done, done);
  }

  // Font
  const fontsP = (document.fonts && document.fonts.load)
    ? Promise.all([
      document.fonts.load('600 16px Manrope'),
      document.fonts.load('400 16px Manrope'),
      document.fonts.load('400 16px Inter'),
    ]).then(() => document.fonts.ready)
    : Promise.resolve();
  track(fontsP);
  // Teks loader baru ditampilkan setelah font siap (maks 700ms) supaya tidak ada pergantian font yang terlihat
  Promise.race([fontsP, wait(700)]).then(() => loader.classList.add('is-ready'));

  // Semua gambar yang ada di dokumen (gambar di dalam <template> baru dimuat saat dibuka, jadi tidak ikut)
  [...document.images].forEach(img => {
    track(new Promise(res => {
      if (img.complete) return res();
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    }));
  });

  // Video hero, lalu beri waktu singkat agar shader WebGPU selesai terpasang
  const video = document.querySelector('.hero-bg video');
  if (video) {
    const videoReady = new Promise(res => {
      if (video.readyState >= 3) return res();
      video.addEventListener('canplay', res, { once: true });
      video.addEventListener('error', res, { once: true });
    });
    const shaderReady = () => new Promise(res => {
      if (!navigator.gpu || typeof ShaderFX === 'undefined') return res();
      const s = performance.now();
      (function poll() {
        if (ShaderFX.has(video) || performance.now() - s > 1500) return res();
        setTimeout(poll, 60);
      })();
    });
    // Di beberapa browser mobile video tidak memuat sebelum diputar; jangan tahan loader lebih dari 4 detik
    track(Promise.race([videoReady, wait(4000)]).then(shaderReady), 2);
  }

  /* ---------- progres yang ditampilkan ---------- */
  function realProgress() {
    let w = 0, d = 0;
    tasks.forEach(t => { w += t.weight; if (t.done) d += t.weight; });
    return w ? d / w : 1;
  }

  function render(p) {
    numEl.textContent = Math.round(p * 100);
    barEl.style.transform = `scaleX(${p})`;
  }

  let shown = 0;
  let finished = false;

  function frame(now) {
    const elapsed = now - t0;
    // Angka tidak pernah mendahului progres nyata maupun waktu minimum
    const cap = Math.min(realProgress(), elapsed / MIN_MS);
    shown += (cap - shown) * (reduce ? 1 : 0.12);
    if (cap >= 1 && shown > 0.995) shown = 1;
    render(shown);
    if (shown >= 1 || elapsed > MAX_MS) finish();
    else requestAnimationFrame(frame);
  }

  function finish() {
    if (finished) return;
    finished = true;
    render(1);
    const leave = reduce ? 400 : 1600;
    const reveal = reduce ? 0 : 500;
    setTimeout(() => {
      html.classList.add('loader-leaving');
      setTimeout(() => document.dispatchEvent(new CustomEvent('loader:done')), reveal);
      setTimeout(cleanup, leave);
    }, reduce ? 0 : 250);
  }

  function cleanup() {
    html.classList.remove('is-loading', 'loader-leaving');
    try { sessionStorage.setItem('siteLoaded', '1'); } catch (e) { /* mode privat: loader tampil lagi di kunjungan berikutnya */ }
    loader.remove();
  }

  requestAnimationFrame(frame);
})();
