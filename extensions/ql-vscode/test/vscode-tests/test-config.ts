import { readFileSync } from "fs-extra";
import { join } from "path";
import { ConfigurationTarget } from "vscode";
import { ALL_SETTINGS, InspectionResult, Setting } from "../../src/config";

class TestSetting<T> {
  private initialSettingState: InspectionResult<T> | undefined;

  constructor(
    public readonly setting: Setting,
    private initialTestValue: T | undefined = undefined,
  ) {}

  public async get(): Promise<T | undefined> {
    return this.setting.getValue();
  }

  public async set(
    value: T | undefined,
    target: ConfigurationTarget = ConfigurationTarget.Global,
  ): Promise<void> {
    await this.setting.updateValue(value, target);
  }

  public async setInitialTestValue(value: T | undefined) {
    this.initialTestValue = value;
  }

  public async initialSetup() {
    this.initialSettingState = this.setting.inspect();

    // Unfortunately it's not well-documented how to check whether we can write to a workspace
    // configuration. This is the best I could come up with. It only fails for initial test values
    // which are not undefined.
    if (this.initialSettingState?.workspaceValue !== undefined) {
      await this.set(this.initialTestValue, ConfigurationTarget.Workspace);
    }
    if (this.initialSettingState?.workspaceFolderValue !== undefined) {
      await this.set(
        this.initialTestValue,
        ConfigurationTarget.WorkspaceFolder,
      );
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
    if (state?.globalValue !== this.initialSettingState?.globalValue) {
      await this.set(
        this.initialSettingState?.globalValue,
        ConfigurationTarget.Global,
      );
    }
    if (state?.workspaceValue !== this.initialSettingState?.workspaceValue) {
      await this.set(
        this.initialSettingState?.workspaceValue,
        ConfigurationTarget.Workspace,
      );
    }
    if (
      state?.workspaceFolderValue !==
      this.initialSettingState?.workspaceFolderValue
    ) {
      await this.set(
        this.initialSettingState?.workspaceFolderValue,
        ConfigurationTarget.WorkspaceFolder,
      );
    }
  }
}

// Public configuration keys are the ones defined in the package.json.
// These keys are documented in the settings page. Other keys are
// internal and not documented.
const PKG_CONFIGURATION: Record<string, any> =
  (function initConfigurationKeys() {
    // Note we are using synchronous file reads here. This is fine because
    // we are in tests.
    const pkg = JSON.parse(
      readFileSync(join(__dirname, "../../package.json"), "utf-8"),
    );
    return pkg.contributes.configuration.properties;
  })();

// The test settings are all settings in ALL_SETTINGS which don't have any children
// and are also not hidden settings like the codeQL.canary.
const TEST_SETTINGS = ALL_SETTINGS.filter(
  (setting) =>
    setting.qualifiedName in PKG_CONFIGURATION && !setting.hasChildren,
).map((setting) => new TestSetting(setting));

export const getTestSetting = (
  setting: Setting,
): TestSetting<unknown> | undefined => {
  return TEST_SETTINGS.find((testSetting) => testSetting.setting === setting);
};

export const jestTestConfigHelper = async () => {
  // Read in all current settings
  await Promise.all(TEST_SETTINGS.map((setting) => setting.initialSetup()));

  beforeEach(async () => {
    // Reset the settings to their initial values before each test
    await Promise.all(TEST_SETTINGS.map((setting) => setting.setup()));
  });

  afterAll(async () => {
    // Restore all settings to their default values after each test suite
    // Only do this outside of CI since the sometimes hangs on CI.
    if (process.env.CI !== "true") {
      await Promise.all(
        TEST_SETTINGS.map((setting) => setting.restoreToInitialValues()),
      );
    }
  });
};
