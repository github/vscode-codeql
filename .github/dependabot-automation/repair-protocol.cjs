const maxFiles = 12;
const maxBytes = 100_000;

function allowedFile(name) {
  // Configuration, manifests, workflows, and Docker changes require a decision.
  return (
    /^extensions\/ql-vscode\/(?:src|test|\.storybook)\/[A-Za-z0-9_./ -]+$/.test(
      name,
    ) &&
    !name.split("/").some((part) => part === "." || part === "..") &&
    !name.startsWith("extensions/ql-vscode/test/e2e/docker/") &&
    !/(^|\/)(?:AGENTS|CLAUDE|GEMINI)\.md$/.test(name) &&
    !name.endsWith("/")
  );
}

function validateResult(result) {
  if (
    !result ||
    !["patch", "needs-maintainer"].includes(result.outcome) ||
    typeof result.summary !== "string" ||
    result.summary.trim().length === 0 ||
    result.summary.length > 12_000 ||
    !Array.isArray(result.files)
  ) {
    throw new Error("Invalid Copilot result");
  }
  if (result.outcome !== "patch" && result.files.length !== 0) {
    throw new Error("Only a patch result may publish files");
  }
  if (
    result.files.length > maxFiles ||
    (result.outcome === "patch" && result.files.length === 0)
  ) {
    throw new Error("Repair exceeds the file limit or contains no changes");
  }
  const names = new Set();
  let bytes = 0;
  for (const file of result.files) {
    if (
      typeof file.path !== "string" ||
      !allowedFile(file.path) ||
      names.has(file.path) ||
      (file.content !== null && typeof file.content !== "string")
    ) {
      throw new Error(
        "Repair contains a duplicate, unsupported, or invalid file",
      );
    }
    names.add(file.path);
    bytes += Buffer.byteLength(file.content ?? "");
    if (file.content?.includes("\0")) throw new Error("Binary repair rejected");
  }
  if (bytes > maxBytes) throw new Error("Repair exceeds the content limit");
  return result;
}

module.exports = { allowedFile, validateResult };
