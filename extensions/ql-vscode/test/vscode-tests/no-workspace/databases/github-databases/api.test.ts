import {
  mockedObject,
  mockedOctokitFunction,
  mockedQuickPickItem,
} from "../../../utils/mocking.helpers";
import type { GitHubDatabaseConfig } from "../../../../../src/config";
import * as dialog from "../../../../../src/common/vscode/dialog";
import {
  convertGithubNwoToDatabaseUrl,
  listDatabases,
} from "../../../../../src/databases/github-databases/api";
import type { Credentials } from "../../../../../src/common/authentication";
import type { Octokit } from "@octokit/rest";
import { AppOctokit } from "../../../../../src/common/octokit";
import { RequestError } from "@octokit/request-error";
import { window } from "vscode";

// Mock the AppOctokit constructor to ensure we aren't making any network requests
jest.mock("../../../../../src/common/octokit", () => ({
  AppOctokit: jest.fn(),
}));
const appMockListCodeqlDatabases = mockedOctokitFunction<
  "codeScanning",
  "listCodeqlDatabases"
>();
const appOctokit = mockedObject<Octokit>({
  rest: {
    codeScanning: {
      listCodeqlDatabases: appMockListCodeqlDatabases,
    },
  },
});
beforeEach(() => {
  (AppOctokit as unknown as jest.Mock).mockImplementation(() => appOctokit);
});

