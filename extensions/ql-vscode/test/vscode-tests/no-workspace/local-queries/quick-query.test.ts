import { window, workspace } from "vscode";
import { dirSync } from "tmp";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { ExtensionApp } from "../../../../src/common/vscode/extension-app";
import type { DatabaseUI } from "../../../../src/databases/local-databases-ui";
import { displayQuickQuery } from "../../../../src/local-queries/quick-query";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockedObject } from "../../utils/mocking.helpers";

describe("Quick Query without a workspace", () => {
  it("shows the existing warning instead of a storage-path error", async () => {
    const dir = dirSync({ unsafeCleanup: true });
    const warning = jest
      .spyOn(window, "showWarningMessage")
      .mockResolvedValue(undefined);

    try {
      expect(workspace.workspaceFile).toBeUndefined();
      expect(workspace.workspaceFolders ?? []).toHaveLength(0);

      const app = mockedObject<ExtensionApp>({
        ...createMockApp({ globalStoragePath: dir.name }),
        workspaceStoragePath: undefined,
      });

      await displayQuickQuery(
        app,
        mockedObject<CodeQLCliServer>({}),
        mockedObject<DatabaseUI>({}),
        jest.fn(),
      );

      expect(warning).toHaveBeenCalledWith(
        '"Quick query" requires reloading your workspace as a multi-root workspace, which may cause query history and databases to be lost.',
        {
          modal: true,
          detail:
            'The "Create query" command does not require reloading the workspace.',
        },
        'Run "Create query"',
        'Run "Quick query" anyway',
      );
    } finally {
      warning.mockRestore();
      dir.removeCallback();
    }
  });
});
