export function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 123456789
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items]
  const rng = createSeededRng(seed)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
