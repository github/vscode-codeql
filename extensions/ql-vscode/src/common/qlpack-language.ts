import { QueryLanguage } from "./query-language";
import { loadQlpackFile } from "../packaging/qlpack-file-loader";

/**
 * @param qlpackPath The path to the `qlpack.yml` or `codeql-pack.yml` file.
 * @return the language of the given qlpack file, or undefined if the file is
 * not a valid qlpack file or does not contain exactly one language.
 */
export async function getQlPackLanguage(
  qlpackPath: string,
): Promise<QueryLanguage | undefined> {
  const qlPack = await loadQlpackFile(qlpackPath);
  const dependencies = qlPack?.dependencies;
  if (!dependencies) {
    return;
  }

  const matchingLanguages = Object.values(QueryLanguage).filter(
    (language) => `codeql/${language}-all` in dependencies,
  );
  if (matchingLanguages.length !== 1) {
    return undefined;
  }

  return matchingLanguages[0];
}
