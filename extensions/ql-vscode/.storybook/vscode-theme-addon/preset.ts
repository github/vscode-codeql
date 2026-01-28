const previewPath = new URL("./preview.ts", import.meta.url).pathname;
const managerPath = new URL("./manager.tsx", import.meta.url).pathname;

export function previewAnnotations(entry: string[] = []) {
  return [...entry, previewPath];
}

export function managerEntries(entry: string[] = []) {
  return [...entry, managerPath];
}
