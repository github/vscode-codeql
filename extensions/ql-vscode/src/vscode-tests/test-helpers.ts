import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Recursively walk a directory and return the full path to all files found.
 * Note that this function uses synchronous fs calls, so it should only be used in tests.
 *
 * @param dir the directory to walk
 */
export function* walk(dir: string): IterableIterator<string> {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      yield* walk(filePath);
    } else {
      yield filePath;
    }
  }
}
