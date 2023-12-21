import { load } from "js-yaml";
import { readFile } from "fs-extra";
import { QlPackFile } from "../packaging/qlpack-file";
import { QueryLanguage } from "./query-language";

/**
 * @param qlpackPath The path to the `qlpack.yml` or `codeql-pack.yml` file.
 * @return the language of the given qlpack file, or undefined if the file is
 * not a valid qlpack file or does not contain exactly one language.
 */
export async function getQlPackLanguage(
  qlpackPath: string,
): Promise<QueryLanguage | undefined> {
  const qlPack = load(await readFile(qlpackPath, "utf8")) as
    | QlPackFile
    | undefined;
  const dependencies = qlPack?.dependencies;
  if (!dependencies || typeof dependencies !== "object") {
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
