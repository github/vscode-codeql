import {
  mockedObject,
  mockedOctokitFunction,
} from "../../utils/mocking.helpers";
import { GitHubDatabaseConfig } from "../../../../src/config";
import * as dialog from "../../../../src/common/vscode/dialog";
import { listDatabases } from "../../../../src/databases/github-database-api";
import { Credentials } from "../../../../src/common/authentication";
import * as Octokit from "@octokit/rest";
import { AppOctokit } from "../../../../src/common/octokit";
import { RequestError } from "@octokit/request-error";

// Mock the AppOctokit constructor to ensure we aren't making any network requests
jest.mock("../../../../src/common/octokit", () => ({
  AppOctokit: jest.fn(),
}));
const appMockListCodeqlDatabases = mockedOctokitFunction<
  "codeScanning",
  "listCodeqlDatabases"
>();
const appOctokit = mockedObject<Octokit.Octokit>({
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
  const octokit = mockedObject<Octokit.Octokit>({
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
            },
          }),
        );
      });

      it("throws an error", async () => {
        await expect(
          listDatabases(owner, repo, credentials, config),
        ).rejects.toThrowError("Not found");
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
            },
          }),
        );
      });

      it("throws an error", async () => {
        await expect(
          listDatabases(owner, repo, credentials, config),
        ).rejects.toThrowError("Internal server error");
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
              },
            }),
          );
        });

        it("throws an error", async () => {
          await expect(
            listDatabases(owner, repo, credentials, config),
          ).rejects.toThrowError("Internal server error");
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
                },
              }),
            );
          });

          it("throws an error", async () => {
            await expect(
              listDatabases(owner, repo, credentials, config),
            ).rejects.toThrowError("Not found");
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
                },
              }),
            );
          });

          it("throws an error", async () => {
            await expect(
              listDatabases(owner, repo, credentials, config),
            ).rejects.toThrowError("Internal server error");
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
