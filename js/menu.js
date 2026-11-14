/* menu.js
 * Menu mobile layar penuh. Animasinya murni CSS (kelas .is-open); file ini mengurus
 * state, fokus, aksesibilitas, scroll lock, tombol Back, dan lompatan ke anchor.
 */
(() => {
  'use strict';

  const html = document.documentElement;
  const menu = document.getElementById('mobileNav');
  const btn = document.getElementById('menuBtn');
  if (!menu || !btn) return;

  const closeBtn = menu.querySelector('.mnav__close');
  const desktop = matchMedia('(min-width: 769px)');

  let open = false;
  let pushed = false;
  let inerted = [];
  let prevRestoration = 'auto';
  let pendingTarget = null;   // tujuan anchor yang akan di-scroll setelah menu menutup

  // Elemen lain dinonaktifkan selama menu terbuka (fokus keyboard dan pembaca layar tetap di menu).
  // Hanya elemen yang kita ubah yang dikembalikan, supaya tidak menimpa state inert milik script lain.
  function setOthersInert(on) {
    if (on) {
      inerted = [...document.body.children].filter(el =>
        el !== menu && !el.inert && !/^(SCRIPT|TEMPLATE|LINK|STYLE|NOSCRIPT)$/.test(el.tagName));
      inerted.forEach(el => { el.inert = true; });
    } else {
      inerted.forEach(el => { el.inert = false; });
      inerted = [];
    }
  }

  function openMenu() {
    if (open) return;
    open = true;
    menu.inert = false;
    setOthersInert(true);
    btn.setAttribute('aria-expanded', 'true');
    html.classList.add('has-menu');
    menu.classList.add('is-open');
    // Tanpa ini, tombol Back dapat memulihkan posisi scroll entri lama dan menggeser halaman saat menu menutup
    prevRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    history.pushState({ menu: true }, '');
    pushed = true;
    closeBtn.focus({ preventScroll: true });
  }

  function closeMenu({ restoreFocus = true, instant = false } = {}) {
    if (!open) return;
    open = false;
    pushed = false;
    history.scrollRestoration = prevRestoration;
    if (instant) menu.classList.add('is-instant');
    menu.classList.remove('is-open');
    html.classList.remove('has-menu');
    setOthersInert(false);
    menu.inert = true;
    btn.setAttribute('aria-expanded', 'false');
    if (pendingTarget) {
      // Halaman melompat ke tujuan saat masih tertutup tirai; tirai lalu membuka ke posisi baru
      pendingTarget.scrollIntoView({ behavior: 'instant', block: 'start' });
      pendingTarget = null;
    } else if (restoreFocus) {
      btn.focus({ preventScroll: true });
    }
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.remove('is-instant')));
  }

  // Menu selalu menutup lewat history.back() agar entri riwayat yang didorong saat membuka ikut hilang.
  // URL tidak pernah diubah, sehingga tombol Back di HP menutup menu, bukan keluar dari halaman.
  function requestClose(target = null) {
    if (!open) return;
    pendingTarget = target;
    if (pushed && history.state && history.state.menu) {
      history.back();
      setTimeout(() => { if (open) closeMenu(); }, 500);   // pengaman jika popstate tidak datang
    } else {
      closeMenu();
    }
  }

  btn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', () => requestClose());
  addEventListener('popstate', () => { if (open) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (open && e.key === 'Escape') { e.preventDefault(); requestClose(); }
  });

  // Klik tautan: tutup menu, lalu halaman melompat ke tujuan
  menu.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      const target = id.length > 1 && document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      requestClose(target);
    });
  });

  // Jika jendela melebar ke layout desktop saat menu terbuka, tutup tanpa animasi
  desktop.addEventListener('change', e => { if (e.matches && open) closeMenu({ instant: true }); });

  // Kompatibilitas dengan pemanggilan lama
  window.openMobileNav = openMenu;
  window.closeMobileNav = () => requestClose();
})();
