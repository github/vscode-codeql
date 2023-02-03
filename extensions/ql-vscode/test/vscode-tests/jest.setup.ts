import { env } from "vscode";
import { beforeEachAction } from "./test-config";

beforeEach(async () => {
  jest.spyOn(env, "openExternal").mockResolvedValue(false);

  await beforeEachAction();
});
