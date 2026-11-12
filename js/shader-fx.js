/**
 * ShaderFX – lightweight WebGPU image‑effect engine.
 * Applies registered WGSL fragment shaders to <img> elements
 * decorated with the corresponding CSS class.
 *
 * Usage:
 *   1. Include this script first.
 *   2. Include a shader registration script (e.g. shaders-engrave.js).
 *   3. On DOMContentLoaded, call ShaderFX.init().
 */
const ShaderFX = (() => {
  const registry = [];
  let _device = null;

  function register(opts) {
    registry.push(opts);
  }

  async function getDevice() {
    if (_device) return _device;
    if (!navigator.gpu) return null;
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    _device = await adapter.requestDevice();
    return _device;
  }

  async function applyToElement(el, shaderDef) {
    const device = await getDevice();
    if (!device) {
      // WebGPU not available – keep the original <img> visible
      return;
    }

    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (!img) return;

    // Wait for the image to load
    if (!img.complete) {
      await new Promise(r => { img.onload = r; img.onerror = r; });
    }

    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    if (!srcW || !srcH) return;

    // Draw image to an offscreen canvas to get pixel data
    const offscreen = document.createElement('canvas');
    offscreen.width = srcW;
    offscreen.height = srcH;
    const ctx2d = offscreen.getContext('2d');
    ctx2d.drawImage(img, 0, 0, srcW, srcH);
    const imageData = ctx2d.getImageData(0, 0, srcW, srcH);

    // Create input texture
    const inputTex = device.createTexture({
      size: [srcW, srcH],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.writeTexture(
      { texture: inputTex },
      imageData.data,
      { bytesPerRow: srcW * 4 },
      { width: srcW, height: srcH }
    );

    // Create output texture
    const outputTex = device.createTexture({
      size: [srcW, srcH],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    // Build frame object expected by setup/render
    const frame = {
      state: {},
      params: {},
      input: inputTex,
      output: Object.assign(outputTex, {
        width: srcW,
        height: srcH,
        physicalWidth: srcW,
        physicalHeight: srcH,
        format: 'rgba8unorm',
      }),
    };

    // Pack uniforms via the shader's pack function
    if (shaderDef.pack) {
      // The pack helper is optional; we fall back to setup/render
    }

    // Use setup/render if available (Figma‑style runtime)
    if (shaderDef.setup && shaderDef.render) {
      shaderDef.setup(device, frame);
      shaderDef.render(device, frame);
    } else {
      // Inline pipeline from WGSL + pack
      const module = device.createShaderModule({ code: shaderDef.wgsl });
      const sampler = device.createSampler({
        magFilter: 'linear', minFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge',
      });
      const quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
      });
      new Float32Array(quad.getMappedRange()).set([
        -1, -1, 0, 1,  1, -1, 1, 1,  -1, 1, 0, 0,
        -1, 1, 0, 0,   1, -1, 1, 1,   1, 1, 1, 0,
      ]);
      quad.unmap();

      const packCtx = {
        pxW: srcW, pxH: srcH,
        num: (name, def) => {
          const el2 = el.closest('[data-shader-' + name + ']');
          return el2 ? parseFloat(el2.dataset['shader' + name.charAt(0).toUpperCase() + name.slice(1)]) : def;
        },
        color: (name, def) => def,
      };
      const uniformData = shaderDef.pack(packCtx);
      const uniformBuf = device.createBuffer({
        size: uniformData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(uniformBuf, 0, uniformData);

      const pipeline = device.createRenderPipeline({
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
        fragment: {
          module, entryPoint: 'fs_main',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuf } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: inputTex.createView() },
        ],
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: outputTex.createView(),
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

    // Read back the result
    const readBuf = device.createBuffer({
      size: srcW * srcH * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const enc2 = device.createCommandEncoder();
    enc2.copyTextureToBuffer(
      { texture: outputTex },
      { buffer: readBuf, bytesPerRow: srcW * 4 },
      { width: srcW, height: srcH }
    );
    device.queue.submit([enc2.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const result = new Uint8Array(readBuf.getMappedRange()).slice();
    readBuf.unmap();

    // Paint result onto a visible canvas
    const canvas = document.createElement('canvas');
    canvas.width = srcW;
    canvas.height = srcH;
    canvas.style.cssText = img.style.cssText || '';
    canvas.className = img.className || '';
    // Ensure it fills the container just like the img did
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'cover';
    const ctx = canvas.getContext('2d');
    const outData = ctx.createImageData(srcW, srcH);
    outData.data.set(result);
    ctx.putImageData(outData, 0, 0);

    img.style.display = 'none';
    img.parentElement.appendChild(canvas);
  }

  async function init() {
    for (const def of registry) {
      const elements = document.querySelectorAll('.' + def.className);
      for (const el of elements) {
        try {
          await applyToElement(el, def);
        } catch (e) {
          console.warn('ShaderFX: failed for', el, e);
        }
      }
    }
  }

  return { register, init };
})();

