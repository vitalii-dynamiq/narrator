// Deterministic seeded PRNG — mulberry32 + hashed string seeds.
// The same input seed always produces the same stream of values.

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard-normal via Box-Muller. */
export function randNormal(rng: () => number, mean = 0, stdev = 1): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return mean + stdev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
