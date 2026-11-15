/* hero-play.js
 * Kartu dan stiker di hero bisa diseret seperti benda di meja: ikut miring sesuai kecepatan,
 * meluncur dengan inersia, memantul di tepi area, dan yang disentuh naik ke depan.
 * Murni mainan: tidak membuka apa pun dan tidak mengubah isi halaman.
 *
 * Cara kerja: tiap elemen dibungkus <div class="hp-layer"> saat dimuat. Pembungkus itu yang digeser,
 * sedangkan elemen di dalamnya tetap dipegang animasi masuk dan float milik GSAP, jadi keduanya
 * tidak berebut properti transform.
 *
 * Mematikan fitur: ubah data-hero-play="on" menjadi "off" pada <section id="home">.
 * Menautkan kartu ke proyek nanti: beri atribut data-open-case="id-proyek" pada kartu;
 * klik tanpa geser akan mengirim event "hero:open-case" (detail: { id, from }).
 */
(() => {
  'use strict';

  const home = document.getElementById('home');
  const area = home && home.querySelector('.hero-preview');
  if (!home || !area || home.dataset.heroPlay === 'off') return;

  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const DRAG_THRESHOLD = 6;     // px sebelum gerakan dianggap seret, bukan klik
  const FRICTION_MS = 230;      // konstanta waktu peluruhan inersia
  const BOUNCE = 0.5;           // sisa kecepatan setelah memantul di tepi

  // group "card": dua kartu bergantian di depan. group "sticker": selalu di atas kartu.
  const DEFS = [
    { sel: '.identity-card', group: 'card' },
    { sel: '.product-card', group: 'card' },
    { sel: '.pencil-decoration', group: 'sticker' },
    { sel: '.star-decoration', group: 'sticker' },
  ];

  let ready = false;
  let interacted = false;
  let raf = 0;
  let lastT = 0;
  let cardZ = 3;

  const items = DEFS.map(d => {
    const el = area.querySelector(d.sel);
    if (!el) return null;
    const baseZ = parseInt(getComputedStyle(el).zIndex, 10) || 1;
    const layer = document.createElement('div');
    layer.className = 'hp-layer';
    layer.style.zIndex = String(baseZ);
    el.before(layer);
    layer.append(el);
    el.querySelectorAll('img').forEach(img => { img.draggable = false; });
    return {
      el, layer, sel: d.sel, group: d.group, baseZ,
      x: 0, y: 0, vx: 0, vy: 0, tilt: 0, scale: 1,
      minX: 0, maxX: 0, minY: 0, maxY: 0,
      pid: null, sx: 0, sy: 0, ox: 0, oy: 0,
      moved: false, down: false, inertia: false, samples: [],
    };
  }).filter(Boolean);
  if (!items.length) return;

  // Badge "Concept project / Soft spot" menempel pada poster: ikut bergerak seperti satu benda
  const posterItem = items.find(o => o.sel === '.identity-card');
  const badgeEl = area.querySelector('.concept-badge');
  let badgeLayer = null;
  if (posterItem && badgeEl) {
    badgeLayer = document.createElement('div');
    badgeLayer.className = 'hp-layer hp-layer--follow';
    badgeLayer.style.zIndex = String(parseInt(getComputedStyle(badgeEl).zIndex, 10) || 4);
    badgeEl.before(badgeLayer);
    badgeLayer.append(badgeEl);
  }
  const setOrigin = it => {
    const o = `${it.el.offsetLeft + it.el.offsetWidth / 2}px ${it.el.offsetTop + it.el.offsetHeight / 2}px`;
    it.layer.style.transformOrigin = o;
    if (it === posterItem && badgeLayer) badgeLayer.style.transformOrigin = o;
  };

  const enabled = () =>
    ready && !html.classList.contains('is-loading') &&
    !html.classList.contains('has-menu') && !html.classList.contains('has-case');

  /* ---------- batas area ---------- */
  // Rentang geser yang menjaga kotak elemen tetap di dalam area (diperluas sedikit agar terasa bebas)
  function computeBounds(it) {
    const a = area.getBoundingClientRect();
    const r = it.el.getBoundingClientRect();     // sudah termasuk posisi geser saat ini
    const m = a.width > 520 ? 70 : 24;
    it.minX = it.x + (a.left - m - r.left);
    it.maxX = it.x + (a.right + m - r.right);
    it.minY = it.y + (a.top - m - r.top);
    it.maxY = it.y + (a.bottom + m - r.bottom);
    if (it.minX > it.maxX) it.minX = it.maxX = it.x;
    if (it.minY > it.maxY) it.minY = it.maxY = it.y;
  }

  /* ---------- render ---------- */
  function paint(it) {
    const t = `translate3d(${it.x.toFixed(2)}px, ${it.y.toFixed(2)}px, 0) rotate(${it.tilt.toFixed(2)}deg) scale(${it.scale.toFixed(3)})`;
    it.layer.style.transform = t;
    if (it === posterItem && badgeLayer) badgeLayer.style.transform = t;
  }

  function bringToFront(it) {
    if (it.group === 'card') {
      items.forEach(o => { if (o.group === 'card') o.layer.style.zIndex = String(o === it ? cardZ : cardZ - 1); });
    } else {
      const top = Math.max(...items.filter(o => o.group === 'sticker').map(o => +o.layer.style.zIndex));
      if (+it.layer.style.zIndex < top) it.layer.style.zIndex = String(top + 1);
    }
  }

  function step(t) {
    const dt = Math.min(48, t - (lastT || t));
    lastT = t;
    let active = false;

    items.forEach(it => {
      const grabbed = it.down && it.moved;

      // inersia setelah dilepas
      if (it.inertia) {
        const k = Math.exp(-dt / FRICTION_MS);
        it.vx *= k; it.vy *= k;
        it.x += it.vx * dt; it.y += it.vy * dt;
        if (it.x < it.minX) { it.x = it.minX; it.vx = Math.abs(it.vx) * BOUNCE; }
        else if (it.x > it.maxX) { it.x = it.maxX; it.vx = -Math.abs(it.vx) * BOUNCE; }
        if (it.y < it.minY) { it.y = it.minY; it.vy = Math.abs(it.vy) * BOUNCE; }
        else if (it.y > it.maxY) { it.y = it.maxY; it.vy = -Math.abs(it.vy) * BOUNCE; }
        if (Math.hypot(it.vx, it.vy) < 0.02) { it.inertia = false; it.vx = it.vy = 0; }
      }

      // miring mengikuti kecepatan, kembali tegak saat diam; sedikit membesar saat dipegang
      const tiltTarget = reduce.matches ? 0 : clamp(it.vx * 7, -9, 9);
      const scaleTarget = grabbed && !reduce.matches ? 1.04 : 1;
      const s = 1 - Math.exp(-dt / 90);
      it.tilt += (tiltTarget - it.tilt) * s;
      it.scale += (scaleTarget - it.scale) * s;

      const settled = !it.inertia && !grabbed && Math.abs(it.tilt) < 0.05 && Math.abs(it.scale - 1) < 0.002;
      if (settled) { it.tilt = 0; it.scale = 1; }
      else active = true;
      paint(it);
    });

    raf = active ? requestAnimationFrame(step) : 0;
    if (!active) lastT = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };

  /* ---------- pointer ---------- */
  function onDown(e, it) {
    if (!enabled() || it.down) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    interacted = true;
    it.down = true; it.moved = false; it.inertia = false; it.vx = it.vy = 0;
    it.pid = e.pointerId; it.sx = e.clientX; it.sy = e.clientY; it.ox = it.x; it.oy = it.y;
    it.samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    setOrigin(it);   // titik putar miring = tengah elemen itu sendiri
    computeBounds(it);
    bringToFront(it);
    try { it.el.setPointerCapture(e.pointerId); } catch (err) { /* pointer sudah dilepas */ }
  }

  function onMove(e, it) {
    if (!it.down || e.pointerId !== it.pid) return;
    const dx = e.clientX - it.sx, dy = e.clientY - it.sy;
    if (!it.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      // Sentuhan: gerakan yang dimulai vertikal adalah scroll halaman (browser akan membatalkan pointer),
      // jangan sempat menggeser kartu sedikit pun.
      if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) return;
      it.moved = true;
      it.layer.classList.add('is-dragging');
    }
    it.x = clamp(it.ox + dx, it.minX, it.maxX);
    it.y = clamp(it.oy + dy, it.minY, it.maxY);
    it.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    while (it.samples.length > 2 && e.timeStamp - it.samples[0].t > 100) it.samples.shift();
    // kecepatan sesaat (px/ms) hanya untuk kemiringan; kecepatan lepas dihitung saat pointerup
    const a = it.samples[0], b = it.samples[it.samples.length - 1];
    const span = Math.max(1, b.t - a.t);
    it.vx = (b.x - a.x) / span; it.vy = (b.y - a.y) / span;
    kick();
  }

  function onUp(e, it, cancelled) {
    if (!it.down || e.pointerId !== it.pid) return;
    it.down = false;
    it.layer.classList.remove('is-dragging');
    if (it.moved && !cancelled && !reduce.matches) {
      const a = it.samples[0], b = it.samples[it.samples.length - 1];
      const span = Math.max(1, b.t - a.t);
      // jika jari berhenti sebelum dilepas, tidak ada inersia
      const idle = e.timeStamp - b.t > 80;
      it.vx = idle ? 0 : (b.x - a.x) / span;
      it.vy = idle ? 0 : (b.y - a.y) / span;
      it.inertia = Math.hypot(it.vx, it.vy) > 0.05;
    } else {
      it.vx = it.vy = 0; it.inertia = false;
    }
    if (!it.moved && !cancelled && it.el.dataset.openCase) {
      document.dispatchEvent(new CustomEvent('hero:open-case', { detail: { id: it.el.dataset.openCase, from: it.el } }));
    }
    kick();
  }

  items.forEach(it => {
    it.el.addEventListener('pointerdown', e => onDown(e, it));
    it.el.addEventListener('pointermove', e => onMove(e, it));
    it.el.addEventListener('pointerup', e => onUp(e, it, false));
    it.el.addEventListener('pointercancel', e => onUp(e, it, true));
    it.el.addEventListener('lostpointercapture', e => onUp(e, it, true));
    // Gambar/teks tidak boleh ikut terseret oleh browser
    it.el.addEventListener('dragstart', e => e.preventDefault());
  });

  // Jika layout berubah (rotasi layar, resize), kembalikan semua ke posisi awal
  let lastW = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    items.forEach(it => { it.x = it.y = it.vx = it.vy = 0; it.inertia = false; paint(it); });
  });

  /* ---------- petunjuk tanpa teks: satu goyangan kecil setelah idle ---------- */
  function scheduleHint() {
    if (reduce.matches || !items[0].layer.animate) return;
    setTimeout(() => {
      if (interacted || document.hidden || !enabled()) return;
      const it = posterItem || items.find(o => o.group === 'card');
      setOrigin(it);
      const wiggle = [{ rotate: '0deg' }, { rotate: '-3deg' }, { rotate: '2deg' }, { rotate: '-1deg' }, { rotate: '0deg' }];
      const opts = { duration: 1100, easing: 'ease-in-out' };
      it.layer.animate(wiggle, opts);
      if (it === posterItem && badgeLayer) badgeLayer.animate(wiggle, opts);
    }, 4500);
  }

  /* ---------- kapan boleh diseret ---------- */
  function enable() {
    if (ready) return;
    ready = true;
    scheduleHint();
  }

  // Tunggu animasi masuk hero selesai (animations.js mengirim "hero:ready") agar tidak berebut dengan GSAP.
  // Tanpa GSAP atau dengan reduced-motion tidak ada animasi masuk, cukup tunggu loader.
  const hasEntrance = typeof gsap !== 'undefined' && !reduce.matches;
  if (hasEntrance) {
    document.addEventListener('hero:ready', enable, { once: true });
    setTimeout(enable, 15000);   // pengaman
  } else if (html.classList.contains('is-loading')) {
    document.addEventListener('loader:done', () => setTimeout(enable, 300), { once: true });
    setTimeout(enable, 15000);
  } else {
    enable();
  }
})();
