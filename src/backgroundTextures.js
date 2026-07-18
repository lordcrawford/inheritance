import { hash2, clamp01, renderField, hslToRgb, rgbToHsl } from './textureUtils';

function shiftColor([r, g, b], hueShift, lightBoost) {
  if (!hueShift && !lightBoost) return [r, g, b];
  const [h, s, l] = rgbToHsl(r, g, b);
  return hslToRgb(h + hueShift, s, clamp01(l + lightBoost));
}

// Topo Stipple: banded contour colors with fine stippling between bands.
// params = { strength: 0..1, size: 0..1, paletteIdx: 0..N }

const TOPO_PALETTES = [
  { name: 'Original',        colors: ['#0c0c0e', '#e85828', '#96a876'] },
  { name: 'Ocean',           colors: ['#0a1420', '#2a9d8f', '#e9c46a'] },
  { name: 'Sunset',          colors: ['#1a0f14', '#ff6b6b', '#ffd166'] },
  { name: 'Forest',          colors: ['#0d1510', '#6a8f5a', '#e8dcc0'] },
  { name: 'Berry',           colors: ['#150a18', '#c9184a', '#ffb4a2'] },
  { name: 'Arctic',          colors: ['#0a1218', '#7fb3d5', '#e0f2f7'] },
  { name: 'Volcanic',        colors: ['#120808', '#d64933', '#9a8c78'] },
  { name: 'Desert',          colors: ['#14100a', '#b5651d', '#e6c789'] },
  { name: 'Midnight',        colors: ['#05050a', '#5c4d9e', '#c8c9d4'] },
  { name: 'Neon Topo',       colors: ['#0a0a0a', '#ff2e93', '#2ee6d6'] },
  { name: 'Autumn Blaze',    colors: ['#150a05', '#d2691e', '#f4a900'] },
  { name: 'Lavender Fields', colors: ['#100a18', '#9d7fd1', '#e8d5f0'] },
  { name: 'Copper Patina',   colors: ['#0a1410', '#b87333', '#7fb8a0'] },
  { name: 'Cherry Blossom',  colors: ['#140a10', '#e893b8', '#f8e6ee'] },
  { name: 'Deep Amazon',     colors: ['#050f0a', '#2d8659', '#c9e8d4'] },
  { name: 'Molten Gold',     colors: ['#0a0805', '#c99a2e', '#ffe082'] },
  { name: 'Arctic Fox',      colors: ['#0a0e14', '#5c7a99', '#f0f4f8'] },
  { name: 'Terracotta',      colors: ['#140c08', '#c1673a', '#e8b98a'] },
  { name: 'Nordic Frost',    colors: ['#0a1218', '#4a7a96', '#cde8ee'] },
  { name: 'Wildberry',       colors: ['#100510', '#a8226a', '#f5a9c8'] },
  { name: 'Sahara Dune',     colors: ['#14100c', '#d9a566', '#f5e4c8'] },
  { name: 'Deep Space',      colors: ['#05050f', '#4a2e8a', '#a888e0'] },
  { name: 'Bronze Age',      colors: ['#0e0a05', '#8a6d3a', '#d4c095'] },
  { name: 'Coral Sea',       colors: ['#050f14', '#3a9ab0', '#ffb4a0'] },
  { name: 'Plum Wine',       colors: ['#12050c', '#7a2848', '#e6a8b8'] },
  { name: 'Meadow Green',    colors: ['#0a1408', '#5a9e3a', '#dceec0'] },
  { name: 'Slate Storm',     colors: ['#0a0e12', '#5a6a78', '#d0dae2'] },
  { name: 'Amber Fall',      colors: ['#140e05', '#d98a1e', '#f5cf8e'] },
  { name: 'Rosewood',        colors: ['#100808', '#8a3a3a', '#e0b8a8'] },
  { name: 'Teal Dusk',       colors: ['#05100e', '#1f8a7a', '#c8ece4'] },
  { name: 'Peach Sunset',    colors: ['#140a08', '#e8825a', '#ffdfc4'] },
  { name: 'Indigo Night',    colors: ['#05050a', '#4040a0', '#b0b0e8'] },
  { name: 'Olive Grove',     colors: ['#0e100a', '#6a7a2e', '#d8e0a8'] },
  { name: 'Ruby Fire',       colors: ['#100205', '#c81e3a', '#ff9eae'] },
  { name: 'Sage Fog',        colors: ['#0a0e0a', '#7a9070', '#dce8d4'] },
  { name: 'Cobalt Deep',     colors: ['#05080f', '#1e5aa0', '#a0c8ec'] },
  { name: 'Marigold',        colors: ['#140c05', '#e8a020', '#ffe6a0'] },
  { name: 'Orchid Mist',     colors: ['#0e050e', '#a860a8', '#f0d0f0'] },
  { name: 'Basalt',          colors: ['#08080a', '#6a6a70', '#d8d8dc'] },
  { name: 'Sunrise Coral',   colors: ['#140805', '#ff7050', '#ffd0a0'] },
  { name: 'Black Dominant',  colors: ['#000000', '#ff3b30', '#0a0a0a'] },
];

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Each shape variant computes an elevation value (roughly -1..1) at normalized (nx,ny),
// given the current freq (contour scale) and time. Different combinations of noise
// sampling produce structurally different band shapes while reusing the same
// band-coloring + stipple rendering below.
const SHAPE_VARIANTS = [
  {
    name: 'Wood Grain',
    elevation: (nx, ny, t, noise3D, freq) => {
      const grain = Math.sin(ny * freq * 9 + noise3D(nx * freq * 0.7, ny * freq * 0.7, t * 0.05) * 3);
      const broad = noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.06);
      return grain * 0.5 + broad * 0.6;
    },
  },
  {
    name: 'Star Burst',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const spikes = Math.sin(angle * 7 + t * 0.1) * 0.3;
      return Math.sin((dist + spikes) * freq * 3.6 - t * 0.15);
    },
  },
  {
    name: 'Cracked Glass',
    elevation: (nx, ny, t, noise3D, freq) => {
      const n1 = noise3D(nx * freq * 1.3, ny * freq * 1.3, t * 0.05);
      const n2 = noise3D(nx * freq * 1.3 + 20, ny * freq * 1.3 + 20, t * 0.05 + 7);
      const edge = Math.abs(n1 - n2);
      return 1 - edge * 3;
    },
  },
  {
    name: 'Fault Lines',
    elevation: (nx, ny, t, noise3D, freq) => {
      const base = noise3D(nx * freq * 0.6, ny * freq * 0.6, t * 0.05);
      const fault = noise3D(nx * freq * 2.6 + 4, ny * freq * 0.3 + 4, t * 0.04 + 1);
      return base + Math.sign(fault) * Math.min(0.3, Math.abs(fault)) * 1.4;
    },
  },
  {
    name: 'Pulsing Core',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.3);
      const wobble = noise3D(nx * freq * 0.7, ny * freq * 0.7, t * 0.06) * 0.15;
      return Math.sin((dist + wobble) * freq * (2.6 + pulse * 1.4) - t * 0.2);
    },
  },
  {
    name: 'Woven Basket',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 3.2;
      const wobble = noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.05) * 0.3;
      return Math.sin(nx * s + wobble) * Math.sin(ny * s + wobble);
    },
  },
  {
    name: 'Feathered Plumes',
    elevation: (nx, ny, t, noise3D, freq) => {
      const rise = (1 - ny) * 1.4;
      const n = noise3D(nx * freq * 1.6, ny * freq * 0.9 - t * 0.12, t * 0.05);
      return n * (0.5 + rise * 0.5);
    },
  },
  {
    name: 'Crystal Facets',
    elevation: (nx, ny, t, noise3D, freq) => {
      const n = noise3D(nx * freq * 0.8, ny * freq * 0.8, t * 0.04);
      const facets = 7;
      return Math.round(n * facets) / facets;
    },
  },
  {
    name: 'Sand Dunes',
    elevation: (nx, ny, t, noise3D, freq) => {
      const wave = nx * freq * 3.4 + noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.05) * 1.2;
      const saw = ((wave % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2);
      return Math.sin(saw * Math.PI * 2) * 0.7 + Math.pow(saw, 3) * 0.6 - 0.3;
    },
  },
  {
    name: 'Bark Texture',
    elevation: (nx, ny, t, noise3D, freq) => {
      const stretchY = ny * freq * 0.35;
      const veins = noise3D(nx * freq * 3.2, stretchY, t * 0.05);
      const ridge = 1 - Math.abs(veins) * 1.8;
      const broad = noise3D(nx * freq * 0.5, stretchY, t * 0.06 + 4) * 0.4;
      return ridge * 0.6 + broad;
    },
  },
  {
    name: 'Radiant Corona',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const rays = Math.sin(angle * 12 + t * 0.15) * 0.2;
      const glow = 1 - clamp01(dist * 1.6);
      return Math.sin((dist + rays) * freq * 4 - t * 0.2) * 0.6 + glow * 0.5;
    },
  },
  {
    name: 'Interference Grid',
    elevation: (nx, ny, t, noise3D, freq) => {
      const a1 = 0.5, a2 = -0.5;
      const g1 = Math.sin((nx * Math.cos(a1) + ny * Math.sin(a1)) * freq * 4 + t * 0.1);
      const g2 = Math.sin((nx * Math.cos(a2) + ny * Math.sin(a2)) * freq * 4 - t * 0.08);
      return (g1 + g2) * 0.5;
    },
  },
  {
    name: 'Herringbone',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 3;
      const wobble = noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.05) * 0.2;
      const d1 = Math.sin((nx + ny) * s + wobble + t * 0.06);
      const d2 = Math.sin((nx - ny) * s - wobble - t * 0.06);
      return Math.abs(d1) < Math.abs(d2) ? d1 : d2;
    },
  },
  {
    name: 'Diamond Lattice',
    elevation: (nx, ny, t, noise3D, freq) => {
      const rot = Math.PI / 4;
      const rx = (nx - 0.5) * Math.cos(rot) - (ny - 0.5) * Math.sin(rot);
      const ry = (nx - 0.5) * Math.sin(rot) + (ny - 0.5) * Math.cos(rot);
      const s = freq * 3.4;
      const wobble = noise3D(nx * freq * 0.3, ny * freq * 0.3, t * 0.05) * 0.15;
      return Math.sin(rx * s + wobble + t * 0.08) * Math.sin(ry * s + wobble - t * 0.08);
    },
  },
  {
    name: 'Chevron Weave',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 2.6;
      const zig = Math.asin(Math.sin(nx * s + t * 0.08)) * (2 / Math.PI);
      const zag = Math.asin(Math.sin(ny * s - t * 0.08)) * (2 / Math.PI);
      return zig * zag * 2;
    },
  },
  {
    name: 'Plaid Grid',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s1 = freq * 3, s2 = freq * 1.6;
      const a = Math.sin(nx * s1 + t * 0.06) * Math.sin(ny * s2 - t * 0.05);
      const b = Math.sin(nx * s2 - t * 0.05) * Math.sin(ny * s1 + t * 0.06);
      return (a + b) * 0.55;
    },
  },
  {
    name: 'Triangular Tessellation',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 2.8;
      const g1 = Math.sin(nx * s + t * 0.06);
      const g2 = Math.sin((nx * 0.5 + ny * 0.866) * s - t * 0.05);
      const g3 = Math.sin((nx * 0.5 - ny * 0.866) * s + t * 0.07);
      return (g1 + g2 + g3) / 3;
    },
  },
  {
    name: 'Windowpane',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 3.2;
      const wobble = noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.05) * 0.15;
      const gx = Math.abs(Math.sin(nx * s + wobble + t * 0.05));
      const gy = Math.abs(Math.sin(ny * s + wobble - t * 0.05));
      return 1 - Math.min(gx, gy) * 2;
    },
  },
  {
    name: 'Basket Weave Diagonal',
    elevation: (nx, ny, t, noise3D, freq) => {
      const rot = Math.PI / 4;
      const rx = nx * Math.cos(rot) - ny * Math.sin(rot);
      const ry = nx * Math.sin(rot) + ny * Math.cos(rot);
      const s = freq * 3.6;
      const wobble = noise3D(nx * freq * 0.4, ny * freq * 0.4, t * 0.05) * 0.2;
      return Math.sin(rx * s + wobble + t * 0.07) * Math.sin(ry * s + wobble - t * 0.07);
    },
  },
  {
    name: 'Op-Art Grid',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3;
      const warp = Math.sin(dist * 6 - t * 0.15) * 0.5;
      return Math.sin(nx * s + warp) * Math.sin(ny * s + warp);
    },
  },
  {
    name: 'Interlocking Rings',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 2.4;
      const cellX = Math.floor(nx * s), cellY = Math.floor(ny * s);
      const fx = nx * s - cellX - 0.5, fy = ny * s - cellY - 0.5;
      const d1 = Math.sqrt(fx * fx + fy * fy);
      const fx2 = nx * s - cellX, fy2 = ny * s - cellY - 1;
      const d2 = Math.sqrt(fx2 * fx2 + fy2 * fy2);
      const wobble = noise3D(nx * freq * 0.3, ny * freq * 0.3, t * 0.05) * 0.1;
      return Math.sin((Math.min(d1, d2) + wobble) * 8 - t * 0.2);
    },
  },
  {
    name: 'Fine Basket Weave',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 5.5;
      const wobble = noise3D(nx * freq * 0.5, ny * freq * 0.5, t * 0.05) * 0.15;
      return Math.sin(nx * s + wobble + t * 0.08) * Math.sin(ny * s + wobble - t * 0.08);
    },
  },
  {
    name: 'Op-Art Ripple',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3;
      const warp = Math.sin(dist * 10 - t * 0.25) * 0.8;
      return Math.sin(nx * s + warp) * Math.sin(ny * s + warp);
    },
  },
  {
    name: 'Op-Art Spiral',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      const s = freq * 3;
      const warp = Math.sin(dist * 7 + angle * 3 - t * 0.2) * 0.6;
      return Math.sin(nx * s + warp) * Math.sin(ny * s + warp);
    },
  },
  {
    name: 'Op-Art Bulge',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3;
      const bulge = (1 - clamp01(dist * 1.8)) * Math.sin(t * 0.2) * 1.2;
      return Math.sin(nx * s + bulge) * Math.sin(ny * s + bulge);
    },
  },
  {
    name: 'Op-Art Twist',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const twist = (1 - clamp01(dist * 1.6)) * (t * 0.2);
      const rx = dx * Math.cos(twist) - dy * Math.sin(twist);
      const ry = dx * Math.sin(twist) + dy * Math.cos(twist);
      const s = freq * 3.4;
      return Math.sin(rx * s) * Math.sin(ry * s);
    },
  },
  {
    name: 'Op-Art Zebra',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3;
      const warp = Math.sin(dist * 6 - t * 0.15) * 0.5;
      const v = Math.sin(nx * s + warp) * Math.sin(ny * s + warp);
      return v > 0 ? 1 : -1;
    },
  },
  {
    name: 'Op-Art Wave Grid',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 3;
      const warp = Math.sin(nx * 6 - t * 0.25) * 0.6;
      return Math.sin(nx * s + warp) * Math.sin(ny * s + warp * 0.6);
    },
  },
  {
    name: 'Op-Art Diamond Pulse',
    elevation: (nx, ny, t, noise3D, freq) => {
      const rot = Math.PI / 4;
      const dx = nx - 0.5, dy = ny - 0.5;
      const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3.4;
      const pulse = Math.sin(dist * 9 - t * 0.3) * 0.7;
      return Math.sin(rx * s + pulse) * Math.sin(ry * s + pulse);
    },
  },
  {
    name: 'Op-Art Interference',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = nx - 0.5, dy = ny - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const s = freq * 3;
      const warpA = Math.sin(dist * 6 - t * 0.15) * 0.5;
      const warpB = Math.sin(dist * 6 + t * 0.18) * 0.5;
      const gridA = Math.sin(nx * s + warpA) * Math.sin(ny * s + warpA);
      const gridB = Math.sin(nx * s + warpB) * Math.sin(ny * s + warpB);
      return (gridA + gridB) * 0.5;
    },
  },
  {
    name: 'Op-Art Concentric Weave',
    elevation: (nx, ny, t, noise3D, freq) => {
      const dx = Math.abs(nx - 0.5), dy = Math.abs(ny - 0.5);
      const cheby = Math.max(dx, dy);
      const s = freq * 3;
      const warp = Math.sin(cheby * 12 - t * 0.2) * 0.6;
      return Math.sin(nx * s + warp) * Math.sin(ny * s + warp);
    },
  },
  {
    name: 'Op-Art Bend',
    elevation: (nx, ny, t, noise3D, freq) => {
      const s = freq * 3;
      const shear = (ny - 0.5) * Math.sin(t * 0.15) * 2.4;
      return Math.sin((nx + shear) * s) * Math.sin(ny * s);
    },
  },
];

