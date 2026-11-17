import { ConfigurationTarget, window, workspace } from "vscode";
import type { AppCommandManager } from "../../../../src/common/commands";
import {
  getVariantAnalysisServerConfig,
  isVariantAnalysisServerConfigured,
} from "../../../../src/config";
import { exportVariantAnalysisResults } from "../../../../src/variant-analysis/export-results";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { testCredentialsWithStub } from "../../../factories/authentication";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { mockedObject } from "../../utils/mocking.helpers";

const SERVER_URL = "https://mrva.example.com";
const PROVIDER_ID = "example.token-provider";

async function setSetting(
  name: string,
  value: unknown,
  target = ConfigurationTarget.Global,
) {
  await workspace
    .getConfiguration("codeQL.variantAnalysis")
    .update(name, value, target);
}

describe("exporting custom-server results", () => {
  it.each([undefined, SERVER_URL])(
    "only offers a gist for GitHub runs (server: %s)",
    async (serverUrl) => {
      const showQuickPick = jest
        .spyOn(window, "showQuickPick")
        .mockResolvedValue(undefined);
      const run = { ...createMockVariantAnalysis({}), serverUrl };

      await expect(
        exportVariantAnalysisResults(
          mockedObject<VariantAnalysisManager>({
            tryGetVariantAnalysis: () => run,
            getRepoStates: () => [],
          }),
          run.id,
          undefined,
          mockedObject<AppCommandManager>({}),
          testCredentialsWithStub(),
        ),
      ).rejects.toThrow("No export format selected");

      const [items] = showQuickPick.mock.calls[0] as [Array<{ label: string }>];
      expect(items.some((item) => item.label.includes("Gist"))).toBe(
        !serverUrl,
      );
    },
  );
});

describe("variant analysis server settings", () => {
  it.each([undefined, null, " "])(
    "is not configured when the URL is %p",
    async (url) => {
      await setSetting("serverUrl", url);
      expect(getVariantAnalysisServerConfig()).toBeUndefined();
      expect(isVariantAnalysisServerConfigured()).toBe(false);
    },
  );

  it("reads the server from user settings, keeping a base path", async () => {
    await setSetting("serverUrl", `${SERVER_URL}/api/`);
    await setSetting("serverTokenProvider", PROVIDER_ID);
    expect(getVariantAnalysisServerConfig()).toEqual({
      url: `${SERVER_URL}/api`,
      tokenProviderExtensionId: PROVIDER_ID,
    });
  });

  it("ignores workspace settings", async () => {
    for (const target of [
      ConfigurationTarget.Workspace,
      ConfigurationTarget.WorkspaceFolder,
    ]) {
      await setSetting("serverUrl", SERVER_URL, target);
      await setSetting("serverTokenProvider", PROVIDER_ID, target);
    }
    expect(isVariantAnalysisServerConfigured()).toBe(false);

    await setSetting("serverUrl", SERVER_URL);
    expect(getVariantAnalysisServerConfig()).toEqual({
      url: SERVER_URL,
      tokenProviderExtensionId: undefined,
    });
  });

  it.each([
    "http://mrva.example.com",
    "https://user:pw@mrva.example.com",
    `${SERVER_URL}/?environment=test`,
    `${SERVER_URL}/#fragment`,
    `${SERVER_URL}/?`,
    `${SERVER_URL}/#`,
    "not a URL",
    42,
  ])("rejects %p but still counts it as configured", async (url) => {
    await setSetting("serverUrl", url);
    expect(() => getVariantAnalysisServerConfig()).toThrow();
    expect(isVariantAnalysisServerConfigured()).toBe(true);
  });
});
