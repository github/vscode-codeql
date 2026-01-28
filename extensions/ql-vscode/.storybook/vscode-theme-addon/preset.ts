import { fileURLToPath } from "node:url";

const previewPath = fileURLToPath(new URL("./preview.ts", import.meta.url));
const managerPath = fileURLToPath(new URL("./manager.tsx", import.meta.url));
export function previewAnnotations(entry: string[] = []) {
  return [...entry, previewPath];
}

export function managerEntries(entry: string[] = []) {
  return [...entry, managerPath];
}
