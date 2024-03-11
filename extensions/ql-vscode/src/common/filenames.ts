type FilenameOptions = {
  removeDots?: boolean;
};

/**
 * This will create a filename from an arbitrary string by removing
 * all characters which are not allowed in filenames and making them
 * more filesystem-friendly be replacing undesirable characters with
 * hyphens. The result will always be lowercase ASCII.
 *
 * @param str The string to create a filename from
 * @param removeDots Whether to remove dots from the filename [default: false]
 * @returns The filename
 */
export function createFilenameFromString(
  str: string,
  { removeDots }: FilenameOptions = {},
) {
  let fileName = str;

  // Lowercase everything
  fileName = fileName.toLowerCase();

  // Replace all spaces, underscores, slashes, and backslashes with hyphens
  fileName = fileName.replaceAll(/[\s_/\\]+/g, "-");

  // Replace all characters which are not allowed by empty strings
  fileName = fileName.replaceAll(/[^a-z0-9.-]/g, "");

  // Remove any leading or trailing hyphens or dots
  fileName = fileName.replaceAll(/^[.-]+|[.-]+$/g, "");

  // Replace dots by hyphens if dots are not allowed
  if (removeDots) {
    fileName = fileName.replaceAll(/\./g, "-");
  }

  // Remove any duplicate hyphens
  fileName = fileName.replaceAll(/-{2,}/g, "-");
  // Remove any duplicate dots
  fileName = fileName.replaceAll(/\.{2,}/g, ".");

  return fileName;
}
