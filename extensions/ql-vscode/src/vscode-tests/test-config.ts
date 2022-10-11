import { ConfigurationTarget } from 'vscode';
import { CUSTOM_CODEQL_PATH_SETTING, InspectionResult, REMOTE_CONTROLLER_REPO, REMOTE_REPO_LISTS, Setting } from '../config';

class TestSetting<T> {
  private settingState: InspectionResult<T> | undefined;

  constructor(
    public readonly setting: Setting,
    private initialTestValue: T | undefined = undefined
  ) { }

  public async get(): Promise<T | undefined> {
    return this.setting.getValue();
  }

  public async set(value: T | undefined, target: ConfigurationTarget = ConfigurationTarget.Global): Promise<void> {
    await this.setting.updateValue(value, target);
  }

  public async setInitialTestValue(value: T | undefined) {
    this.initialTestValue = value;
  }

  public async initialSetup() {
    this.settingState = this.setting.inspect();

    // Unfortunately it's not well-documented how to check whether we can write to a workspace
    // configuration. This is the best I could come up with. It only fails for initial test values
    // which are not undefined.
    if (this.settingState?.workspaceValue !== undefined) {
      await this.set(this.initialTestValue, ConfigurationTarget.Workspace);
    }
    if (this.settingState?.workspaceFolderValue !== undefined) {
      await this.set(this.initialTestValue, ConfigurationTarget.WorkspaceFolder);
    }

    await this.setup();
  }

  public async setup() {
    await this.set(this.initialTestValue, ConfigurationTarget.Global);
  }

  public async restoreToInitialValues() {
    const state = this.setting.inspect();

    // We need to check the state of the setting before we restore it. This is less important for the global
    // configuration target, but the workspace/workspace folder configuration might not even exist. If they
    // don't exist, VSCode will error when trying to write the new value (even if that value is undefined).
    if (state?.globalValue !== this.settingState?.globalValue) {
      await this.set(this.settingState?.globalValue, ConfigurationTarget.Global);
    }
    if (state?.workspaceValue !== this.settingState?.workspaceValue) {
      await this.set(this.settingState?.workspaceValue, ConfigurationTarget.Workspace);
    }
    if (state?.workspaceFolderValue !== this.settingState?.workspaceFolderValue) {
      await this.set(this.settingState?.workspaceFolderValue, ConfigurationTarget.WorkspaceFolder);
    }
  }
}

export const testConfig = {
  remoteControllerRepo: new TestSetting<string>(REMOTE_CONTROLLER_REPO),
  remoteRepoLists: new TestSetting<Record<string, string[]>>(REMOTE_REPO_LISTS),
  cliExecutablePath: new TestSetting<string>(CUSTOM_CODEQL_PATH_SETTING),
};

export const testConfigHelper = async (mocha: Mocha) => {
  // Read in all current settings
  await Promise.all(Object.values(testConfig).map(setting => setting.initialSetup()));

  mocha.rootHooks({
    async beforeEach() {
      // Reset the settings to their initial values before each test
      await Promise.all(Object.values(testConfig).map(setting => setting.setup()));
    },
    async afterAll() {
      // Restore all settings to their default values after each test suite
      await Promise.all(Object.values(testConfig).map(setting => setting.restoreToInitialValues()));
    }
  });
};
