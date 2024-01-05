import type { QlPackFile } from "../packaging/qlpack-file";

export type ExtensionPackMetadata = QlPackFile & {
  // Make name, version, extensionTargets, and dataExtensions required
  name: string;
  version: string;
  extensionTargets: Record<string, string>;
  dataExtensions: string[] | string;
};
