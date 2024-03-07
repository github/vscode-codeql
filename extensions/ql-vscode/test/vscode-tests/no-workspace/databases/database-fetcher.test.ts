import { window } from "vscode";

import { convertGithubNwoToDatabaseUrl } from "../../../../src/databases/database-fetcher";
import type { Octokit } from "@octokit/rest";
import {
  mockedObject,
  mockedOctokitFunction,
  mockedQuickPickItem,
} from "../../utils/mocking.helpers";

// These tests make API calls and may need extra time to complete.
jest.setTimeout(10000);

describe("database-fetcher", () => {
  describe("convertGithubNwoToDatabaseUrl", () => {
    let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;

    const progressSpy = jest.fn();
    const mockListCodeqlDatabases = mockedOctokitFunction<
      "codeScanning",
      "listCodeqlDatabases"
    >();
    const octokit = mockedObject<Octokit>({
      rest: {
        codeScanning: {
          listCodeqlDatabases: mockListCodeqlDatabases,
        },
      },
    });

    // We can't make the real octokit request (since we need credentials), so we mock the response.
    const successfullMockApiResponse = {
      data: [
        {
          id: 1495869,
          name: "csharp-database",
          language: "csharp",
          uploader: {},
          content_type: "application/zip",
          state: "uploaded",
          size: 55599715,
          created_at: "2022-03-24T10:46:24Z",
          updated_at: "2022-03-24T10:46:27Z",
          url: "https://api.github.com/repositories/143040428/code-scanning/codeql/databases/csharp",
        },
        {
          id: 1100671,
          name: "database.zip",
          language: "javascript",
          uploader: {},
          content_type: "application/zip",
          state: "uploaded",
          size: 29294434,
          created_at: "2022-03-01T16:00:04Z",
          updated_at: "2022-03-01T16:00:06Z",
          url: "https://api.github.com/repositories/143040428/code-scanning/codeql/databases/javascript",
        },
        {
          id: 648738,
          name: "ql-database",
          language: "ql",
          uploader: {},
          content_type: "application/json; charset=utf-8",
          state: "uploaded",
          size: 39735500,
          created_at: "2022-02-02T09:38:50Z",
          updated_at: "2022-02-02T09:38:51Z",
          url: "https://api.github.com/repositories/143040428/code-scanning/codeql/databases/ql",
        },
      ],
    };

    beforeEach(() => {
      quickPickSpy = jest
        .spyOn(window, "showQuickPick")
        .mockResolvedValue(undefined);
    });

    it("should convert a GitHub nwo to a database url", async () => {
      mockListCodeqlDatabases.mockResolvedValue(successfullMockApiResponse);
      quickPickSpy.mockResolvedValue(
        mockedQuickPickItem({
          label: "JavaScript",
          language: "javascript",
        }),
      );
      const githubRepo = "github/codeql";
      const result = await convertGithubNwoToDatabaseUrl(
        githubRepo,
        octokit,
        progressSpy,
      );
      expect(result).toBeDefined();
      if (result === undefined) {
        return;
      }

      const { databaseUrl, name, owner } = result;

      expect(databaseUrl).toBe(
        "https://api.github.com/repositories/143040428/code-scanning/codeql/databases/javascript",
      );
      expect(name).toBe("codeql");
      expect(owner).toBe("github");
      expect(quickPickSpy).toHaveBeenNthCalledWith(
        1,
        [
          expect.objectContaining({
            label: "C#",
            description: "csharp",
            language: "csharp",
          }),
          expect.objectContaining({
            label: "JavaScript",
            description: "javascript",
            language: "javascript",
          }),
          expect.objectContaining({
            label: "ql",
            description: "ql",
            language: "ql",
          }),
        ],
        expect.anything(),
      );
    });

    // Repository doesn't exist, or the user has no access to the repository.
    it("should fail on an invalid/inaccessible repository", async () => {
      const mockApiResponse = {
        data: {
          message: "Not Found",
        },
        status: 404,
      };
      mockListCodeqlDatabases.mockResolvedValue(mockApiResponse);
      const githubRepo = "foo/bar-not-real";
      await expect(
        convertGithubNwoToDatabaseUrl(githubRepo, octokit, progressSpy),
      ).rejects.toThrow(/Unable to get database/);
      expect(progressSpy).toHaveBeenCalledTimes(0);
    });

    // User has access to the repository, but there are no databases for any language.
    it("should fail on a repository with no databases", async () => {
      const mockApiResponse = {
        data: [],
      };

      mockListCodeqlDatabases.mockResolvedValue(mockApiResponse);
      const githubRepo = "foo/bar-with-no-dbs";
      await expect(
        convertGithubNwoToDatabaseUrl(githubRepo, octokit, progressSpy),
      ).rejects.toThrow(/Unable to get database/);
      expect(progressSpy).toHaveBeenCalledTimes(1);
    });

    describe("when language is already provided", () => {
      describe("when language is valid", () => {
        it("should not prompt the user", async () => {
          mockListCodeqlDatabases.mockResolvedValue(successfullMockApiResponse);
          const githubRepo = "github/codeql";
          await convertGithubNwoToDatabaseUrl(
            githubRepo,
            octokit,
            progressSpy,
            "javascript",
          );
          expect(quickPickSpy).not.toHaveBeenCalled();
        });
      });

      describe("when language is invalid", () => {
        it("should prompt for language", async () => {
          mockListCodeqlDatabases.mockResolvedValue(successfullMockApiResponse);
          const githubRepo = "github/codeql";
          await convertGithubNwoToDatabaseUrl(
            githubRepo,
            octokit,
            progressSpy,
            "invalid-language",
          );
          expect(quickPickSpy).toHaveBeenCalled();
        });
      });
    });

    describe("when language is not provided", () => {
      it("should prompt for language", async () => {
        mockListCodeqlDatabases.mockResolvedValue(successfullMockApiResponse);
        const githubRepo = "github/codeql";
        await convertGithubNwoToDatabaseUrl(githubRepo, octokit, progressSpy);
        expect(quickPickSpy).toHaveBeenCalled();
      });
    });
  });
});
