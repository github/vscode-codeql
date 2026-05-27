import { Uri } from "vscode";
import { DatabaseUI } from "../../../../src/databases/local-databases-ui";
import { testDisposeHandler } from "../../test-dispose-handler";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockedObject } from "../../utils/mocking.helpers";
import type { DatabaseFetcher } from "../../../../src/databases/database-fetcher";
import type { DatabaseItem } from "../../../../src/databases/local-databases";
import { searchSourceArchiveFiles } from "../../../../src/databases/source-archive-file-search";

jest.mock("../../../../src/databases/source-archive-file-search");
const mockedSearchSourceArchiveFiles = jest.mocked(searchSourceArchiveFiles);

describe("handleGoToFile", () => {
  const app = createMockApp({});
  const storageDir = "/tmp/test-storage";

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("when there is no current database", () => {
    const databaseUI = new DatabaseUI(
      app,
      {
        databaseItems: [],
        onDidChangeDatabaseItem: () => {
          /**/
        },
        onDidChangeCurrentDatabaseItem: () => {
          /**/
        },
        setCurrentDatabaseItem: () => {},
        currentDatabaseItem: undefined,
      } as any,
      mockedObject<DatabaseFetcher>({}),
      {
        onLanguageContextChanged: () => {
          /**/
        },
      } as any,
      {} as any,
      storageDir,
      storageDir,
    );

    afterAll(() => {
      databaseUI.dispose(testDisposeHandler);
    });

    it("should show an error message", async () => {
      const commands = databaseUI.getCommands();
      await commands["codeQL.goToFile"]();

      expect(mockedSearchSourceArchiveFiles).not.toHaveBeenCalled();
      expect(app.logger.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("No CodeQL database selected"),
      );
    });
  });

  describe("when there is a current database", () => {
    const mockDbItem = mockedObject<DatabaseItem>({
      databaseUri: Uri.file("/test/db"),
      name: "test-db",
      language: "javascript",
      sourceArchive: Uri.file("/test/db/src.zip"),
    });

    const databaseUI = new DatabaseUI(
      app,
      {
        databaseItems: [mockDbItem],
        onDidChangeDatabaseItem: () => {
          /**/
        },
        onDidChangeCurrentDatabaseItem: () => {
          /**/
        },
        setCurrentDatabaseItem: () => {},
        currentDatabaseItem: mockDbItem,
      } as any,
      mockedObject<DatabaseFetcher>({}),
      {
        onLanguageContextChanged: () => {
          /**/
        },
      } as any,
      {} as any,
      storageDir,
      storageDir,
    );

    afterAll(() => {
      databaseUI.dispose(testDisposeHandler);
    });

    it("should call searchSourceArchiveFiles with the current database", async () => {
      mockedSearchSourceArchiveFiles.mockResolvedValue(undefined);

      const commands = databaseUI.getCommands();
      await commands["codeQL.goToFile"]();

      expect(mockedSearchSourceArchiveFiles).toHaveBeenCalledWith(mockDbItem);
    });
  });
});
