export function shuffle<T>(xs: T[]): T[] {
  return xs.sort(() => Math.random() - 0.5);
}
