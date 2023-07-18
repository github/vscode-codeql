export function previewAnnotations(entry = []) {
  return [...entry, require.resolve("./preview.ts")];
}

export function managerEntries(entry = []) {
  return [...entry, require.resolve("./manager.tsx")];
}
