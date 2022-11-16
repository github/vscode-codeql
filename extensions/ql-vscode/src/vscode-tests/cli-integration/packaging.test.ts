import * as sinon from "sinon";
import { extensions, window } from "vscode";
import * as path from "path";

import * as pq from "proxyquire";

import { CliVersionConstraint, CodeQLCliServer } from "../../cli";
import { CodeQLExtensionInterface } from "../../extension";
import { expect } from "chai";
import { getErrorMessage } from "../../pure/helpers-pure";

const proxyquire = pq.noPreserveCache();

describe("Packaging commands", function () {
  let sandbox: sinon.SinonSandbox;

  // up to 3 minutes per test
  this.timeout(3 * 60 * 1000);

  let cli: CodeQLCliServer;
  let progress: sinon.SinonSpy;
  let quickPickSpy: sinon.SinonStub;
  let inputBoxSpy: sinon.SinonStub;
  let showAndLogErrorMessageSpy: sinon.SinonStub;
  let showAndLogInformationMessageSpy: sinon.SinonStub;
  let mod: any;

  beforeEach(async function () {
    sandbox = sinon.createSandbox();
    progress = sandbox.spy();
    quickPickSpy = sandbox.stub(window, "showQuickPick");
    inputBoxSpy = sandbox.stub(window, "showInputBox");
    showAndLogErrorMessageSpy = sandbox.stub();
    showAndLogInformationMessageSpy = sandbox.stub();
    mod = proxyquire("../../packaging", {
      "./helpers": {
        showAndLogErrorMessage: showAndLogErrorMessageSpy,
        showAndLogInformationMessage: showAndLogInformationMessageSpy,
      },
    });

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
    if (!(await cli.cliConstraints.supportsPackaging())) {
      console.log(
        `Packaging commands are not supported on CodeQL CLI v${CliVersionConstraint.CLI_VERSION_WITH_PACKAGING}. Skipping this test.`,
      );
      this.skip();
    }
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should download all core query packs", async () => {
    quickPickSpy.resolves("Download all core query packs");

    await mod.handleDownloadPacks(cli, progress);
    expect(showAndLogInformationMessageSpy.firstCall.args[0]).to.contain(
      "Finished downloading packs.",
    );
  });

  it("should download valid user-specified pack", async () => {
    quickPickSpy.resolves("Download custom specified pack");
    inputBoxSpy.resolves("codeql/csharp-solorigate-queries");

    await mod.handleDownloadPacks(cli, progress);
    expect(showAndLogInformationMessageSpy.firstCall.args[0]).to.contain(
      "Finished downloading packs.",
    );
  });

  it("should show error when downloading invalid user-specified pack", async () => {
    quickPickSpy.resolves("Download custom specified pack");
    inputBoxSpy.resolves("foo/not-a-real-pack@0.0.1");

    await mod.handleDownloadPacks(cli, progress);

    expect(showAndLogErrorMessageSpy.firstCall.args[0]).to.contain(
      "Unable to download all packs.",
    );
  });

  it("should install valid workspace pack", async () => {
    const rootDir = path.join(
      __dirname,
      "../../../src/vscode-tests/cli-integration/data",
    );
    quickPickSpy.resolves([
      {
        label: "integration-test-queries-javascript",
        packRootDir: [rootDir],
      },
    ]);

    await mod.handleInstallPackDependencies(cli, progress);
    expect(showAndLogInformationMessageSpy.firstCall.args[0]).to.contain(
      "Finished installing pack dependencies.",
    );
  });

  it("should throw an error when installing invalid workspace pack", async () => {
    const rootDir = path.join(
      __dirname,
      "../../../src/vscode-tests/cli-integration/data-invalid-pack",
    );
    quickPickSpy.resolves([
      {
        label: "foo/bar",
        packRootDir: [rootDir],
      },
    ]);

    try {
      // expect this to throw an error
      await mod.handleInstallPackDependencies(cli, progress);
      // This line should not be reached
      expect(true).to.be.false;
    } catch (e) {
      expect(getErrorMessage(e)).to.contain(
        "Unable to install pack dependencies",
      );
    }
  });
});
