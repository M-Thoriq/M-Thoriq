/* shader-core.js
 * Mendeteksi <img class="..."> atau <video class="..."> lalu menggambar ulang sumbernya
 * di <canvas> WebGPU memakai shader yang terdaftar untuk class tersebut.
 * Satu elemen = satu shader. */
const ShaderFX = (() => {
  const defs = [];
  const instances = new Map();   // elemen -> instance
  let gpuPromise = null;

  const selector = () => defs.map(d => `img.${d.className},video.${d.className}`).join(',');
  const defFor = el => defs.find(d => el.classList.contains(d.className));

  /* ---------- pembaca parameter dari data-attribute ---------- */
  function readNum(el, key, fallback) {
    const raw = el.dataset[key];
    const n = Number(raw);
    return raw !== undefined && raw !== '' && Number.isFinite(n) ? n : fallback;
  }
  function readColor(el, key, fallback) {
    const raw = el.dataset[key];
    if (!raw) return fallback;
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw.trim());
    if (!m) return fallback;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
    const n = i => parseInt(h.slice(i, i + 2), 16) / 255;
    return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
  }

  /* ---------- device GPU (dibagi semua elemen) ---------- */
  function getGpu() {
    if (gpuPromise) return gpuPromise;
    gpuPromise = (async () => {
      if (!navigator.gpu) { console.warn('[fx] WebGPU tidak tersedia di browser ini.'); return null; }
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) { console.warn('[fx] Tidak ada GPU adapter.'); return null; }
      const device = await adapter.requestDevice();
      device.addEventListener('uncapturederror', e => console.error('[fx WebGPU]', e.error.message));
      const format = navigator.gpu.getPreferredCanvasFormat();

      const quad = device.createBuffer({
        size: 6 * 4 * 4, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true,
      });
      new Float32Array(quad.getMappedRange()).set([
        -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0,
        -1, 1, 0, 0, 1, -1, 1, 1, 1, 1, 1, 0,
      ]);
      quad.unmap();

      const sampler = device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
      });
      return { device, format, quad, sampler };
    })();
    return gpuPromise;
  }

  function getPipeline(gpu, def) {
    if (def._pipeline) return def._pipeline;
    const { device, format } = gpu;
    const module = device.createShaderModule({ code: def.wgsl });
    module.getCompilationInfo().then(info => {
      info.messages.forEach(m =>
        console[m.type === 'error' ? 'error' : 'warn']('[fx WGSL ' + def.className + ']', m.lineNum + ':' + m.linePos, m.message));
    });
    def._pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module, entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, format: 'float32x2', offset: 0 },
            { shaderLocation: 1, format: 'float32x2', offset: 8 },
          ],
        }],
      },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
    return def._pipeline;
  }

  // Menunggu sampai video benar-benar punya frame yang sedang berjalan (readyState dan currentTime).
  // Memakai polling rAF karena requestVideoFrameCallback tidak dijamin terpanggil untuk video
  // yang tidak dirender. Ada batas waktu supaya tidak menggantung.
  function whenFrame(el, timeoutMs = 2000) {
    return new Promise(resolve => {
      const t0 = performance.now();
      const check = () => {
        if ((el.readyState >= 2 && el.currentTime > 0) || performance.now() - t0 > timeoutMs) return resolve();
        requestAnimationFrame(check);
      };
      check();
    });
  }

  const sizeOf = (el, isVideo) =>
    isVideo ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight];

  /* ---------- pasang shader ke satu <img> / <video> ---------- */
  async function attach(el) {
    const def = defFor(el);
    if (!def || el.dataset.fxAttached === '1') return;
    el.dataset.fxAttached = '1';
    const isVideo = el.tagName === 'VIDEO';

    const gpu = await getGpu();
    if (!gpu) { delete el.dataset.fxAttached; return; }
    const { device, format, quad, sampler } = gpu;

    if (isVideo) {
      el.muted = true;          // wajib agar boleh diputar otomatis
      el.playsInline = true;
      if (el.readyState < 2) {
        await new Promise(res => {
          el.addEventListener('loadeddata', res, { once: true });
          el.addEventListener('error', res, { once: true });
        });
      }
      // Putar dulu agar ada frame yang ditampilkan, baru ambil texture pertama.
      el.play().catch(() => { });
      await whenFrame(el);
    } else {
      try { await el.decode(); } catch (e) { }
    }
    const [w0, h0] = sizeOf(el, isVideo);
    if (!w0 || !h0) {
      console.warn('[fx] sumber belum termuat / tidak ditemukan:', el.currentSrc || el.src);
      delete el.dataset.fxAttached;
      return;
    }

    const pipeline = getPipeline(gpu, def);

    const canvas = document.createElement('canvas');
    const rect = el.getBoundingClientRect();
    canvas.style.width = (rect.width || w0) + 'px';
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = w0 + ' / ' + h0;
    canvas.dataset.fxCanvas = '1';
    el.after(canvas);
    if (isVideo) {
      // Tetap ada di viewport (fixed, pojok kiri atas) dan tidak sepenuhnya transparan,
      // supaya browser tetap men-decode dan merender frame-nya.
      Object.assign(el.style, {
        position: 'fixed', left: '0', top: '0', width: '1px', height: '1px',
        opacity: '0.01', pointerEvents: 'none', zIndex: '-1'
      });
    } else {
      el.style.display = 'none';
    }

    const ctx = canvas.getContext('webgpu');
    ctx.configure({ device, format, alphaMode: 'premultiplied' });

    const uniformBuf = device.createBuffer({
      size: def.uniformSize || 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const inst = {
      el, canvas, texture: null, texW: 0, texH: 0, cssW: 1, cssH: 1,
      mx: 0, my: 0, h: 0, target: 0, raf: 0,
      active: false, scheduled: false, visible: true, lastTime: -1
    };

    const TEX_USAGE = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT;

    // Video: texture dibuat sekali (dibuat ulang hanya jika ukuran berubah), lalu ditimpa tiap frame.
    function uploadVideoFrame() {
      const w = el.videoWidth, h = el.videoHeight;
      if (!w || !h || el.readyState < 2 || el.seeking) return;
      if (!inst.texture || inst.texW !== w || inst.texH !== h) {
        if (inst.texture) inst.texture.destroy();
        inst.texture = device.createTexture({ size: [w, h, 1], format: 'rgba8unorm', usage: TEX_USAGE });
        inst.texW = w; inst.texH = h;
      }
      device.queue.copyExternalImageToTexture(
        { source: el }, { texture: inst.texture, premultipliedAlpha: true }, [w, h]);
    }

    async function uploadTexture() {
      if (isVideo) { uploadVideoFrame(); return; }
      const bitmap = await createImageBitmap(el);
      if (inst.texture) inst.texture.destroy();
      inst.texture = device.createTexture({ size: [bitmap.width, bitmap.height, 1], format: 'rgba8unorm', usage: TEX_USAGE });
      device.queue.copyExternalImageToTexture(
        { source: bitmap }, { texture: inst.texture, premultipliedAlpha: true }, [bitmap.width, bitmap.height]);
      inst.texW = bitmap.width; inst.texH = bitmap.height;
      bitmap.close();
    }

    function draw() {
      if (!inst.texture) return;
      // Batasi DPR dan jumlah piksel. Saat canvas dibuat "cover" di layar portrait, ukuran CSS-nya
      // bisa jauh lebih besar dari layar; tanpa batas, iPhone (DPR 3) akan merender belasan juta piksel
      // per frame. Anggaran bisa diubah per elemen lewat data-max-pixels.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const budget = readNum(el, 'maxPixels', matchMedia('(pointer: coarse)').matches ? 2.5e6 : 6e6);
      let pw = Math.max(1, Math.round(inst.cssW * dpr));
      let ph = Math.max(1, Math.round(inst.cssH * dpr));
      if (pw * ph > budget) {
        const k = Math.sqrt(budget / (pw * ph));
        pw = Math.max(1, Math.round(pw * k));
        ph = Math.max(1, Math.round(ph * k));
      }
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }

      const c = {
        img: el, el, cssW: inst.cssW, cssH: inst.cssH, pxW: pw, pxH: ph,
        texW: inst.texW, texH: inst.texH, mx: inst.mx, my: inst.my, h: inst.h,
        num: (key, fb) => readNum(el, key, fb),
        color: (key, fb) => readColor(el, key, fb),
      };
      device.queue.writeBuffer(uniformBuf, 0, def.pack(c));

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: inst.texture.createView() },
        ],
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 0 }, storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, quad);
      pass.draw(6);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    /* ---------- loop per frame video (rAF, unggah hanya jika frame berganti) ---------- */
    function schedule() {
      if (inst.scheduled || !inst.active) return;
      inst.scheduled = true;
      requestAnimationFrame(loop);
    }
    function loop() {
      inst.scheduled = false;
      if (!inst.active) return;
      if (el.readyState >= 2 && el.currentTime !== inst.lastTime) {
        inst.lastTime = el.currentTime;
        uploadVideoFrame();
        draw();
      }
      schedule();
    }
    function setActive(on) {
      if (!isVideo || on === inst.active) return;
      inst.active = on;
      if (on) { el.play().catch(() => { }); schedule(); }
      else el.pause();
    }

    inst.draw = draw;
    inst.reload = async () => {
      if (isVideo) {
        inst.lastTime = -1;
        el.play().catch(() => { });
        await whenFrame(el);
        if (!inst.active) el.pause();
      } else {
        try { await el.decode(); } catch (e) { }
      }
      await uploadTexture();
      const [w, h] = sizeOf(el, isVideo);
      if (w && h) canvas.style.aspectRatio = w + ' / ' + h;
      draw();
      if (isVideo && inst.active) { el.play().catch(() => { }); schedule(); }
    };

    // Hover hanya untuk shader yang memintanya (def.hover = true).
    if (def.hover) {
      const tick = () => {
        inst.raf = 0;
        inst.h += (inst.target - inst.h) * 0.18;
        if (Math.abs(inst.target - inst.h) < 0.005) inst.h = inst.target;
        draw();
        if (inst.h !== inst.target) inst.raf = requestAnimationFrame(tick);
      };
      const kick = () => { if (!inst.raf) inst.raf = requestAnimationFrame(tick); };
      canvas.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        inst.mx = e.clientX - r.left;
        inst.my = e.clientY - r.top;
        inst.target = 1;
        kick();
      });
      canvas.addEventListener('pointerleave', () => { inst.target = 0; kick(); });
    }

    new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      inst.cssW = Math.max(1, r.width);
      inst.cssH = Math.max(1, r.height);
      draw();
    }).observe(canvas);

    await uploadTexture();
    instances.set(el, inst);
    draw();

    // Video hanya diputar dan dirender saat terlihat di layar dan tab aktif (hemat GPU).
    if (isVideo) {
      el.pause();   // sync() di bawah memutar lagi hanya jika canvas terlihat
      const sync = () => setActive(inst.visible && !document.hidden);
      new IntersectionObserver(entries => {
        inst.visible = entries[entries.length - 1].isIntersecting;
        sync();
      }).observe(canvas);
      document.addEventListener('visibilitychange', sync);
      sync();
    }
  }

  function scan(root = document) {
    if (!defs.length) return;
    root.querySelectorAll(selector()).forEach(attach);
  }

  // Deteksi elemen yang ditambahkan belakangan
  new MutationObserver(muts => {
    if (!defs.length) return;
    for (const m of muts) m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches?.(selector())) attach(n);
      else if (n.querySelectorAll) scan(n);
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Ganti sumber lalu pasang/muat ulang shader-nya.
  function setSource(el, src) {
    return new Promise(resolve => {
      const isVideo = el.tagName === 'VIDEO';
      const evt = isVideo ? 'loadeddata' : 'load';
      const cleanup = () => { el.removeEventListener(evt, onOk); el.removeEventListener('error', onErr); };
      const onOk = async () => {
        cleanup();
        const inst = instances.get(el);
        if (inst) await inst.reload(); else await attach(el);
        resolve();
      };
      const onErr = () => { cleanup(); console.warn('[fx] gagal memuat', src); resolve(); };
      el.addEventListener(evt, onOk);
      el.addEventListener('error', onErr);
      el.src = src;
      if (isVideo) el.load();
    });
  }

  return {
    register: def => defs.push(def),
    scan,
    attach,
    setSource,
    redraw: el => instances.get(el)?.draw(),
    has: el => instances.has(el),
  };
})();