const topoStipple = {
  id: 'topo-stipple',
  name: 'Topo Stipple',
  palettes: TOPO_PALETTES,
  shapes: SHAPE_VARIANTS,
  draw(ctx, w, h, t, params, noise3D) {
    const [dark, a, b] = (TOPO_PALETTES[params.paletteIdx] || TOPO_PALETTES[0]).colors.map(hexToRgb);
    const shape = SHAPE_VARIANTS[params.shapeIdx] || SHAPE_VARIANTS[0];
    const prevShape = params.prevShapeIdx != null ? SHAPE_VARIANTS[params.prevShapeIdx] : null;
    const shapeBlend = params.shapeBlend ?? 1;
    const audio = params.audio;
    const bass = audio?.bass || 0, mid = audio?.mid || 0, treble = audio?.treble || 0, beat = audio?.beat || 0;

    // beat-synced motion: bass pushes the pattern's clock and frequency, beats add a
    // swell — both already eased upstream, so this can afford a stronger amplitude
    const audioT = t + bass * 2.2 + beat * 2.8;
    const freq = 5 - params.size * 3.2 + bass * 3.5 + beat * 2.2;
    const wobbleAmt = treble * 0.06 + beat * 0.09;
    const makeSample = sh => (nx, ny) => {
      const wob = wobbleAmt ? Math.sin(nx * 23 + ny * 17 + t * 4) * wobbleAmt : 0;
      return clamp01(0.5 + 0.5 * sh.elevation(nx + wob, ny - wob, audioT, noise3D, freq));
    };
    const sample = makeSample(shape);

    // frequency-driven color: hue drifts with mid/treble content, brightness pulses with bass/beat
    const hueShift = mid * 80 + treble * 45;
    const lightBoost = bass * 0.18 + beat * 0.16;
    const darkC = shiftColor(dark, hueShift * 0.5, lightBoost * 0.6);
    const aC = shiftColor(a, hueShift, lightBoost);
    const bC = shiftColor(b, hueShift * 1.2, lightBoost);

    const colorize = v => {
      const bands = 6;
      const band = Math.floor(v * bands) / bands;
      let col;
      if (band < 0.17) col = darkC;
      else if (band < 0.34) col = aC;
      else if (band < 0.5) col = darkC;
      else if (band < 0.67) col = bC;
      else if (band < 0.84) col = aC;
      else col = darkC;
      return [col[0], col[1], col[2], 235];
    };

    // real dissolve between the old and new shape's fully-rendered fields, rather than
    // blending their raw values pre-quantization (which just looked like noise mid-fade)
    if (prevShape && shapeBlend < 1) {
      const baseAlpha = ctx.globalAlpha;
      ctx.save();
      ctx.globalAlpha = baseAlpha * (1 - shapeBlend);
      renderField(ctx, w, h, 110, 68, makeSample(prevShape), colorize);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = baseAlpha * shapeBlend;
      renderField(ctx, w, h, 110, 68, sample, colorize);
      ctx.restore();
    } else {
      renderField(ctx, w, h, 110, 68, sample, colorize);
    }
    ctx.save();
    const spacing = 3 + params.size * 3;
    const dotR = 0.9 + beat * 0.7;
    for (let y = 0; y < h; y += spacing) {
      for (let x = 0; x < w; x += spacing) {
        const v = sample(x / w, y / h);
        if (hash2(x, y + 11) < v * (0.85 + beat * 0.08)) {
          const jitter = spacing + beat * spacing * 0.7;
          const jx = (hash2(x, y) - 0.5) * jitter;
          const jy = (hash2(x + 3, y) - 0.5) * jitter;
          ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
          ctx.beginPath(); ctx.arc(x + jx, y + jy, dotR, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  },
};

export const BACKGROUND_TEXTURES = [
  topoStipple,
];
