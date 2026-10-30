const fract = (x) => x - Math.floor(x);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function hash2(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

export function valueNoise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2(x, y, octaves = 5, gain = 0.5, lacunarity = 2.03) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * valueNoise2(x * frequency, y * frequency);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / norm;
}

export function ridged2(x, y, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise2(x * frequency, y * frequency);
    value += amplitude * (1 - Math.abs(n * 2 - 1));
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.06;
  }
  return value / norm;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function gaussian(x, z, cx, cz, radius) {
  const dx = x - cx;
  const dz = z - cz;
  return Math.exp(-(dx * dx + dz * dz) / (2 * radius * radius));
}

export function terrainHeight(x, z) {
  const coastNoise = (fbm2(x * 0.000071 + 19.2, z * 0.000071 - 8.7, 3) - 0.5) * 0.22;
  const islandDistance = Math.sqrt((x * 0.86 / 13700) ** 2 + ((z + 1800) / 17100) ** 2) + coastNoise;
  const land = 1 - smoothstep(0.78, 1.06, islandDistance);

  const broad = fbm2(x * 0.00013 + 7.1, z * 0.00013 + 3.9, 4);
  const ridge = ridged2(x * 0.000205 - 5.2, z * 0.000205 + 11.4, 5);
  const detail = fbm2(x * 0.00105, z * 0.00105, 3);
  const mask = smoothstep(0.31, 0.72, broad + 0.16);

  let height = 18 + broad * 165 + Math.pow(ridge, 2.35) * 1680 * mask + (detail - 0.5) * 46;
  height += 950 * gaussian(x, z, -2350, -3400, 2380);
  height += 1850 * gaussian(x, z, -2900, 300, 1850);
  height += 760 * gaussian(x, z, 3450, -6100, 2050);
  height += 610 * gaussian(x, z, -6100, -8300, 2650);
  height += 450 * gaussian(x, z, 6600, -1900, 2400);
  height *= land;

  const shore = smoothstep(0.42, 0.92, land);
  height -= (1 - shore) * 92;
  return height;
}

export function terrainNormal(x, z, eps = 45) {
  const hL = terrainHeight(x - eps, z);
  const hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps);
  const hU = terrainHeight(x, z + eps);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = eps * 2;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}
