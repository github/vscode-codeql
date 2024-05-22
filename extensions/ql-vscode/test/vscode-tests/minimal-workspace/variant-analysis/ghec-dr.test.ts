import { ConfigurationTarget } from "vscode";
import { VSCODE_GITHUB_ENTERPRISE_URI_SETTING } from "../../../../src/config";
import { isVariantAnalysisEnabledForGitHubHost } from "../../../../src/variant-analysis/ghec-dr";

describe("checkVariantAnalysisEnabled", () => {
  it("returns true when no enterprise URI is set", async () => {
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(true);
  });

  it("returns false when GHES enterprise URI is set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://github.example.com",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(false);
  });

  it("returns true when a GHEC-DR URI is set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://example.ghe.com",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(true);
  });
});
