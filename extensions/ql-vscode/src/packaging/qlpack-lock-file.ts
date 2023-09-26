/**
 * The qlpack lock file, either in qlpack.lock.yml or in codeql-pack.lock.yml.
 */
export interface QlPackLockFile {
  lockVersion: string;
  dependencies?: Record<string, string>;
  compiled?: boolean;
}
