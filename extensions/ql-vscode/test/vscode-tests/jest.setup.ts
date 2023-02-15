import { env } from "vscode";
import { beforeEachAction } from "./test-config";

jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
});

beforeEach(async () => {
  jest.spyOn(env, "openExternal").mockResolvedValue(false);

  await beforeEachAction();
});
