import {
  API as GitExtensionAPI,
  GitExtension,
  Repository,
} from "../common/vscode/extension/git";
import { extensions, Uri } from "vscode";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import { ValueResult } from "../common/value-result";

// Based on https://github.com/microsoft/sarif-vscode-extension/blob/a1740e766122c1759d9f39d580c18b82d9e0dea4/src/extension/index.activateGithubAnalyses.ts

async function getGitExtensionAPI(): Promise<GitExtensionAPI | undefined> {
  const gitExtension =
    extensions.getExtension<GitExtension>("vscode.git")?.exports;
  if (!gitExtension) {
    return undefined;
  }

  const git = gitExtension.getAPI(1);
  if (git.state === "initialized") {
    return git;
  }

  return new Promise((resolve) => {
    git.onDidChangeState((state) => {
      if (state === "initialized") {
        resolve(git);
      }
    });
  });
}

async function findRepositoryForWorkspaceFolder(
  git: GitExtensionAPI,
  workspaceFolderUri: Uri,
): Promise<Repository | undefined> {
  return git.repositories.find(
    (repo) => repo.rootUri.toString() === workspaceFolderUri.toString(),
  );
}

async function findRemote(repository: Repository): Promise<string | undefined> {
  // Try to retrieve the remote 5 times with a 5 second delay between each attempt.
  // This is to account for the case where the Git extension is still initializing.
  for (let count = 0; count < 5; count++) {
    const remoteName = repository.state.HEAD?.upstream?.remote ?? "origin";
    const originRemoteUrl = repository.state.remotes.find(
      (remote) => remote.name === remoteName,
    )?.fetchUrl;
    if (originRemoteUrl) {
      return originRemoteUrl;
    }

    const firstRemoteUrl = repository.state.remotes[0]?.fetchUrl;
    if (firstRemoteUrl) {
      return firstRemoteUrl;
    }

    // Wait for Git to initialize.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return undefined;
}

// Example: https://github.com/github/vscode-codeql.git
const githubHTTPSRegex =
  /https:\/\/github\.com\/(?<owner>[^/]+)\/(?<name>[^/]+)/;

// Example: git@github.com:github/vscode-codeql.git
const githubSSHRegex = /git@github\.com:(?<owner>[^/]+)\/(?<name>[^/]+)/;

function findGitHubRepositoryForRemote(remoteUrl: string):
  | {
      owner: string;
      name: string;
    }
  | undefined {
  const match =
    remoteUrl.match(githubHTTPSRegex) ?? remoteUrl.match(githubSSHRegex);
  if (!match) {
    return undefined;
  }

  const owner = match.groups?.owner;
  let name = match.groups?.name;

  if (!owner || !name) {
    return undefined;
  }

  // If a repository ends with ".git", remove it.
  if (name.endsWith(".git")) {
    name = name.slice(0, -4);
  }

  return {
    owner,
    name,
  };
}

export async function findGitHubRepositoryForWorkspace(): Promise<
  ValueResult<{ owner: string; name: string }, string>
> {
  const git = await getGitExtensionAPI();
  if (!git) {
    return ValueResult.fail(["Git extension is not installed or initialized"]);
  }

  const primaryWorkspaceFolder = getOnDiskWorkspaceFoldersObjects()[0]?.uri;
  if (!primaryWorkspaceFolder) {
    return ValueResult.fail(["No workspace folder found"]);
  }

  const primaryRepository = await findRepositoryForWorkspaceFolder(
    git,
    primaryWorkspaceFolder,
  );
  if (!primaryRepository) {
    return ValueResult.fail([
      "No Git repository found in primary workspace folder",
    ]);
  }

  const remoteUrl = await findRemote(primaryRepository);
  if (!remoteUrl) {
    return ValueResult.fail(["No remote found"]);
  }

  const repoNwo = findGitHubRepositoryForRemote(remoteUrl);
  if (!repoNwo) {
    return ValueResult.fail(["Remote is not a GitHub repository"]);
  }

  const { owner, name } = repoNwo;

  return ValueResult.ok({ owner, name });
}
