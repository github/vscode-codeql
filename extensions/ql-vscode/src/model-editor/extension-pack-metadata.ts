import { QlPackFile } from "../packaging/qlpack-file";

export type ExtensionPackMetadata = QlPackFile & {
  // Make both extensionTargets and dataExtensions required
  extensionTargets: Record<string, string>;
  dataExtensions: string[] | string;
};
