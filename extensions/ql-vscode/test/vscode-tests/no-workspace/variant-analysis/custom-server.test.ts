import { window } from "vscode";
import type { AppCommandManager } from "../../../../src/common/commands";
import { exportVariantAnalysisResults } from "../../../../src/variant-analysis/export-results";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { testCredentialsWithStub } from "../../../factories/authentication";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { mockedObject } from "../../utils/mocking.helpers";

const SERVER_URL = "https://mrva.example.com";

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
