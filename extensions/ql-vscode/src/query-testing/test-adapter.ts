import { extname } from "path";

/**
 * Get the full path of the `.expected` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getExpectedFile(testPath: string): string {
  return getTestOutputFile(testPath, ".expected");
}

/**
 * Get the full path of the `.actual` file for the specified QL test.
 * @param testPath The full path to the test file.
 */
export function getActualFile(testPath: string): string {
  return getTestOutputFile(testPath, ".actual");
}

/**
 * Gets the the full path to a particular output file of the specified QL test.
 * @param testPath The full path to the QL test.
 * @param extension The file extension of the output file.
 */
function getTestOutputFile(testPath: string, extension: string): string {
  return changeExtension(testPath, extension);
}

/**
 * Change the file extension of the specified path.
 * @param p The original file path.
 * @param ext The new extension, including the `.`.
 */
function changeExtension(p: string, ext: string): string {
  return p.slice(0, -extname(p).length) + ext;
}
