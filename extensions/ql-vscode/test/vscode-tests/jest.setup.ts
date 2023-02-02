import { env } from "vscode";
import { beforeEachAction } from "./test-config";

(env as any).openExternal = () => {
  /**/
};

beforeEach(async () => {
  await beforeEachAction();
});
