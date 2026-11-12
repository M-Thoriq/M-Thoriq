/* Shader Bank Engrave. WGSL disalin dari shaderBankEngrave.ts (Figma), tidak diubah. */
ShaderFX.register({
  className: 'engrave-shader',
  hover: false,
  wgsl: `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsData: vec4f,
  intensity: vec4f,
  inkColor: vec4f,
  lineDensity: vec4f,
  lineThickness: vec4f,
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

fn engravingLine(phase: f32, width: f32) -> f32 {
  let distanceToLine = abs(fract(phase + 0.5) - 0.5);
  let footprint = max(fwidth(phase), 0.0001);
  let softened = 1.0 - smoothstep(width * 0.5 - footprint * 0.5, width * 0.5 + footprint * 0.5, distanceToLine);
  let resolved = clamp(width, 0.0, 1.0);
  return mix(softened, resolved, smoothstep(0.55, 1.15, footprint));
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
  let intensity = u.intensity.x;
  let inkColor = u.inkColor;
  let lineDensity = u.lineDensity.x;
  let lineThickness = u.lineThickness.x;
  let inputColor = sampleInput(uv);
  let alpha = inputColor.a;
  let source = clamp(inputColor.rgb / max(alpha, 0.00001), vec3f(0.0), vec3f(1.0));
  let luminance = dot(source, vec3f(0.2126, 0.7152, 0.0722));
  let darkness = clamp(1.0 - luminance, 0.0, 1.0);
  let p = (uv - vec2f(0.5)) * dims / max(min(dims.x, dims.y), 1.0);
  let curve = 0.028 * sin(p.x * 5.1 + p.y * 1.3) + 0.009 * sin(p.x * 12.0 - p.y * 2.0);
  let phase = (p.y + p.x * 0.24 + curve) * lineDensity;
  let secondPhase = (p.y * 0.57 - p.x * 0.82 + 0.021 * sin(p.y * 6.3 + p.x * 2.1)) * lineDensity * 0.91;
  let tone = pow(darkness, 0.85);
  let primaryWidth = clamp((0.018 + tone * 0.77) * lineThickness, 0.003, 0.94);
  let secondaryWidth = clamp((0.015 + smoothstep(0.30, 0.92, darkness) * 0.61) * lineThickness, 0.003, 0.90);
  let primary = engravingLine(phase, primaryWidth);
  let secondary = engravingLine(secondPhase, secondaryWidth) * smoothstep(0.22, 0.65, darkness);
  let coverage = 1.0 - (1.0 - primary) * (1.0 - secondary);
  let grain = sin(p.x * 1941.0 + sin(p.y * 731.0)) * sin(p.y * 1649.0 + p.x * 513.0);
  let grainAttenuation = 1.0 - smoothstep(0.30, 0.85, max(fwidth(p.x * 1941.0), fwidth(p.y * 1649.0)));
  let paper = vec3f(0.977, 0.959, 0.904);
  let paperBase = mix(paper, source, 0.15) + vec3f(grain * grainAttenuation * 0.003);
  let printedInk = mix(paperBase, inkColor.rgb, inkColor.a);
  let engraved = mix(paperBase, printedInk, coverage);
  return vec4f(mix(inputColor.rgb, engraved * alpha, intensity), alpha);
}
`,
  // Shader ini memakai dimensi FISIK (piksel canvas), bukan piksel CSS.
  pack: c => new Float32Array([
    0, c.pxW, c.pxH, 0,
    c.pxW, c.pxH, 0, 0,
    c.num('intensity', 0.78), 0, 0, 0,
    ...c.color('inkColor', [0.055, 0.18, 0.3, 1]),
    c.num('lineDensity', 225), 0, 0, 0,
    c.num('lineThickness', 0.85), 0, 0, 0,
  ]),
});
