import { join } from "path";
import {
  CancellationTokenSource,
  commands,
  ExtensionContext,
  extensions,
  QuickPickItem,
  Uri,
  window,
} from "vscode";
import { load } from "js-yaml";

import { QlPack } from "../../../remote-queries/run-remote-query";
import { CodeQLCliServer } from "../../../cli";
import { CodeQLExtensionInterface } from "../../../extension";
import {
  setRemoteControllerRepo,
  setRemoteRepositoryLists,
} from "../../../config";
import { UserCancellationException } from "../../../commandRunner";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { Repository } from "../../../remote-queries/gh-api/repository";
import { createMockExtensionContext } from "../../no-workspace";
import { OutputChannelLogger } from "../../../common";
import { RemoteQueriesSubmission } from "../../../remote-queries/shared/remote-queries";
import { readBundledPack } from "../../utils/bundled-pack-helpers";
import { RemoteQueriesManager } from "../../../remote-queries/remote-queries-manager";
import { Credentials } from "../../../authentication";
import {
  fixWorkspaceReferences,
  restoreWorkspaceReferences,
} from "../global.helper";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Remote queries", () => {
  const baseDir = join(
    __dirname,
    "../../../../src/vscode-tests/cli-integration",
  );

  const qlpackFileWithWorkspaceRefs = getFile(
    "data-remote-qlpack/qlpack.yml",
  ).fsPath;

  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  const progress = jest.fn();
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let getRepositoryFromNwoStub: jest.SpiedFunction<
    typeof ghApiClient.getRepositoryFromNwo
  >;
  let ctx: ExtensionContext;
  let logger: any;
  let remoteQueriesManager: RemoteQueriesManager;

  let originalDeps: Record<string, string> | undefined;

  beforeEach(async () => {
    showQuickPickSpy = jest.spyOn(window, "showQuickPick");
    getRepositoryFromNwoStub = jest.spyOn(ghApiClient, "getRepositoryFromNwo");

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    if ("cliServer" in extension) {
      cli = extension.cliServer;
    } else {
      throw new Error(
        "Extension not initialized. Make sure cli is downloaded and installed properly.",
      );
    }

    ctx = createMockExtensionContext();

    logger = new OutputChannelLogger("test-logger");
    remoteQueriesManager = new RemoteQueriesManager(
      ctx,
      cli,
      "fake-storage-dir",
      logger,
    );

    cancellationTokenSource = new CancellationTokenSource();

    // Should not have asked for a language
    showQuickPickSpy
      .mockResolvedValueOnce({
        repositories: ["github/vscode-codeql"],
      } as unknown as QuickPickItem)
      .mockResolvedValue("javascript" as unknown as QuickPickItem);

    const dummyRepository: Repository = {
      id: 123,
      name: "vscode-codeql",
      full_name: "github/vscode-codeql",
      private: false,
    };
    getRepositoryFromNwoStub.mockResolvedValue(dummyRepository);

    // always run in the vscode-codeql repo
    await setRemoteControllerRepo("github/vscode-codeql");
    await setRemoteRepositoryLists({
      "vscode-codeql": ["github/vscode-codeql"],
    });

    const mockCredentials = {
      getOctokit: () =>
        Promise.resolve({
          request: undefined,
        }),
    } as unknown as Credentials;
    jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);

    // Only new version support `${workspace}` in qlpack.yml
    originalDeps = await fixWorkspaceReferences(
      qlpackFileWithWorkspaceRefs,
      cli,
    );
  });

  afterEach(async () => {
    await restoreWorkspaceReferences(qlpackFileWithWorkspaceRefs, originalDeps);
  });

  describe("runRemoteQuery", () => {
    let mockSubmitRemoteQueries: jest.SpiedFunction<
      typeof ghApiClient.submitRemoteQueries
    >;
    let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;

    beforeEach(() => {
      mockSubmitRemoteQueries = jest
        .spyOn(ghApiClient, "submitRemoteQueries")
        .mockResolvedValue({
          workflow_run_id: 20,
          repositories_queried: ["octodemo/hello-world-1"],
        });

      executeCommandSpy = jest.spyOn(commands, "executeCommand");
    });

    it("should run a remote query that is part of a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).toBeCalledTimes(1);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorRemoteQuery",
        expect.any(String),
        expect.objectContaining({ queryFilePath: fileUri.fsPath }),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.mock.calls[0][1];

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      expect(showQuickPickSpy).toBeCalledTimes(1);

      expect(getRepositoryFromNwoStub).toBeCalledTimes(1);

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("in-pack.ql")).toBe(true);
      expect(packFS.fileExists("lib.qll")).toBe(true);
      expect(packFS.fileExists("qlpack.yml")).toBe(true);

      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).toBe(true);
      expect(packFS.fileExists("not-in-pack.ql")).toBe(false);

      // should have generated a correct qlpack file
      const qlpackContents: any = load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).toBe("codeql-remote/query");

      verifyQlPack("in-pack.ql", packFS.fileContents("qlpack.yml"), "0.0.0");

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      expect(packNames).toContain("javascript-all");
      expect(packNames.length).toBeLessThan(3);
    });

    it("should run a remote query that is not part of a qlpack", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).toBeCalledTimes(1);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorRemoteQuery",
        expect.any(String),
        expect.objectContaining({ queryFilePath: fileUri.fsPath }),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.mock.calls[0][1];

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      // and a second time to ask for the language
      expect(showQuickPickSpy).toBeCalledTimes(2);

      expect(getRepositoryFromNwoStub).toBeCalledTimes(1);

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("in-pack.ql")).toBe(true);
      expect(packFS.fileExists("qlpack.yml")).toBe(true);
      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).toBe(true);
      expect(packFS.fileExists("lib.qll")).toBe(false);
      expect(packFS.fileExists("not-in-pack.ql")).toBe(false);

      // the compiled pack
      verifyQlPack("in-pack.ql", packFS.fileContents("qlpack.yml"), "0.0.0");

      // should have generated a correct qlpack file
      const qlpackContents: any = load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).toBe("codeql-remote/query");
      expect(qlpackContents.version).toBe("0.0.0");
      expect(qlpackContents.dependencies?.["codeql/javascript-all"]).toBe("*");

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      expect(packNames).toContain("javascript-all");
      expect(packNames.length).toBeLessThan(3);
    });

    it("should run a remote query that is nested inside a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack-nested/subfolder/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).toBeCalledTimes(1);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorRemoteQuery",
        expect.any(String),
        expect.objectContaining({ queryFilePath: fileUri.fsPath }),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.mock.calls[0][1];

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      expect(showQuickPickSpy).toBeCalledTimes(1);

      expect(getRepositoryFromNwoStub).toBeCalledTimes(1);

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("subfolder/in-pack.ql")).toBe(true);
      expect(packFS.fileExists("qlpack.yml")).toBe(true);
      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).toBe(true);
      expect(packFS.fileExists("otherfolder/lib.qll")).toBe(true);
      expect(packFS.fileExists("not-in-pack.ql")).toBe(false);

      // the compiled pack
      verifyQlPack(
        "subfolder/in-pack.ql",
        packFS.fileContents("qlpack.yml"),
        "0.0.0",
      );

      // should have generated a correct qlpack file
      const qlpackContents: any = load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).toBe("codeql-remote/query");
      expect(qlpackContents.version).toBe("0.0.0");
      expect(qlpackContents.dependencies?.["codeql/javascript-all"]).toBe("*");

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      expect(packNames).toContain("javascript-all");
      expect(packNames.length).toBeLessThan(3);
    });

    it("should cancel a run before uploading", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      const promise = remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      cancellationTokenSource.cancel();

      await expect(promise).rejects.toThrow(UserCancellationException);
    });
  });

  function verifyQlPack(
    queryPath: string,
    contents: Buffer,
    packVersion: string,
  ) {
    const qlPack = load(contents.toString("utf-8")) as QlPack;

    // don't check the build metadata since it is variable
    delete (qlPack as any).buildMetadata;

    expect(qlPack).toEqual({
      name: "codeql-remote/query",
      version: packVersion,
      dependencies: {
        "codeql/javascript-all": "*",
      },
      library: false,
      defaultSuite: [
        {
          description: "Query suite for variant analysis",
        },
        {
          query: queryPath,
        },
      ],
    });
  }

  function getFile(file: string): Uri {
    return Uri.file(join(baseDir, file));
  }
});
