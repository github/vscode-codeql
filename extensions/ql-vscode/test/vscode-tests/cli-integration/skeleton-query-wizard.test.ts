import { CodeQLCliServer } from "../../../src/cli";
import {
  QUERY_LANGUAGE_TO_DATABASE_REPO,
  SkeletonQueryWizard,
} from "../../../src/skeleton-query-wizard";
import { mockedObject, mockedQuickPickItem } from "../utils/mocking.helpers";
import * as tmp from "tmp";
import { TextDocument, window, workspace, WorkspaceFolder } from "vscode";
import { extLogger } from "../../../src/common";
import { QlPackGenerator } from "../../../src/qlpack-generator";
import * as helpers from "../../../src/helpers";
import { ensureDirSync, removeSync } from "fs-extra";
import { join } from "path";
import { CancellationTokenSource } from "vscode-jsonrpc";
import { testCredentialsWithStub } from "../../factories/authentication";
import { DatabaseItem, DatabaseManager } from "../../../src/local-databases";
import * as databaseFetcher from "../../../src/databaseFetcher";

describe("SkeletonQueryWizard", () => {
  let wizard: SkeletonQueryWizard;
  let dir: tmp.DirResult;
  let storagePath: string;
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let generateSpy: jest.SpiedFunction<
    typeof QlPackGenerator.prototype.generate
  >;
  let createExampleQlFileSpy: jest.SpiedFunction<
    typeof QlPackGenerator.prototype.createExampleQlFile
  >;
  let downloadGitHubDatabaseSpy: jest.SpiedFunction<
    typeof databaseFetcher.downloadGitHubDatabase
  >;
  let openTextDocumentSpy: jest.SpiedFunction<
    typeof workspace.openTextDocument
  >;

  const token = new CancellationTokenSource().token;
  const credentials = testCredentialsWithStub();
  const chosenLanguage = "ruby";
  const mockDatabaseManager = mockedObject<DatabaseManager>({
    setCurrentDatabaseItem: jest.fn(),
    digForDatabaseItem: jest.fn(),
  });
  const mockCli = mockedObject<CodeQLCliServer>({
    resolveLanguages: jest
      .fn()
      .mockResolvedValue([
        "ruby",
        "javascript",
        "go",
        "java",
        "python",
        "csharp",
        "cpp",
      ]),
    getSupportedLanguages: jest.fn(),
  });

  beforeEach(async () => {
    dir = tmp.dirSync({
      prefix: "skeleton_query_wizard_",
      unsafeCleanup: true,
    });

    storagePath = dir.name;

    jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
      {
        name: `codespaces-codeql`,
        uri: { path: storagePath },
      },
      {
        name: "/second/folder/path",
        uri: { path: storagePath },
      },
    ] as WorkspaceFolder[]);

    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValueOnce(mockedQuickPickItem(chosenLanguage));
    generateSpy = jest
      .spyOn(QlPackGenerator.prototype, "generate")
      .mockResolvedValue(undefined);
    createExampleQlFileSpy = jest
      .spyOn(QlPackGenerator.prototype, "createExampleQlFile")
      .mockResolvedValue(undefined);
    downloadGitHubDatabaseSpy = jest
      .spyOn(databaseFetcher, "downloadGitHubDatabase")
      .mockResolvedValue(undefined);
    openTextDocumentSpy = jest
      .spyOn(workspace, "openTextDocument")
      .mockResolvedValue({} as TextDocument);

    wizard = new SkeletonQueryWizard(
      mockCli,
      jest.fn(),
      credentials,
      extLogger,
      mockDatabaseManager,
      token,
    );
  });

  afterEach(async () => {
    dir.removeCallback();
  });

  it("should prompt for language", async () => {
    await wizard.execute();

    expect(mockCli.getSupportedLanguages).toHaveBeenCalled();
    expect(quickPickSpy).toHaveBeenCalled();
  });

  describe("if QL pack doesn't exist", () => {
    beforeEach(() => {
      jest.spyOn(helpers, "isFolderAlreadyInWorkspace").mockReturnValue(false);
    });
    it("should try to create a new QL pack based on the language", async () => {
      await wizard.execute();

      expect(generateSpy).toHaveBeenCalled();
    });

    it("should download database for selected language", async () => {
      await wizard.execute();

      expect(downloadGitHubDatabaseSpy).toHaveBeenCalled();
    });

    it("should open the query file", async () => {
      await wizard.execute();

      expect(openTextDocumentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringMatching("example.ql"),
        }),
      );
    });
  });

  describe("if QL pack exists", () => {
    beforeEach(async () => {
      jest.spyOn(helpers, "isFolderAlreadyInWorkspace").mockReturnValue(true);

      // create a skeleton codeql-custom-queries-${language} folder
      // with an example QL file inside
      ensureDirSync(
        join(dir.name, `codeql-custom-queries-${chosenLanguage}`, "example.ql"),
      );
    });

    it("should create new query file in the same QL pack folder", async () => {
      await wizard.execute();

      expect(createExampleQlFileSpy).toHaveBeenCalledWith("example2.ql");
    });

    describe("if QL pack has no query file", () => {
      it("should create new query file in the same QL pack folder", async () => {
        removeSync(
          join(
            dir.name,
            `codeql-custom-queries-${chosenLanguage}`,
            "example.ql",
          ),
        );
        await wizard.execute();

        expect(createExampleQlFileSpy).toHaveBeenCalledWith("example1.ql");
      });

      it("should open the query file", async () => {
        removeSync(
          join(
            dir.name,
            `codeql-custom-queries-${chosenLanguage}`,
            "example.ql",
          ),
        );

        await wizard.execute();

        expect(openTextDocumentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringMatching("example1.ql"),
          }),
        );
      });
    });

    describe("if database is also already downloaded", () => {
      let databaseNwo: string;
      let databaseItem: DatabaseItem;

      beforeEach(async () => {
        databaseNwo = QUERY_LANGUAGE_TO_DATABASE_REPO[chosenLanguage];

        databaseItem = {
          name: databaseNwo,
          language: chosenLanguage,
        } as DatabaseItem;

        jest
          .spyOn(mockDatabaseManager, "digForDatabaseItem")
          .mockResolvedValue([databaseItem] as any);
      });

      it("should not download a new database for language", async () => {
        await wizard.execute();

        expect(downloadGitHubDatabaseSpy).not.toHaveBeenCalled();
      });

      it("should select an existing database", async () => {
        await wizard.execute();

        expect(mockDatabaseManager.setCurrentDatabaseItem).toHaveBeenCalledWith(
          [databaseItem],
        );
      });

      it("should open the new query file", async () => {
        await wizard.execute();

        expect(openTextDocumentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            path: expect.stringMatching("example2.ql"),
          }),
        );
      });
    });

    describe("if database is missing", () => {
      beforeEach(async () => {
        jest
          .spyOn(mockDatabaseManager, "digForDatabaseItem")
          .mockResolvedValue(undefined);
      });

      it("should download a new database for language", async () => {
        await wizard.execute();

        expect(downloadGitHubDatabaseSpy).toHaveBeenCalled();
      });
    });
  });

  describe("getFirstStoragePath", () => {
    it("should return the first workspace folder", async () => {
      jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
        {
          name: "codeql-custom-queries-cpp",
          uri: { path: "codespaces-codeql" },
        },
      ] as WorkspaceFolder[]);

      wizard = new SkeletonQueryWizard(
        mockCli,
        jest.fn(),
        credentials,
        extLogger,
        mockDatabaseManager,
        token,
      );

      expect(wizard.getFirstStoragePath()).toEqual("codespaces-codeql");
    });

    describe("if user is in vscode-codeql-starter workspace", () => {
      it("should set storage path to parent folder", async () => {
        jest.spyOn(workspace, "workspaceFolders", "get").mockReturnValue([
          {
            name: "codeql-custom-queries-cpp",
            uri: { path: "vscode-codeql-starter/codeql-custom-queries-cpp" },
          },
          {
            name: "codeql-custom-queries-csharp",
            uri: { path: "vscode-codeql-starter/codeql-custom-queries-csharp" },
          },
        ] as WorkspaceFolder[]);

        wizard = new SkeletonQueryWizard(
          mockCli,
          jest.fn(),
          credentials,
          extLogger,
          mockDatabaseManager,
          token,
        );

        expect(wizard.getFirstStoragePath()).toEqual("vscode-codeql-starter");
      });
    });
  });
});
