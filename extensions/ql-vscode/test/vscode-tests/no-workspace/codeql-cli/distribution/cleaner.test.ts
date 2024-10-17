import { ExtensionManagedDistributionCleaner } from "../../../../../src/codeql-cli/distribution/cleaner";
import { mockedObject } from "../../../../mocked-object";
import type { ExtensionContext } from "vscode";
import { Uri } from "vscode";
import { createMockLogger } from "../../../../__mocks__/loggerMock";
import type { DirectoryResult } from "tmp-promise";
import { dir } from "tmp-promise";
import { outputFile, pathExists } from "fs-extra";
import { join } from "path";
import { codeQlLauncherName } from "../../../../../src/common/distribution";
import { getDirectoryNamesInsidePath } from "../../../../../src/common/files";

describe("ExtensionManagedDistributionCleaner", () => {
  let globalStorageDirectory: DirectoryResult;

  let manager: ExtensionManagedDistributionCleaner;

  beforeEach(async () => {
    globalStorageDirectory = await dir({
      unsafeCleanup: true,
    });

    manager = new ExtensionManagedDistributionCleaner(
      mockedObject<ExtensionContext>({
        globalStorageUri: Uri.file(globalStorageDirectory.path),
      }),
      createMockLogger(),
      {
        folderIndex: 768,
        distributionFolderPrefix: "distribution",
      },
    );

    // Mock setTimeout to call the callback immediately
    jest.spyOn(global, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  afterEach(async () => {
    await globalStorageDirectory.cleanup();
  });

  it("does nothing when no distributions exist", async () => {
    await manager.cleanup();
  });

  it("does nothing when only the current distribution exists", async () => {
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution768",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );

    await manager.cleanup();

    expect(
      await pathExists(
        join(
          globalStorageDirectory.path,
          "distribution768",
          "codeql",
          "bin",
          codeQlLauncherName(),
        ),
      ),
    ).toBe(true);
  });

  it("removes old distributions", async () => {
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution12",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution244",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution637",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution768",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );
    await outputFile(
      join(
        globalStorageDirectory.path,
        "distribution890",
        "codeql",
        "bin",
        codeQlLauncherName(),
      ),
      "launcher!",
    );

    const promise = manager.cleanup();

    await promise;

    expect(
      (await getDirectoryNamesInsidePath(globalStorageDirectory.path)).sort(),
    ).toEqual(["distribution768", "distribution890"]);
  });
});
