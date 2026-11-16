/* Shader ASCII. WGSL disalin dari shaderAscii.ts (Figma), tidak diubah. */
ShaderFX.register({
  className: 'ascii-shader',
  hover: true,
  wgsl: `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsData: vec4f,
  thickness: vec4f,
  density: vec4f,
  whiteTexture: vec4f,
  hover: vec4f,   // x,y = mouse uv, z = strength 0..1, w = radius (css px)
  scramble: vec4f, // x = durasi (s), y = laju ganti glyph (Hz), z = aktif, w = ada jejak
  trail: array<vec4f, 32>, // x,y = posisi (px CSS), z = umur (s), w = valid
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var inputTex: texture_2d<f32>;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn sampleInput(p: vec2f) -> vec4f {
  return textureSampleLevel(inputTex, samp, clamp(p, vec2f(0.0), vec2f(1.0)), 0.0);
}

fn sampleInputOrZero(p: vec2f) -> vec4f {
  let inside = step(vec2f(0.0), p) * step(p, vec2f(1.0));
  return sampleInput(p) * (inside.x * inside.y);
}

fn hash21(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + vec3f(dot(p3, vec3f(p3.y, p3.z, p3.x) + vec3f(33.33)));
  return fract((p3.x + p3.y) * p3.z);
}

fn asciiSegment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let v = b - a;
  let t = clamp(dot(p-a, v) / max(dot(v,v), 0.00001), 0.0, 1.0);
  return length(p - a - v*t);
}

fn asciiDistance(p: vec2f, glyph: i32) -> f32 {
  var d = 10.0;
  if (glyph == 0) {
    // #
    d = min(asciiSegment(p,vec2f(-0.15,-0.32),vec2f(-0.21,0.32)), asciiSegment(p,vec2f(0.21,-0.32),vec2f(0.15,0.32)));
    d = min(d,asciiSegment(p,vec2f(-0.29,-0.12),vec2f(0.29,-0.12)));
    d = min(d,asciiSegment(p,vec2f(-0.29,0.12),vec2f(0.29,0.12)));
  } else if (glyph == 1) {
    // *
    d = asciiSegment(p,vec2f(0.0,-0.3),vec2f(0.0,0.3));
    d = min(d,asciiSegment(p,vec2f(-0.25,-0.18),vec2f(0.25,0.18)));
    d = min(d,asciiSegment(p,vec2f(-0.25,0.18),vec2f(0.25,-0.18)));
  } else if (glyph == 2) {
    // +
    d = min(asciiSegment(p,vec2f(0.0,-0.28),vec2f(0.0,0.28)),asciiSegment(p,vec2f(-0.26,0.0),vec2f(0.26,0.0)));
  } else if (glyph == 3) {
    // =
    d = min(asciiSegment(p,vec2f(-0.25,-0.12),vec2f(0.25,-0.12)),asciiSegment(p,vec2f(-0.25,0.12),vec2f(0.25,0.12)));
  } else if (glyph == 4) {
    // :
    d = min(length(p-vec2f(0.0,-0.16)),length(p-vec2f(0.0,0.16)))-0.012;
  } else {
    // .
    d = length(p-vec2f(0.0,0.24))-0.016;
  }
  return d;
}

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let time = u.frameData.x;
  let outputUv = outputUv_in;
  let dims = max(u.frameData.yz, vec2f(1.0));
  let inputDims = max(u.inputDimsData.xy, vec2f(1.0));
  let inputTexel = vec2f(1.0) / inputDims;
  let uv = outputUv;
  let texel = inputTexel;
  let aspect = inputDims.x / max(inputDims.y, 1.0);
  let thickness = u.thickness.x;
  let density = u.density.x;
  let whiteTexture = u.whiteTexture.x;
  let inputColor = sampleInput(uv);
  let cellSize = mix(26.0, 7.0, density / 100.0);
  let pixelPosition = uv * dims;
  let cellId = floor(pixelPosition / cellSize);
  let cellUv = (cellId + 0.5) * cellSize / dims;
  let offset = vec2f(cellSize * 0.23) / dims;
  let c0 = sampleInputOrZero(cellUv);
  let c1 = sampleInputOrZero(cellUv + vec2f(offset.x,0.0));
  let c2 = sampleInputOrZero(cellUv - vec2f(offset.x,0.0));
  let c3 = sampleInputOrZero(cellUv + vec2f(0.0,offset.y));
  let c4 = sampleInputOrZero(cellUv - vec2f(0.0,offset.y));
  let averaged = (c0+c1+c2+c3+c4) / 5.0;
  let source = inputColor.rgb / max(inputColor.a, 0.00001);
  let cellColor = averaged.rgb / max(averaged.a, 0.00001);
  let luminance = dot(cellColor,vec3f(0.2126,0.7152,0.0722));
  let sourceLuminance = dot(source,vec3f(0.2126,0.7152,0.0722));
  let highlight = smoothstep(0.72,0.94,max(luminance,sourceLuminance));
  var glyph = i32(clamp(floor(luminance * 6.0),0.0,5.0));
  if (luminance > 0.8) { glyph = 4; }
  // Scramble: sel yang baru ditinggalkan kursor menampilkan glyph acak, lalu satu per satu
  // kembali ke glyph aslinya (waktu menetap tiap sel berbeda).
  var scrambling = 0.0;
  if (u.scramble.z > 0.5 && u.scramble.w > 0.5) {
    let cellCenter = (cellId + vec2f(0.5)) * cellSize;
    let trailRadius = max(u.hover.w, 1.0) * 0.8;
    var minAge = 1000.0;
    for (var i = 0; i < 32; i = i + 1) {
      let tp = u.trail[i];
      if (tp.w > 0.5 && length(cellCenter - tp.xy) < trailRadius) {
        minAge = min(minAge, tp.z);
      }
    }
    let settleAt = u.scramble.x * (0.3 + 0.7 * hash21(cellId));
    if (minAge < settleAt) {
      scrambling = 1.0;
      let stepIdx = floor(minAge * u.scramble.y);
      let rnd = hash21(cellId + vec2f(stepIdx * 7.13, stepIdx * 3.77 + 1.0));
      glyph = i32(clamp(floor(rnd * 6.0), 0.0, 5.0));
    }
  }
  let local = fract(pixelPosition / cellSize) - 0.5;
  let distance = asciiDistance(local,glyph);
  let stroke = mix(0.019,0.065,thickness/100.0);
  let aa = max(fwidth(distance),0.001);
  let mask = 1.0-smoothstep(stroke-aa,stroke+aa,distance);
  let participation = mix(mix(1.0, whiteTexture / 100.0, highlight), 1.0, scrambling);
  let base = mix(source,cellColor,0.6);
  let darkInk = cellColor * 0.48;
  let lightInk = mix(cellColor,vec3f(1.0),0.36);
  let ink = mix(lightInk,darkInk,smoothstep(0.25,0.65,luminance));
  let background = base * mix(0.78,1.0,smoothstep(0.22,0.65,luminance));
  let asciiColor = mix(background,ink,mask);
  let blended = mix(source,asciiColor,participation);
  // Hover: ASCII memudar ke gambar asli di sekitar kursor (tepi lembut).
  let hoverDist = length((uv - u.hover.xy) * dims);
  let hoverRadius = max(u.hover.w, 1.0);
  let reveal = (1.0 - smoothstep(hoverRadius * 0.35, hoverRadius, hoverDist)) * u.hover.z;
  let result = mix(blended, source, reveal);
  return vec4f(result * inputColor.a,inputColor.a);
}
`,
  // Urutan harus sama dengan struct Uniforms di WGSL:
  // 6 x vec4f + scramble (vec4f) + trail (32 x vec4f) = 39 x 16 = 624 byte.
  uniformSize: 624,
  trail: true,   // core merekam jejak kursor (c.trail) untuk efek scramble
  pack: c => {
    const out = new Float32Array(156);
    const reveal = Math.min(Math.max(c.num('hoverReveal', 100), 0), 100) / 100;
    const n = Math.min(c.trail.length, 32);
    out.set([
      0, c.cssW, c.cssH, 0,                       // frameData: time, dims logis
      c.texW, c.texH, 0, 0,                       // inputDimsData
      c.num('thickness', 42), 0, 0, 0,
      c.num('density', 60), 0, 0, 0,
      c.num('whiteTexture', 30), 0, 0, 0,
      c.mx / c.cssW, c.my / c.cssH,               // hover: posisi mouse (uv)
      c.el.dataset.hover === 'off' ? 0 : c.h * reveal,   // kekuatan reveal 0..1
      c.num('hoverRadius', 120),                  // radius (px CSS)
      c.scrambleDuration, c.num('scrambleRate', 18),     // scramble: durasi, laju
      c.el.dataset.scramble === 'off' ? 0 : 1, n > 0 ? 1 : 0,
    ], 0);
    for (let i = 0; i < n; i++) {
      const p = c.trail[i];
      out.set([p.x, p.y, Math.max(0, c.now - p.t), 1], 28 + i * 4);
    }
    return out;
  },
});
