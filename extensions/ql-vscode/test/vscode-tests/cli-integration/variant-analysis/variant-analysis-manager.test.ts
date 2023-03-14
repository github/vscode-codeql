import {
  CancellationTokenSource,
  commands,
  extensions,
  Uri,
  window,
} from "vscode";
import { CodeQLExtensionInterface } from "../../../../src/extension";
import { extLogger } from "../../../../src/common";
import { setRemoteControllerRepo } from "../../../../src/config";
import * as ghApiClient from "../../../../src/variant-analysis/gh-api/gh-api-client";
import { join } from "path";

import { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { CliVersionConstraint, CodeQLCliServer } from "../../../../src/cli";
import {
  fixWorkspaceReferences,
  restoreWorkspaceReferences,
  storagePath,
} from "../../global.helper";
import { VariantAnalysisResultsManager } from "../../../../src/variant-analysis/variant-analysis-results-manager";
import {
  VariantAnalysisStatus,
  VariantAnalysisSubmission,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { VariantAnalysis as VariantAnalysisApiResponse } from "../../../../src/variant-analysis/gh-api/variant-analysis";
import { createMockApiResponse } from "../../../factories/variant-analysis/gh-api/variant-analysis-api-response";
import { UserCancellationException } from "../../../../src/commandRunner";
import { Repository } from "../../../../src/variant-analysis/gh-api/repository";
import { DbManager } from "../../../../src/databases/db-manager";
import { ExtensionApp } from "../../../../src/common/vscode/vscode-app";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { QueryLanguage } from "../../../../src/common/query-language";
import { readBundledPack } from "../../utils/bundled-pack-helpers";
import { load } from "js-yaml";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Variant Analysis Manager", () => {
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;

  beforeEach(async () => {
    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    cancellationTokenSource = new CancellationTokenSource();

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    cli = extension.cliServer;
    const app = new ExtensionApp(extension.ctx);
    const dbManager = new DbManager(app, new DbConfigStore(app));
    const variantAnalysisResultsManager = new VariantAnalysisResultsManager(
      cli,
      extLogger,
    );
    variantAnalysisManager = new VariantAnalysisManager(
      extension.ctx,
      app,
      cli,
      storagePath,
      variantAnalysisResultsManager,
      dbManager,
    );
  });

  describe("runVariantAnalysis", () => {
    const progress = jest.fn();
    let mockGetRepositoryFromNwo: jest.SpiedFunction<
      typeof ghApiClient.getRepositoryFromNwo
    >;
    let mockSubmitVariantAnalysis: jest.SpiedFunction<
      typeof ghApiClient.submitVariantAnalysis
    >;
    let mockApiResponse: VariantAnalysisApiResponse;
    let originalDeps: Record<string, string> | undefined;
    let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;

    const baseDir = join(__dirname, "..");
    const qlpackFileWithWorkspaceRefs = getFile(
      "data-remote-qlpack/qlpack.yml",
    ).fsPath;

    beforeEach(async () => {
      jest
        .spyOn(window, "showQuickPick")
        .mockResolvedValueOnce(mockedQuickPickItem("javascript"));

      cancellationTokenSource = new CancellationTokenSource();

      const dummyRepository: Repository = {
        id: 123,
        name: "vscode-codeql",
        full_name: "github/vscode-codeql",
        private: false,
      };
      mockGetRepositoryFromNwo = jest
        .spyOn(ghApiClient, "getRepositoryFromNwo")
        .mockResolvedValue(dummyRepository);

      mockApiResponse = createMockApiResponse("in_progress");
      mockSubmitVariantAnalysis = jest
        .spyOn(ghApiClient, "submitVariantAnalysis")
        .mockResolvedValue(mockApiResponse);

      executeCommandSpy = jest.spyOn(commands, "executeCommand");

      // always run in the vscode-codeql repo
      await setRemoteControllerRepo("github/vscode-codeql");

      // Only new version support `${workspace}` in qlpack.yml
      originalDeps = await fixWorkspaceReferences(
        qlpackFileWithWorkspaceRefs,
        cli,
      );
    });

    afterEach(async () => {
      await restoreWorkspaceReferences(
        qlpackFileWithWorkspaceRefs,
        originalDeps,
      );
    });

    it("should run a variant analysis that is part of a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should run a remote query that is not part of a qlpack", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should run a remote query that is nested inside a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack-nested/subfolder/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should cancel a run before uploading", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      const promise = variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      cancellationTokenSource.cancel();

      await expect(promise).rejects.toThrow(UserCancellationException);
    });

    describe("check variant analysis generated packs", () => {
      beforeEach(() => {
        mockSubmitVariantAnalysis = jest
          .spyOn(ghApiClient, "submitVariantAnalysis")
          .mockResolvedValue({
            id: 1,
            query_language: QueryLanguage.Javascript,
            query_pack_url: "http://example.com",
            created_at: "2021-01-01T00:00:00Z",
            updated_at: "2021-01-01T00:00:00Z",
            status: "in_progress",
            controller_repo: {
              id: 1,
              name: "vscode-codeql",
              full_name: "github/vscode-codeql",
              private: false,
            },
            actions_workflow_run_id: 20,
            scanned_repositories: [] as any[],
          });

        executeCommandSpy = jest.spyOn(commands, "executeCommand");
      });

      it("should run a remote query that is part of a qlpack", async () => {
        await doVariantAnalysisTest({
          queryPath: "data-remote-qlpack/in-pack.ql",
          filesThatExist: ["in-pack.ql", "lib.qll"],
          filesThatDoNotExist: [],
          qlxFilesThatExist: ["in-pack.qlx"],
        });
      });

      it("should run a remote query that is not part of a qlpack", async () => {
        await doVariantAnalysisTest({
          queryPath: "data-remote-no-qlpack/in-pack.ql",
          filesThatExist: ["in-pack.ql"],
          filesThatDoNotExist: ["lib.qll", "not-in-pack.ql"],
          qlxFilesThatExist: ["in-pack.qlx"],
        });
      });

      it("should run a remote query that is nested inside a qlpack", async () => {
        await doVariantAnalysisTest({
          queryPath: "data-remote-qlpack-nested/subfolder/in-pack.ql",
          filesThatExist: ["subfolder/in-pack.ql", "otherfolder/lib.qll"],
          filesThatDoNotExist: ["subfolder/not-in-pack.ql"],
          qlxFilesThatExist: ["subfolder/in-pack.qlx"],
        });
      });

      it("should run a remote query with extension packs inside a qlpack", async () => {
        if (!(await cli.cliConstraints.supportsQlpacksKind())) {
          console.log(
            `Skipping test because qlpacks kind is only suppported in CLI version ${CliVersionConstraint.CLI_VERSION_WITH_QLPACKS_KIND} or later.`,
          );
          return;
        }
        await cli.setUseExtensionPacks(true);
        await doVariantAnalysisTest({
          queryPath: "data-remote-qlpack-nested/subfolder/in-pack.ql",
          filesThatExist: [
            "subfolder/in-pack.ql",
            "otherfolder/lib.qll",
            ".codeql/libraries/semmle/targets-extension/0.0.0/ext/extension.yml",
          ],
          filesThatDoNotExist: ["subfolder/not-in-pack.ql"],
          qlxFilesThatExist: ["subfolder/in-pack.qlx"],
          dependenciesToCheck: [
            "codeql/javascript-all",
            "semmle/targets-extension",
          ],
        });
      });
    });

    async function doVariantAnalysisTest({
      queryPath,
      filesThatExist,
      qlxFilesThatExist,
      filesThatDoNotExist,
      dependenciesToCheck = ["codeql/javascript-all"],
    }: {
      queryPath: string;
      filesThatExist: string[];
      qlxFilesThatExist: string[];
      filesThatDoNotExist: string[];
      dependenciesToCheck?: string[];
    }) {
      const fileUri = getFile(queryPath);
      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          query: expect.objectContaining({ filePath: fileUri.fsPath }),
        }),
      );

      const request: VariantAnalysisSubmission =
        mockSubmitVariantAnalysis.mock.calls[0][1];

      const packFS = await readBundledPack(request.query.pack);
      filesThatExist.forEach((file) => {
        expect(packFS.fileExists(file)).toBe(true);
      });

      if (await cli.cliConstraints.supportsQlxRemote()) {
        qlxFilesThatExist.forEach((file) => {
          expect(packFS.fileExists(file)).toBe(true);
        });
      }
      filesThatDoNotExist.forEach((file) => {
        expect(packFS.fileExists(file)).toBe(false);
      });

      expect(
        packFS.fileExists("qlpack.yml") || packFS.fileExists("codeql-pack.yml"),
      ).toBe(true);

      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).toBe(true);

      const packFileName = packFS.fileExists("qlpack.yml")
        ? "qlpack.yml"
        : "codeql-pack.yml";
      const qlpackContents = load(
        packFS.fileContents(packFileName).toString("utf-8"),
      );
      expect(qlpackContents.name).toEqual("codeql-remote/query");
      expect(qlpackContents.version).toEqual("0.0.0");
      expect(qlpackContents.dependencies?.["codeql/javascript-all"]).toEqual(
        "*",
      );

      const qlpackLockContents = load(
        packFS.fileContents("codeql-pack.lock.yml").toString("utf-8"),
      );

      const actualLockKeys = Object.keys(qlpackLockContents.dependencies);

      // The lock file should contain at least the specified dependencies.
      dependenciesToCheck.forEach((dep) =>
        expect(actualLockKeys).toContain(dep),
      );
    }

    function getFile(file: string): Uri {
      return Uri.file(join(baseDir, file));
    }
  });
});