describe("listDatabases", () => {
  const owner = "github";
  const repo = "codeql";

  const setDownload = jest.fn();
  let config: GitHubDatabaseConfig;
  let credentials: Credentials;

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

  const databases = [
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
  ];

  const successfulMockApiResponse = {
    data: databases,
  };

  let showNeverAskAgainDialogSpy: jest.SpiedFunction<
    typeof dialog.showNeverAskAgainDialog
  >;

  beforeEach(() => {
    config = mockedObject<GitHubDatabaseConfig>({
      setDownload,
    });

    mockListCodeqlDatabases.mockResolvedValue(successfulMockApiResponse);

    showNeverAskAgainDialogSpy = jest
      .spyOn(dialog, "showNeverAskAgainDialog")
      .mockResolvedValue("Connect");
  });

  describe("when the user has an access token", () => {
    beforeEach(() => {
      credentials = mockedObject<Credentials>({
        getExistingAccessToken: () => "ghp_xxx",
        getOctokit: () => octokit,
      });
    });

    it("returns the databases", async () => {
      expect(await listDatabases(owner, repo, credentials, config)).toEqual({
        databases,
        promptedForCredentials: false,
        octokit,
      });
    });

    describe("when the request fails with a 404", () => {
      beforeEach(() => {
        mockListCodeqlDatabases.mockRejectedValue(
          new RequestError("Not found", 404, {
            request: {
              method: "GET",
              url: "",
              headers: {},
            },
            response: {
              status: 404,
              headers: {},
              url: "",
              data: {},
              retryCount: 0,
            },
          }),
        );
      });

      it("throws an error", async () => {
        await expect(
          listDatabases(owner, repo, credentials, config),
        ).rejects.toThrow("Not found");
      });
    });

    describe("when the request fails with a 500", () => {
      beforeEach(() => {
        mockListCodeqlDatabases.mockRejectedValue(
          new RequestError("Internal server error", 500, {
            request: {
              method: "GET",
              url: "",
              headers: {},
            },
            response: {
              status: 500,
              headers: {},
              url: "",
              data: {},
              retryCount: 0,
            },
          }),
        );
      });

      it("throws an error", async () => {
        await expect(
          listDatabases(owner, repo, credentials, config),
        ).rejects.toThrow("Internal server error");
      });
    });
  });

  describe("when the user does not have an access token", () => {
    describe("when the repo is public", () => {
      beforeEach(() => {
        credentials = mockedObject<Credentials>({
          getExistingAccessToken: () => undefined,
        });

        mockListCodeqlDatabases.mockResolvedValue(undefined);
        appMockListCodeqlDatabases.mockResolvedValue(successfulMockApiResponse);
      });

      it("returns the databases", async () => {
        const result = await listDatabases(owner, repo, credentials, config);
        expect(result).toEqual({
          databases,
          promptedForCredentials: false,
          octokit: appOctokit,
        });
        expect(showNeverAskAgainDialogSpy).not.toHaveBeenCalled();
      });

      describe("when the request fails with a 500", () => {
        beforeEach(() => {
          appMockListCodeqlDatabases.mockRejectedValue(
            new RequestError("Internal server error", 500, {
              request: {
                method: "GET",
                url: "",
                headers: {},
              },
              response: {
                status: 500,
                headers: {},
                url: "",
                data: {},
                retryCount: 0,
              },
            }),
          );
        });

        it("throws an error", async () => {
          await expect(
            listDatabases(owner, repo, credentials, config),
          ).rejects.toThrow("Internal server error");
          expect(mockListCodeqlDatabases).not.toHaveBeenCalled();
        });
      });
    });

    describe("when the repo is private", () => {
      beforeEach(() => {
        credentials = mockedObject<Credentials>({
          getExistingAccessToken: () => undefined,
          getOctokit: () => octokit,
        });

        appMockListCodeqlDatabases.mockRejectedValue(
          new RequestError("Not found", 404, {
            request: {
              method: "GET",
              url: "",
              headers: {},
            },
            response: {
              status: 404,
              headers: {},
              url: "",
              data: {},
              retryCount: 0,
            },
          }),
        );
      });

      describe("when answering connect to prompt", () => {
        beforeEach(() => {
          showNeverAskAgainDialogSpy.mockResolvedValue("Connect");
        });

        it("returns the databases", async () => {
          const result = await listDatabases(owner, repo, credentials, config);
          expect(result).toEqual({
            databases,
            promptedForCredentials: true,
            octokit,
          });
          expect(showNeverAskAgainDialogSpy).toHaveBeenCalled();
          expect(appMockListCodeqlDatabases).toHaveBeenCalled();
          expect(mockListCodeqlDatabases).toHaveBeenCalled();
        });

        describe("when the request fails with a 404", () => {
          beforeEach(() => {
            mockListCodeqlDatabases.mockRejectedValue(
              new RequestError("Not found", 404, {
                request: {
                  method: "GET",
                  url: "",
                  headers: {},
                },
                response: {
                  status: 404,
                  headers: {},
                  url: "",
                  data: {},
                  retryCount: 0,
                },
              }),
            );
          });

          it("throws an error", async () => {
            await expect(
              listDatabases(owner, repo, credentials, config),
            ).rejects.toThrow("Not found");
          });
        });

        describe("when the request fails with a 500", () => {
          beforeEach(() => {
            mockListCodeqlDatabases.mockRejectedValue(
              new RequestError("Internal server error", 500, {
                request: {
                  method: "GET",
                  url: "",
                  headers: {},
                },
                response: {
                  status: 500,
                  headers: {},
                  url: "",
                  data: {},
                  retryCount: 0,
                },
              }),
            );
          });

          it("throws an error", async () => {
            await expect(
              listDatabases(owner, repo, credentials, config),
            ).rejects.toThrow("Internal server error");
          });
        });
      });

      describe("when cancelling prompt", () => {
        beforeEach(() => {
          showNeverAskAgainDialogSpy.mockResolvedValue(undefined);
        });

        it("returns undefined", async () => {
          const result = await listDatabases(owner, repo, credentials, config);
          expect(result).toEqual(undefined);
          expect(showNeverAskAgainDialogSpy).toHaveBeenCalled();
          expect(appMockListCodeqlDatabases).toHaveBeenCalled();
          expect(mockListCodeqlDatabases).not.toHaveBeenCalled();
          expect(setDownload).not.toHaveBeenCalled();
        });
      });

      describe("when answering not now to prompt", () => {
        beforeEach(() => {
          showNeverAskAgainDialogSpy.mockResolvedValue("Not now");
        });

        it("returns undefined", async () => {
          const result = await listDatabases(owner, repo, credentials, config);
          expect(result).toEqual(undefined);
          expect(showNeverAskAgainDialogSpy).toHaveBeenCalled();
          expect(appMockListCodeqlDatabases).toHaveBeenCalled();
          expect(mockListCodeqlDatabases).not.toHaveBeenCalled();
          expect(setDownload).not.toHaveBeenCalled();
        });
      });

      describe("when answering never to prompt", () => {
        beforeEach(() => {
          showNeverAskAgainDialogSpy.mockResolvedValue("Never");
        });

        it("returns undefined and sets the config to 'never'", async () => {
          const result = await listDatabases(owner, repo, credentials, config);
          expect(result).toEqual(undefined);
          expect(showNeverAskAgainDialogSpy).toHaveBeenCalled();
          expect(appMockListCodeqlDatabases).toHaveBeenCalled();
          expect(mockListCodeqlDatabases).not.toHaveBeenCalled();
          expect(setDownload).toHaveBeenCalledWith("never");
        });
      });
    });
  });
});

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
