/* about-canvas.js
 * Membuat section About terasa seperti kanvas Figma yang hidup:
 *  1. Latar titik-titik (dot grid) dengan sorotan yang mengikuti kursor (hanya mouse)
 *  2. Outline biru + label "W x H" saat kursor berada di atas judul, paragraf, poster, atau tab (seperti hover di Figma)
 * Tidak ada teks baru: label hanya berisi ukuran elemen dalam piksel.
 * Tidak aktif di layar sentuh. Mematikan: hapus script ini; CSS titik-titik tetap tampil sebagai dekorasi statis.
 */
(() => {
  'use strict';

  const about = document.getElementById('about');
  if (!about) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- 1. Sorotan dot grid ---------- */
  let mx = -999, my = -999, raf = 0;
  const flush = () => {
    raf = 0;
    about.style.setProperty('--mx', mx + 'px');
    about.style.setProperty('--my', my + 'px');
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(flush); };

  /* ---------- 2. Outline hover bergaya Figma ---------- */
  const TARGETS = [
    ['.about__title', 'text'],   // mode "text": kotak mengikuti teks (hug), bukan lebar kolom
    ['.about__text', 'text'],
    ['.poster', 'box'],
    ['.tabs', 'box'],
  ];

  const box = document.createElement('div');
  box.className = 'fig-hover';
  box.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.className = 'fig-hover__label';
  box.append(label);
  about.append(box);

  let current = null;

  function rectFor(el, mode) {
    if (mode === 'text') {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    }
    return el.getBoundingClientRect();
  }

  function show(el, mode) {
    if (el === current) return;
    current = el;
    const a = about.getBoundingClientRect();
    const r = rectFor(el, mode);
    const pad = 3;
    box.style.width = Math.round(r.width + pad * 2) + 'px';
    box.style.height = Math.round(r.height + pad * 2) + 'px';
    box.style.transform = `translate(${Math.round(r.left - a.left - pad)}px, ${Math.round(r.top - a.top - pad)}px)`;
    label.textContent = `${Math.round(r.width)} \u00d7 ${Math.round(r.height)}`;
    box.classList.add('is-visible');
  }

  function hide() {
    current = null;
    box.classList.remove('is-visible');
  }

  about.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    for (const [sel, mode] of TARGETS) {
      const el = e.target.closest(sel);
      if (el && about.contains(el)) { show(el, mode); return; }
    }
    hide();
  });

  about.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !fine.matches) return;
    const r = about.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;
    schedule();
  }, { passive: true });

  about.addEventListener('pointerleave', () => {
    mx = my = -999;
    schedule();
    hide();
  });

  // Tata letak berubah: kotak lama tidak valid lagi
  addEventListener('resize', hide);
})();
