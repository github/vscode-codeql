import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function previewAnnotations(entry = []) {
  return [...entry, join(__dirname, "preview.ts")];
}

export function managerEntries(entry = []) {
  return [...entry, join(__dirname, "manager.tsx")];
}
