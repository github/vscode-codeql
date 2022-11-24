import { env } from "vscode";
import { jestTestConfigHelper } from "./test-config";

(env as any).openExternal = () => {
  /**/
};

export default async function setupEnv() {
  await jestTestConfigHelper();
}
