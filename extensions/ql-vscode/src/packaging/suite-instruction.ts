/**
 * A single entry in a .qls file.
 */
export interface SuiteInstruction {
  qlpack?: string;
  query?: string;
  queries?: string;
  include?: Record<string, string[] | string>;
  exclude?: Record<string, string[] | string>;
  description?: string;
  import?: string;
  from?: string;
}
