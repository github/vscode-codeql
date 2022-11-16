import * as unzipper from "unzipper";

/**
 * Unzips a zip file to a directory.
 * @param sourcePath The path to the zip file.
 * @param destinationPath The path to the directory to unzip to.
 */
export async function unzipFile(sourcePath: string, destinationPath: string) {
  const file = await unzipper.Open.file(sourcePath);
  await file.extract({ path: destinationPath });
}
