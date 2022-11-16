import * as sinon from "sinon";
import { expect } from "chai";
import { window } from "vscode";
import * as pq from "proxyquire";
import * as fs from "fs-extra";
import { UserCancellationException } from "../../../commandRunner";

const proxyquire = pq.noPreserveCache();

describe("repository selection", async () => {
  let sandbox: sinon.SinonSandbox;

  let quickPickSpy: sinon.SinonStub;
  let showInputBoxSpy: sinon.SinonStub;

  let getRemoteRepositoryListsSpy: sinon.SinonStub;
  let getRemoteRepositoryListsPathSpy: sinon.SinonStub;

  let pathExistsStub: sinon.SinonStub;
  let fsStatStub: sinon.SinonStub;
  let fsReadFileStub: sinon.SinonStub;

  let mod: any;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    quickPickSpy = sandbox.stub(window, "showQuickPick");
    showInputBoxSpy = sandbox.stub(window, "showInputBox");

    getRemoteRepositoryListsSpy = sandbox.stub();
    getRemoteRepositoryListsPathSpy = sandbox.stub();

    pathExistsStub = sandbox.stub(fs, "pathExists");
    fsStatStub = sandbox.stub(fs, "stat");
    fsReadFileStub = sandbox.stub(fs, "readFile");

    mod = proxyquire("../../../remote-queries/repository-selection", {
      "../config": {
        getRemoteRepositoryLists: getRemoteRepositoryListsSpy,
        getRemoteRepositoryListsPath: getRemoteRepositoryListsPathSpy,
      },
      "fs-extra": {
        pathExists: pathExistsStub,
        stat: fsStatStub,
        readFile: fsReadFileStub,
      },
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("repo lists from settings", async () => {
    it("should allow selection from repo lists from your pre-defined config", async () => {
      // Fake return values
      quickPickSpy.resolves({ repositories: ["foo/bar", "foo/baz"] });
      getRemoteRepositoryListsSpy.returns({
        list1: ["foo/bar", "foo/baz"],
        list2: [],
      });

      // Make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositoryLists).to.be.undefined;
      expect(repoSelection.owners).to.be.undefined;
      expect(repoSelection.repositories).to.deep.eq(["foo/bar", "foo/baz"]);
    });
  });

  describe("system level repo lists", async () => {
    it("should allow selection from repo lists defined at the system level", async () => {
      // Fake return values
      quickPickSpy.resolves({ repositoryList: "top_100" });
      getRemoteRepositoryListsSpy.returns({
        list1: ["foo/bar", "foo/baz"],
        list2: [],
      });

      // Make the function call
      const repoSelection = await mod.getRepositorySelection();

      // Check that the return value is correct
      expect(repoSelection.repositories).to.be.undefined;
      expect(repoSelection.owners).to.be.undefined;
      expect(repoSelection.repositoryLists).to.deep.eq(["top_100"]);
    });
  });

  describe("custom owner", async () => {
    // Test the owner regex in various "good" cases
    const goodOwners = [
      "owner",
      "owner-with-hyphens",
      "ownerWithNumbers58",
      "owner_with_underscores",
      "owner.with.periods.",
    ];
    goodOwners.forEach((owner) => {
      it(`should run on a valid owner that you enter in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.resolves({ useAllReposOfOwner: true });
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(owner);

        // Make the function call
        const repoSelection = await mod.getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositories).to.be.undefined;
        expect(repoSelection.repositoryLists).to.be.undefined;
        expect(repoSelection.owners).to.deep.eq([owner]);
      });
    });

    // Test the owner regex in various "bad" cases
    const badOwners = ["invalid&owner", "owner-with-repo/repo"];
    badOwners.forEach((owner) => {
      it(`should show an error message if you enter an invalid owner in the text box: ${owner}`, async () => {
        // Fake return values
        quickPickSpy.resolves({ useAllReposOfOwner: true });
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(owner);

        // Function call should throw a UserCancellationException
        await expect(mod.getRepositorySelection()).to.be.rejectedWith(
          Error,
          `Invalid user or organization: ${owner}`,
        );
      });
    });

    it("should be ok for the user to change their mind", async () => {
      quickPickSpy.resolves({ useAllReposOfOwner: true });
      getRemoteRepositoryListsSpy.returns({});

      // The user pressed escape to cancel the operation
      showInputBoxSpy.resolves(undefined);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        UserCancellationException,
        "No repositories selected",
      );
    });
  });

  describe("custom repo", async () => {
    // Test the repo regex in various "good" cases
    const goodRepos = [
      "owner/repo",
      "owner_with.symbols-/repo.with-symbols_",
      "ownerWithNumbers58/repoWithNumbers37",
    ];
    goodRepos.forEach((repo) => {
      it(`should run on a valid repo that you enter in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.resolves({ useCustomRepo: true });
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // Make the function call
        const repoSelection = await mod.getRepositorySelection();

        // Check that the return value is correct
        expect(repoSelection.repositoryLists).to.be.undefined;
        expect(repoSelection.owners).to.be.undefined;
        expect(repoSelection.repositories).to.deep.equal([repo]);
      });
    });

    // Test the repo regex in various "bad" cases
    const badRepos = [
      "invalid*owner/repo",
      "owner/repo+some&invalid&stuff",
      "owner-with-no-repo/",
      "/repo-with-no-owner",
    ];
    badRepos.forEach((repo) => {
      it(`should show an error message if you enter an invalid repo in the text box: ${repo}`, async () => {
        // Fake return values
        quickPickSpy.resolves({ useCustomRepo: true });
        getRemoteRepositoryListsSpy.returns({}); // no pre-defined repo lists
        showInputBoxSpy.resolves(repo);

        // Function call should throw a UserCancellationException
        await expect(mod.getRepositorySelection()).to.be.rejectedWith(
          UserCancellationException,
          "Invalid repository format",
        );
      });
    });

    it("should be ok for the user to change their mind", async () => {
      quickPickSpy.resolves({ useCustomRepo: true });
      getRemoteRepositoryListsSpy.returns({});

      // The user pressed escape to cancel the operation
      showInputBoxSpy.resolves(undefined);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        UserCancellationException,
        "No repositories selected",
      );
    });
  });

  describe("external repository lists file", async () => {
    it("should fail if path does not exist", async () => {
      const fakeFilePath = "/path/that/does/not/exist.json";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(false);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        Error,
        `External repository lists file does not exist at ${fakeFilePath}`,
      );
    });

    it("should fail if path points to directory", async () => {
      const fakeFilePath = "/path/to/dir";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(true);
      fsStatStub.resolves({ isDirectory: () => true } as any);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        Error,
        "External repository lists path should not point to a directory",
      );
    });

    it("should fail if file does not have valid JSON", async () => {
      const fakeFilePath = "/path/to/file.json";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(true);
      fsStatStub.resolves({ isDirectory: () => false } as any);
      fsReadFileStub.resolves("not-json" as any as Buffer);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        Error,
        "Invalid repository lists file. It should contain valid JSON.",
      );
    });

    it("should fail if file contains array", async () => {
      const fakeFilePath = "/path/to/file.json";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(true);
      fsStatStub.resolves({ isDirectory: () => false } as any);
      fsReadFileStub.resolves("[]" as any as Buffer);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        Error,
        "Invalid repository lists file. It should be an object mapping names to a list of repositories.",
      );
    });

    it("should fail if file does not contain repo lists in the right format", async () => {
      const fakeFilePath = "/path/to/file.json";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(true);
      fsStatStub.resolves({ isDirectory: () => false } as any);
      const repoLists = {
        list1: "owner1/repo1",
      };
      fsReadFileStub.resolves(JSON.stringify(repoLists) as any as Buffer);

      await expect(mod.getRepositorySelection()).to.be.rejectedWith(
        Error,
        "Invalid repository lists file. It should contain an array of repositories for each list.",
      );
    });

    it("should get repo lists from file", async () => {
      const fakeFilePath = "/path/to/file.json";
      getRemoteRepositoryListsPathSpy.returns(fakeFilePath);
      pathExistsStub.resolves(true);
      fsStatStub.resolves({ isDirectory: () => false } as any);
      const repoLists = {
        list1: ["owner1/repo1", "owner2/repo2"],
        list2: ["owner3/repo3"],
      };
      fsReadFileStub.resolves(JSON.stringify(repoLists) as any as Buffer);
      getRemoteRepositoryListsSpy.returns({
        list3: ["onwer4/repo4"],
        list4: [],
      });

      quickPickSpy.resolves({ repositories: ["owner3/repo3"] });

      const repoSelection = await mod.getRepositorySelection();

      expect(repoSelection.repositoryLists).to.be.undefined;
      expect(repoSelection.owners).to.be.undefined;
      expect(repoSelection.repositories).to.deep.eq(["owner3/repo3"]);
    });
  });
});
