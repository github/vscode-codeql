import type { SuiteInstruction } from "./suite-instruction";

/**
 * The qlpack pack file, either in qlpack.yml or in codeql-pack.yml.
 */
export interface QlPackFile {
  name?: string | null;
  version?: string | null;
  dependencies?: Record<string, string> | null;
  extensionTargets?: Record<string, string> | null;
  dbscheme?: string | null;
  library?: boolean | null;
  defaultSuite?: SuiteInstruction[] | SuiteInstruction | null;
  defaultSuiteFile?: string | null;
  dataExtensions?: string[] | string | null;
}
