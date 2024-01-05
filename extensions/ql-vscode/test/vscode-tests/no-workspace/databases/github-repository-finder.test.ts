import type { Extension } from "vscode";
import { extensions, Uri } from "vscode";
import * as workspaceFolders from "../../../../src/common/vscode/workspace-folders";
import type {
  GitExtension,
  API as GitExtensionAPI,
} from "../../../../src/common/vscode/extension/git";
import { mockedObject } from "../../utils/mocking.helpers";
import { findGitHubRepositoryForWorkspace } from "../../../../src/databases/github-repository-finder";
import { ValueResult } from "../../../../src/common/value-result";

describe("findGitHubRepositoryForWorkspace", () => {
  let mockGitExtensionAPI: GitExtensionAPI;

  let getOnDiskWorkspaceFolderObjectsSpy: jest.SpiedFunction<
    typeof workspaceFolders.getOnDiskWorkspaceFoldersObjects
  >;
  let getExtensionSpy: jest.SpiedFunction<typeof extensions.getExtension>;
  const getAPISpy: jest.MockedFunction<GitExtension["getAPI"]> = jest.fn();

  const repositories = [
    {
      rootUri: Uri.file("a/b/c"),
      state: {
        HEAD: {
          name: "main",
          upstream: {
            name: "origin",
            remote: "fork",
          },
        },
        remotes: [
          {
            name: "origin",
            fetchUrl: "https://github.com/codeql/test-incorrect.git",
          },
          {
            name: "fork",
            fetchUrl: "https://github.com/codeql/test.git",
          },
        ],
      },
    },
  ];

  beforeEach(() => {
    mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
      state: "initialized",
      repositories,
    });

    getOnDiskWorkspaceFolderObjectsSpy = jest.spyOn(
      workspaceFolders,
      "getOnDiskWorkspaceFoldersObjects",
    );
    getExtensionSpy = jest.spyOn(extensions, "getExtension");

    getOnDiskWorkspaceFolderObjectsSpy.mockReturnValue([
      {
        name: "workspace1",
        uri: Uri.file("/a/b/c"),
        index: 0,
      },
    ]);

    getExtensionSpy.mockReturnValue(
      mockedObject<Extension<GitExtension>>({
        isActive: true,
        exports: {
          enabled: true,
          getAPI: getAPISpy,
        },
      }),
    );

    getAPISpy.mockReturnValue(mockGitExtensionAPI);
  });

  it("returns the GitHub repository name with owner", async () => {
    expect(await findGitHubRepositoryForWorkspace()).toEqual(
      ValueResult.ok({
        owner: "codeql",
        name: "test",
      }),
    );
  });

  describe("when the git extension is not installed or disabled", () => {
    beforeEach(() => {
      getExtensionSpy.mockReturnValue(undefined);
    });

    it("returns an error", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.fail(["Git extension not found"]),
      );
    });
  });

  describe("when the git extension is not activated", () => {
    const activate = jest.fn();

    beforeEach(() => {
      getExtensionSpy.mockReturnValue(
        mockedObject<Extension<GitExtension>>({
          isActive: false,
          activate,
          exports: {
            enabled: true,
            getAPI: getAPISpy,
          },
        }),
      );
    });

    it("returns the GitHub repository name with owner", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.ok({
          owner: "codeql",
          name: "test",
        }),
      );

      expect(activate).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the git extension is disabled by the setting", () => {
    beforeEach(() => {
      getExtensionSpy.mockReturnValue(
        mockedObject<Extension<GitExtension>>({
          isActive: true,
          exports: {
            enabled: false,
            getAPI: getAPISpy,
          },
        }),
      );
    });

    it("returns an error", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.fail(["Git extension is not enabled"]),
      );

      expect(getAPISpy).not.toHaveBeenCalled();
    });
  });

  describe("when the git extension is not yet initialized", () => {
    beforeEach(() => {
      const onDidChangeState = jest.fn();

      onDidChangeState.mockImplementation((callback) => {
        callback("initialized");
      });

      mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
        state: "uninitialized",
        onDidChangeState,
        repositories,
      });

      getAPISpy.mockReturnValue(mockGitExtensionAPI);
    });

    it("returns the GitHub repository name with owner", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.ok({
          owner: "codeql",
          name: "test",
        }),
      );
    });
  });

  describe("when there are no workspace folders", () => {
    beforeEach(() => {
      getOnDiskWorkspaceFolderObjectsSpy.mockReturnValue([]);
    });

    it("returns an error", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.fail(["No workspace folder found"]),
      );
    });
  });

  describe("when the workspace folder does not match a Git repository", () => {
    beforeEach(() => {
      getOnDiskWorkspaceFolderObjectsSpy.mockReturnValue([
        {
          name: "workspace1",
          uri: Uri.file("/a/b/d"),
          index: 0,
        },
      ]);
    });

    it("returns an error", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.fail([
          "No Git repository found in primary workspace folder",
        ]),
      );
    });
  });

  describe("when the current branch does not have a remote but origin remote exists", () => {
    beforeEach(() => {
      mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
        state: "initialized",
        repositories: [
          {
            ...repositories[0],
            state: {
              ...repositories[0].state,
              HEAD: {
                ...repositories[0].state.HEAD,
                upstream: undefined,
              },
              remotes: [
                {
                  name: "upstream",
                  fetchUrl: "https://github.com/github/codeql-incorrect.git",
                },
                {
                  name: "origin",
                  fetchUrl: "https://github.com/github/codeql.git",
                },
              ],
            },
          },
        ],
      });

      getAPISpy.mockReturnValue(mockGitExtensionAPI);
    });

    it("returns the GitHub repository name with owner", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.ok({
          owner: "github",
          name: "codeql",
        }),
      );
    });
  });

  describe("when the current branch does not have a remote and no origin remote", () => {
    beforeEach(() => {
      mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
        state: "initialized",
        repositories: [
          {
            ...repositories[0],
            state: {
              ...repositories[0].state,
              HEAD: {
                ...repositories[0].state.HEAD,
                upstream: undefined,
              },
              remotes: [
                {
                  name: "upstream",
                  fetchUrl: "https://github.com/github/codeql.git",
                },
                {
                  name: "fork",
                  fetchUrl: "https://github.com/github/codeql-incorrect.git",
                },
              ],
            },
          },
        ],
      });

      getAPISpy.mockReturnValue(mockGitExtensionAPI);
    });

    it("returns the GitHub repository name with owner", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.ok({
          owner: "github",
          name: "codeql",
        }),
      );
    });
  });

  describe("when the remote is an SSH GitHub URL", () => {
    beforeEach(() => {
      mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
        state: "initialized",
        repositories: [
          {
            ...repositories[0],
            state: {
              ...repositories[0].state,
              remotes: [
                {
                  name: "origin",
                  fetchUrl: "git@github.com:github/codeql.git",
                },
              ],
            },
          },
        ],
      });

      getAPISpy.mockReturnValue(mockGitExtensionAPI);
    });

    it("returns the GitHub repository name with owner", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.ok({
          owner: "github",
          name: "codeql",
        }),
      );
    });
  });

  describe("when the remote does not match a GitHub repository", () => {
    beforeEach(() => {
      mockGitExtensionAPI = mockedObject<GitExtensionAPI>({
        state: "initialized",
        repositories: [
          {
            ...repositories[0],
            state: {
              ...repositories[0].state,
              remotes: [
                {
                  name: "origin",
                  fetchUrl: "https://example.com/codeql/test.git",
                },
              ],
            },
          },
        ],
      });

      getAPISpy.mockReturnValue(mockGitExtensionAPI);
    });

    it("returns an error", async () => {
      expect(await findGitHubRepositoryForWorkspace()).toEqual(
        ValueResult.fail(["Remote is not a GitHub repository"]),
      );
    });
  });
});
