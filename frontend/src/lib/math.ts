/** Small numeric helpers shared by the page and the scenes. No imports, so any chunk can use them. */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** `n` modulo `m`, always in [0, m). */
export const mod = (n: number, m: number) => ((n % m) + m) % m;

export const easeOutCubic = (k: number) => 1 - (1 - k) ** 3;
export const easeInCubic = (k: number) => k * k * k;
export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/** Smoothstep on t in [0, 1]. */
export const smoothstep01 = (t: number) => t * t * (3 - 2 * t);
