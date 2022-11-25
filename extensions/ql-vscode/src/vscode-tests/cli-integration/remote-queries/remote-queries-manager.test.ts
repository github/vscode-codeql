import { assert, expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";
import {
  CancellationTokenSource,
  commands,
  ExtensionContext,
  extensions,
  QuickPickItem,
  Uri,
  window,
} from "vscode";
import * as os from "os";
import * as yaml from "js-yaml";

import { QlPack } from "../../../remote-queries/run-remote-query";
import { CliVersionConstraint, CodeQLCliServer } from "../../../cli";
import { CodeQLExtensionInterface } from "../../../extension";
import {
  setRemoteControllerRepo,
  setRemoteRepositoryLists,
} from "../../../config";
import { UserCancellationException } from "../../../commandRunner";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { lte } from "semver";
import { Repository } from "../../../remote-queries/gh-api/repository";
import { createMockExtensionContext } from "../../no-workspace";
import { OutputChannelLogger } from "../../../logging";
import { RemoteQueriesSubmission } from "../../../remote-queries/shared/remote-queries";
import { readBundledPack } from "../../utils/bundled-pack-helpers";
import { RemoteQueriesManager } from "../../../remote-queries/remote-queries-manager";
import { Credentials } from "../../../authentication";
import {
  fixWorkspaceReferences,
  restoreWorkspaceReferences,
} from "../global.helper";

describe("Remote queries", function () {
  const baseDir = path.join(
    __dirname,
    "../../../../src/vscode-tests/cli-integration",
  );

  const qlpackFileWithWorkspaceRefs = getFile(
    "data-remote-qlpack/qlpack.yml",
  ).fsPath;

  let sandbox: sinon.SinonSandbox;

  // up to 3 minutes per test
  this.timeout(3 * 60 * 1000);

  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let progress: sinon.SinonSpy;
  let showQuickPickSpy: sinon.SinonStub;
  let getRepositoryFromNwoStub: sinon.SinonStub;
  let ctx: ExtensionContext;
  let logger: any;
  let remoteQueriesManager: RemoteQueriesManager;

  let originalDeps: Record<string, string> | undefined;

  // use `function` so we have access to `this`
  beforeEach(async function () {
    sandbox = sinon.createSandbox();

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

    if (!(await cli.cliConstraints.supportsRemoteQueries())) {
      console.log(
        `Remote queries are not supported on CodeQL CLI v${CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES}. Skipping this test.`,
      );
      this.skip();
    }

    logger = new OutputChannelLogger("test-logger");
    remoteQueriesManager = new RemoteQueriesManager(
      ctx,
      cli,
      "fake-storage-dir",
      logger,
    );

    cancellationTokenSource = new CancellationTokenSource();

    progress = sandbox.spy();
    // Should not have asked for a language
    showQuickPickSpy = sandbox
      .stub(window, "showQuickPick")
      .onFirstCall()
      .resolves({
        repositories: ["github/vscode-codeql"],
      } as unknown as QuickPickItem)
      .onSecondCall()
      .resolves("javascript" as unknown as QuickPickItem);

    const dummyRepository: Repository = {
      id: 123,
      name: "vscode-codeql",
      full_name: "github/vscode-codeql",
      private: false,
    };
    getRepositoryFromNwoStub = sandbox
      .stub(ghApiClient, "getRepositoryFromNwo")
      .resolves(dummyRepository);

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
    sandbox.stub(Credentials, "initialize").resolves(mockCredentials);

    // Only new version support `${workspace}` in qlpack.yml
    originalDeps = await fixWorkspaceReferences(
      qlpackFileWithWorkspaceRefs,
      cli,
    );
  });

  afterEach(async () => {
    sandbox.restore();
    await restoreWorkspaceReferences(qlpackFileWithWorkspaceRefs, originalDeps);
  });

  describe("runRemoteQuery", () => {
    let mockSubmitRemoteQueries: sinon.SinonStub;
    let executeCommandSpy: sinon.SinonStub;

    beforeEach(() => {
      executeCommandSpy = sandbox
        .stub(commands, "executeCommand")
        .callThrough();

      mockSubmitRemoteQueries = sandbox
        .stub(ghApiClient, "submitRemoteQueries")
        .resolves({
          workflow_run_id: 20,
          repositories_queried: ["octodemo/hello-world-1"],
        });
    });

    it("should run a remote query that is part of a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).to.have.been.calledOnce;
      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorRemoteQuery",
        sinon.match.string,
        sinon.match.has("queryFilePath", fileUri.fsPath),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.getCall(0).lastArg;

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      expect(showQuickPickSpy).to.have.been.calledOnce;

      expect(getRepositoryFromNwoStub).to.have.been.calledOnce;

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("in-pack.ql")).to.be.true;
      expect(packFS.fileExists("lib.qll")).to.be.true;
      expect(packFS.fileExists("qlpack.yml")).to.be.true;

      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).to.be.true;
      expect(packFS.fileExists("not-in-pack.ql")).to.be.false;

      // should have generated a correct qlpack file
      const qlpackContents: any = yaml.load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).to.equal("codeql-remote/query");

      verifyQlPack(
        "in-pack.ql",
        packFS.fileContents("qlpack.yml"),
        "0.0.0",
        await pathSerializationBroken(),
      );

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
      // later only have ['javascript-all']. ensure this test can handle either
      expect(packNames.length).to.be.lessThan(3).and.greaterThan(0);
      expect(packNames[0]).to.deep.equal("javascript-all");
    });

    it("should run a remote query that is not part of a qlpack", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).to.have.been.calledOnce;
      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorRemoteQuery",
        sinon.match.string,
        sinon.match.has("queryFilePath", fileUri.fsPath),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.getCall(0).lastArg;

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      // and a second time to ask for the language
      expect(showQuickPickSpy).to.have.been.calledTwice;

      expect(getRepositoryFromNwoStub).to.have.been.calledOnce;

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("in-pack.ql")).to.be.true;
      expect(packFS.fileExists("qlpack.yml")).to.be.true;
      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).to.be.true;
      expect(packFS.fileExists("lib.qll")).to.be.false;
      expect(packFS.fileExists("not-in-pack.ql")).to.be.false;

      // the compiled pack
      verifyQlPack(
        "in-pack.ql",
        packFS.fileContents("qlpack.yml"),
        "0.0.0",
        await pathSerializationBroken(),
      );

      // should have generated a correct qlpack file
      const qlpackContents: any = yaml.load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).to.equal("codeql-remote/query");
      expect(qlpackContents.version).to.equal("0.0.0");
      expect(qlpackContents.dependencies?.["codeql/javascript-all"]).to.equal(
        "*",
      );

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
      // later only have ['javascript-all']. ensure this test can handle either
      expect(packNames.length).to.be.lessThan(3).and.greaterThan(0);
      expect(packNames[0]).to.deep.equal("javascript-all");
    });

    it("should run a remote query that is nested inside a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack-nested/subfolder/in-pack.ql");

      await remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(mockSubmitRemoteQueries).to.have.been.calledOnce;
      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorRemoteQuery",
        sinon.match.string,
        sinon.match.has("queryFilePath", fileUri.fsPath),
      );

      const request: RemoteQueriesSubmission =
        mockSubmitRemoteQueries.getCall(0).lastArg;

      const packFS = await readBundledPack(request.queryPack);

      // to retrieve the list of repositories
      expect(showQuickPickSpy).to.have.been.calledOnce;

      expect(getRepositoryFromNwoStub).to.have.been.calledOnce;

      // check a few files that we know should exist and others that we know should not
      expect(packFS.fileExists("subfolder/in-pack.ql")).to.be.true;
      expect(packFS.fileExists("qlpack.yml")).to.be.true;
      // depending on the cli version, we should have one of these files
      expect(
        packFS.fileExists("qlpack.lock.yml") ||
          packFS.fileExists("codeql-pack.lock.yml"),
      ).to.be.true;
      expect(packFS.fileExists("otherfolder/lib.qll")).to.be.true;
      expect(packFS.fileExists("not-in-pack.ql")).to.be.false;

      // the compiled pack
      verifyQlPack(
        "subfolder/in-pack.ql",
        packFS.fileContents("qlpack.yml"),
        "0.0.0",
        await pathSerializationBroken(),
      );

      // should have generated a correct qlpack file
      const qlpackContents: any = yaml.load(
        packFS.fileContents("qlpack.yml").toString("utf-8"),
      );
      expect(qlpackContents.name).to.equal("codeql-remote/query");
      expect(qlpackContents.version).to.equal("0.0.0");
      expect(qlpackContents.dependencies?.["codeql/javascript-all"]).to.equal(
        "*",
      );

      const libraryDir = ".codeql/libraries/codeql";
      const packNames = packFS.directoryContents(libraryDir).sort();

      // check dependencies.
      // 2.7.4 and earlier have ['javascript-all', 'javascript-upgrades']
      // later only have ['javascript-all']. ensure this test can handle either
      expect(packNames.length).to.be.lessThan(3).and.greaterThan(0);
      expect(packNames[0]).to.deep.equal("javascript-all");
    });

    it("should cancel a run before uploading", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      const promise = remoteQueriesManager.runRemoteQuery(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      cancellationTokenSource.cancel();

      try {
        await promise;
        assert.fail("should have thrown");
      } catch (e) {
        expect(e).to.be.instanceof(UserCancellationException);
      }
    });
  });

  function verifyQlPack(
    queryPath: string,
    contents: Buffer,
    packVersion: string,
    pathSerializationBroken: boolean,
  ) {
    const qlPack = yaml.load(contents.toString("utf-8")) as QlPack;

    if (pathSerializationBroken) {
      // the path serialization is broken, so we force it to be the path in the pack to be same as the query path
      qlPack.defaultSuite![1].query = queryPath;
    }

    // don't check the build metadata since it is variable
    delete (qlPack as any).buildMetadata;

    expect(qlPack).to.deep.equal({
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

  /**
   * In version 2.7.2 and earlier, relative paths were not serialized correctly inside the qlpack.yml file.
   * So, ignore part of the test for these versions.
   *
   * @returns true if path serialization is broken in this run
   */
  async function pathSerializationBroken() {
    return lte(await cli.getVersion(), "2.7.2") && os.platform() === "win32";
  }
  function getFile(file: string): Uri {
    return Uri.file(path.join(baseDir, file));
  }
});
