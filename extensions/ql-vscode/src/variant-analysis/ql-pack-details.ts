/**
 * Details about the original QL pack that is used for triggering
 * a variant analysis.
 */
export interface QlPackDetails {
  queryFile: string;

  // The path to the QL pack that is used for triggering a variant analysis.
  // If there is no query pack, this is the same as the directory of the query files.
  qlPackRootPath: string;

  // The path to the QL pack file (a qlpack.yml or codeql-pack.yml) or undefined if
  // it doesn't exist.
  qlPackFilePath: string | undefined;
}
