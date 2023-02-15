import { CUSTOM_CODEQL_PATH_SETTING } from "../../src/config";
import { ConfigurationTarget, env, extensions } from "vscode";
import { beforeEachAction as testConfigBeforeEachAction } from "./test-config";

jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
});

export async function beforeAllAction() {
  // Set the CLI version here before activation to ensure we don't accidentally try to download a cli
  await testConfigBeforeEachAction();
  await CUSTOM_CODEQL_PATH_SETTING.updateValue(
    process.env.CLI_PATH,
    ConfigurationTarget.Workspace,
  );

  // Activate the extension
  await extensions.getExtension("GitHub.vscode-codeql")?.activate();
}

export async function beforeEachAction() {
  jest.spyOn(env, "openExternal").mockResolvedValue(false);

  await testConfigBeforeEachAction();

  await CUSTOM_CODEQL_PATH_SETTING.updateValue(
    process.env.CLI_PATH,
    ConfigurationTarget.Workspace,
  );
}
