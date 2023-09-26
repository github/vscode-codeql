import { SuiteInstruction } from "./suite-instruction";

/**
 * The qlpack pack file, either in qlpack.yml or in codeql-pack.yml.
 */
export interface QlPackFile {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  extensionTargets?: Record<string, string>;
  dbscheme?: string;
  library?: boolean;
  defaultSuite?: SuiteInstruction[];
  defaultSuiteFile?: string;
  dataExtensions?: string[] | string;
}
