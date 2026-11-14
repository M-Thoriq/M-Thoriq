/* work.js
 * Interaksi section Work:
 *  1. Pratinjau yang mengikuti kursor (hanya mouse + layar lebar)
 *  2. Jendela studi kasus (dialog modal) dengan transisi clip-path dari baris yang diklik
 *  3. Tombol back/Escape/panah, fokus dikembalikan ke baris saat ditutup
 * Konten diambil dari HTML: <li.work-item> untuk index, <template id="case-..."> untuk detail.
 */
(() => {
  'use strict';

  const index = document.getElementById('workIndex');
  const caseEl = document.getElementById('case');
  const preview = document.getElementById('workPreview');
  if (!index || !caseEl || !preview) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const previewMode = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 1025px)');
  const animated = () => typeof gsap !== 'undefined' && !reduceMotion.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- data dari HTML ---------- */
  const rows = [...index.querySelectorAll('.work-row')];
  const items = rows.map(row => ({
    id: row.dataset.case,
    row,
    li: row.closest('.work-item'),
    title: row.querySelector('.roll')?.dataset.text || row.textContent.trim(),
    color: getComputedStyle(row).getPropertyValue('--case-bg').trim() || '#c1d7ef',
    tpl: document.getElementById('case-' + row.dataset.case),
    cover: null,
  }));

  /* =====================================================
     1. PRATINJAU YANG MENGIKUTI KURSOR
     ===================================================== */
  const stack = preview.querySelector('.work-preview__stack');
  items.forEach(it => {
    const src = it.row.querySelector('.work-cover');
    if (!src) return;
    it.cover = src.cloneNode(true);
    stack.append(it.cover);
  });

  const st = { x: 0, y: 0, tx: 0, ty: 0, rot: 0, w: 0, h: 0, on: false, raf: 0 };

  function measure() {
    st.w = preview.offsetWidth;
    st.h = preview.offsetHeight;
  }

  function tick() {
    const ease = reduceMotion.matches ? 1 : 0.16;
    const vx = st.tx - st.x;
    st.x += vx * ease;
    st.y += (st.ty - st.y) * ease;
    // Kemiringan mengikuti kecepatan horizontal, seperti kartu yang diseret
    const target = reduceMotion.matches ? 0 : clamp(vx * 0.07, -9, 9);
    st.rot += (target - st.rot) * 0.12;
    preview.style.transform =
      `translate3d(${(st.x - st.w / 2).toFixed(1)}px, ${(st.y - st.h / 2).toFixed(1)}px, 0) rotate(${st.rot.toFixed(2)}deg)`;
    const settled = Math.abs(st.tx - st.x) < 0.3 && Math.abs(st.ty - st.y) < 0.3 && Math.abs(st.rot) < 0.05;
    st.raf = (st.on || !settled) ? requestAnimationFrame(tick) : 0;
  }

  function showPreview(it, x, y) {
    if (!st.on) { st.x = st.tx = x; st.y = st.ty = y; measure(); }
    st.on = true;
    items.forEach(o => {
      o.cover?.classList.toggle('is-active', o === it);
      o.li.classList.toggle('is-active', o === it);
    });
    index.classList.add('is-hovering');
    preview.classList.add('is-visible');
    if (!st.raf) st.raf = requestAnimationFrame(tick);
  }

  function hidePreview() {
    st.on = false;
    index.classList.remove('is-hovering');
    preview.classList.remove('is-visible');
    items.forEach(o => {
      o.cover?.classList.remove('is-active');
      o.li.classList.remove('is-active');
    });
  }

  items.forEach(it => {
    const { row } = it;
    row.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse' || !previewMode.matches) return;
      showPreview(it, e.clientX, e.clientY);
    });
    row.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !previewMode.matches) return;
      st.tx = e.clientX; st.ty = e.clientY;
      // Setelah scroll, preview disembunyikan; pointermove berikutnya memunculkannya lagi
      if (!st.on || !it.li.classList.contains('is-active')) showPreview(it, e.clientX, e.clientY);
    });
    row.addEventListener('pointerleave', hidePreview);
    // Pengguna keyboard: pratinjau muncul di sisi kanan baris yang difokus
    row.addEventListener('focus', () => {
      if (!previewMode.matches || !row.matches(':focus-visible')) return;
      const r = row.getBoundingClientRect();
      showPreview(it, r.right - r.width * 0.28, r.top + r.height / 2);
      st.tx = st.x; st.ty = st.y;
    });
    row.addEventListener('blur', hidePreview);
    row.addEventListener('click', () => openCase(items.indexOf(it), row));
  });

  addEventListener('scroll', () => { if (st.on) hidePreview(); }, { passive: true });
  addEventListener('resize', () => { measure(); if (!previewMode.matches) hidePreview(); });

  /* =====================================================
     2. JENDELA STUDI KASUS
     ===================================================== */
  const content = caseEl.querySelector('.case__content');
  const scroller = caseEl.querySelector('.case__scroll');
  const tabTitle = caseEl.querySelector('#caseTitle');
  const closeBtn = caseEl.querySelector('.case__close');
  const nextBtn = caseEl.querySelector('.case__next');
  const nextTitle = caseEl.querySelector('.case__next-title');
  const count = caseEl.querySelector('.case__count');

  let current = -1;
  let trigger = null;
  let pushed = false;
  let busy = false;

  const isOpen = () => !caseEl.hidden;

  // Semua elemen lain di <body> dinonaktifkan agar fokus keyboard dan pembaca layar tetap di dalam dialog
  function setInert(on) {
    [...document.body.children].forEach(el => {
      if (el === caseEl || /^(SCRIPT|TEMPLATE|LINK|STYLE)$/.test(el.tagName)) return;
      el.inert = on;
    });
  }

  // Menghitung inset() yang sama dengan kotak sebuah elemen, untuk animasi buka/tutup
  function insetFor(el) {
    const r = el.getBoundingClientRect();
    const t = clamp(r.top, 0, innerHeight), l = clamp(r.left, 0, innerWidth);
    const b = clamp(innerHeight - r.bottom, 0, innerHeight), rt = clamp(innerWidth - r.right, 0, innerWidth);
    return `inset(${t}px ${rt}px ${b}px ${l}px round 24px)`;
  }

  function fill(i) {
    const it = items[i];
    current = i;
    content.replaceChildren(it.tpl ? it.tpl.content.cloneNode(true) : document.createTextNode(''));

    const nextIt = items[(i + 1) % items.length];
    const footer = document.createElement('button');
    footer.type = 'button';
    footer.className = 'case-next';
    footer.innerHTML = '<span class="case-next__label">Next project</span><span class="case-next__title"></span>';
    footer.querySelector('.case-next__title').textContent = nextIt.title;
    footer.addEventListener('click', () => go(1));
    content.append(footer);

    tabTitle.textContent = it.title;
    nextTitle.textContent = nextIt.title;
    count.textContent = `${pad(i + 1)} / ${pad(items.length)}`;
    caseEl.style.setProperty('--case-bg', it.color);
    scroller.scrollTop = 0;
    nextBtn.hidden = items.length < 2;
  }

  const enterTargets = () => content.querySelectorAll(
    '.case-hero__text > *, .case-hero__media, .case-meta > *, .case-block, .case-next');

  function openCase(i, from) {
    if (isOpen() || busy) return;
    hidePreview();
    trigger = from;
    fill(i);
    caseEl.hidden = false;
    document.documentElement.classList.add('has-case');
    setInert(true);
    history.pushState({ workCase: items[i].id }, '');
    pushed = true;

    if (animated()) {
      busy = true;
      gsap.killTweensOf(caseEl);
      gsap.fromTo(caseEl,
        { clipPath: insetFor(from) },
        {
          clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.95, ease: 'power4.inOut',
          onComplete() { gsap.set(caseEl, { clearProps: 'clipPath' }); busy = false; }
        });
      gsap.from(enterTargets(), {
        y: 48, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out', delay: 0.5,
        clearProps: 'transform,opacity'
      });
    }
    closeBtn.focus({ preventScroll: true });
  }

  function finishClose() {
    caseEl.hidden = true;
    document.documentElement.classList.remove('has-case');
    setInert(false);
    pushed = false;
    busy = false;
    const row = items[current]?.row || trigger;
    row?.focus({ preventScroll: true });
  }

  function doClose() {
    if (!isOpen()) return;
    const row = items[current]?.row || trigger;
    // Jika yang dibuka sudah berganti lewat "Next", pastikan barisnya terlihat sebelum menutup
    const r = row.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) row.scrollIntoView({ block: 'center', behavior: 'instant' });

    if (animated()) {
      busy = true;
      gsap.killTweensOf(caseEl);
      gsap.to(caseEl, {
        clipPath: insetFor(row), duration: 0.75, ease: 'power4.inOut',
        onComplete() { gsap.set(caseEl, { clearProps: 'clipPath' }); finishClose(); }
      });
    } else {
      finishClose();
    }
  }

  // Tombol Back di HP menutup jendela, bukan keluar dari halaman
  function requestClose() {
    if (!isOpen() || busy) return;
    if (pushed && history.state && history.state.workCase) history.back();
    else doClose();
  }

  function go(step) {
    if (!isOpen() || busy) return;
    const next = (current + step + items.length) % items.length;
    const swap = () => {
      fill(next);
      history.replaceState({ workCase: items[next].id }, '');
      if (animated()) {
        gsap.from(enterTargets(), {
          y: 36, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity'
        });
      }
    };
    if (animated()) {
      busy = true;
      gsap.to(content, {
        opacity: 0, y: -16, duration: 0.25, ease: 'power2.in',
        onComplete() { swap(); gsap.set(content, { clearProps: 'opacity,transform' }); busy = false; }
      });
    } else {
      swap();
    }
  }

  closeBtn.addEventListener('click', requestClose);
  nextBtn.addEventListener('click', () => go(1));
  addEventListener('popstate', () => { if (isOpen()) doClose(); });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); requestClose(); }
    else if (e.key === 'ArrowRight' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) go(1);
    else if (e.key === 'ArrowLeft' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) go(-1);
  });
})();
