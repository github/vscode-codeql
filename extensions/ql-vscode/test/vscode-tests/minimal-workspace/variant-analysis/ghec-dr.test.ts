import { ConfigurationTarget } from "vscode";
import {
  VARIANT_ANALYSIS_ENABLE_GHEC_DR,
  VSCODE_GITHUB_ENTERPRISE_URI_SETTING,
} from "../../../../src/config";
import { isVariantAnalysisEnabledForGitHubHost } from "../../../../src/variant-analysis/ghec-dr";

describe("checkVariantAnalysisEnabled", () => {
  it("returns cleanly when no enterprise URI is set", async () => {
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(true);
  });

  it("returns false when GHES enterprise URI is set and variant analysis feature flag is not set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://github.example.com",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(false);
  });

  it("returns false when GHES enterprise URI is set and variant analysis feature flag is set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://github.example.com",
      ConfigurationTarget.Global,
    );
    await VARIANT_ANALYSIS_ENABLE_GHEC_DR.updateValue(
      "true",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(false);
  });

  it("returns false when GHEC-DR URI is set and variant analysis feature flag is not set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://example.ghe.com",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(false);
  });

  it("returns true when GHEC-DR URI is set and variant analysis feature flag is set", async () => {
    await VSCODE_GITHUB_ENTERPRISE_URI_SETTING.updateValue(
      "https://example.ghe.com",
      ConfigurationTarget.Global,
    );
    await VARIANT_ANALYSIS_ENABLE_GHEC_DR.updateValue(
      "true",
      ConfigurationTarget.Global,
    );
    expect(isVariantAnalysisEnabledForGitHubHost()).toBe(true);
  });
});
