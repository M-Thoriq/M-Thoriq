/* hero-type.js
 * Headline "terdekode" dari glyph ASCII (set yang sama dengan shader di latar: # * + = : .) menjadi teks aslinya,
 * dari kiri ke kanan. Teks tidak diubah dan tata letak tidak bergeser: setiap huruf dikunci pada lebar aslinya
 * (diukur dari layout asli, jadi kerning ikut terjaga). Setelah selesai, teks asli dikembalikan apa adanya.
 *
 * Pembaca layar membaca teks utuh lewat aria-label selama efek berjalan. Dengan prefers-reduced-motion
 * efek dilewati dan teks langsung tampil.
 * Dipanggil dari animations.js (timeline hero): HeroType.scramble('.hero-copy h1')
 */
(() => {
  'use strict';

  const GLYPHS = '#*+=:.';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const SETTLE_START = 380;   // ms sebelum huruf pertama menetap
  const SETTLE_TOTAL = 950;   // ms total untuk seluruh huruf (teks panjang tidak boleh lebih lambat dari ini)
  const SETTLE_STEP_MAX = 34; // jeda antar huruf untuk teks pendek
  const SWAP_MS = 55;         // seberapa sering glyph acak berganti

  const rand = (i, step) => {
    const x = Math.sin(i * 12.9898 + step * 78.233) * 43758.5453;
    return GLYPHS[Math.floor((x - Math.floor(x)) * GLYPHS.length)];
  };

  async function scramble(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el || reduce.matches || el.dataset.scrambling) return;
    if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;   // hanya teks polos

    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* abaikan */ } }

    const node = el.firstChild;
    const text = node.nodeValue;
    el.dataset.scrambling = '1';

    // Ukur lebar tiap huruf dari layout asli
    const range = document.createRange();
    const widths = [];
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      widths.push(range.getBoundingClientRect().width);
    }

    // Bangun ulang: kata = inline-block tanpa pemenggalan, huruf = inline-block selebar aslinya
    const frag = document.createDocumentFragment();
    const chars = [];
    let word = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        word = null;
        frag.append(document.createTextNode(ch));
        continue;
      }
      if (!word) {
        word = document.createElement('span');
        word.className = 'ht-word';
        word.setAttribute('aria-hidden', 'true');
        frag.append(word);
      }
      const s = document.createElement('span');
      s.className = 'ht-ch is-scrambling';
      s.style.width = widths[i] + 'px';
      s.textContent = rand(i, 0);
      word.append(s);
      chars.push({ s, ch, i, settleAt: 0, done: false });
    }
    const step = Math.min(SETTLE_STEP_MAX, SETTLE_TOTAL / Math.max(chars.length, 1));
    chars.forEach((c, n) => { c.settleAt = SETTLE_START + n * step; });
    el.setAttribute('aria-label', text);
    el.replaceChildren(frag);

    const t0 = performance.now();
    await new Promise(resolve => {
      (function frame(now) {
        const t = now - t0;
        let pending = 0;
        for (const c of chars) {
          if (c.done) continue;
          if (t >= c.settleAt) {
            c.done = true;
            c.s.textContent = c.ch;
            c.s.classList.remove('is-scrambling');
          } else {
            pending++;
            c.s.textContent = rand(c.i, Math.floor(t / SWAP_MS));
          }
        }
        if (pending) requestAnimationFrame(frame); else resolve();
      })(t0);
    });

    // Kembalikan teks asli
    await new Promise(r => setTimeout(r, 220));
    el.replaceChildren(node);
    el.removeAttribute('aria-label');
    delete el.dataset.scrambling;
  }

  window.HeroType = { scramble };
})();
