import { env } from "vscode";
import { jestTestConfigHelper } from "./test-config";

(env as any).openExternal = () => {
  /**/
};

function fail(reason = "fail was called in a test.") {
  throw new Error(reason);
}

// Jest doesn't seem to define this function anymore, but it's in the types, so should be valid.
(global as any).fail = fail;

export default async function setupEnv() {
  await jestTestConfigHelper();
}
