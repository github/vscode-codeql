import type {
  API as GitExtensionAPI,
  GitExtension,
  Repository,
} from "../common/vscode/extension/git";
import type { Uri } from "vscode";
import { extensions } from "vscode";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import { ValueResult } from "../common/value-result";

// Based on https://github.com/microsoft/sarif-vscode-extension/blob/a1740e766122c1759d9f39d580c18b82d9e0dea4/src/extension/index.activateGithubAnalyses.ts

async function getGitExtensionAPI(): Promise<
  ValueResult<GitExtensionAPI, string>
> {
  const gitExtension = extensions.getExtension<GitExtension>("vscode.git");
  if (!gitExtension) {
    return ValueResult.fail(["Git extension not found"]);
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const gitExtensionExports = gitExtension.exports;

  if (!gitExtensionExports.enabled) {
    return ValueResult.fail(["Git extension is not enabled"]);
  }

  const git = gitExtensionExports.getAPI(1);
  if (git.state === "initialized") {
    return ValueResult.ok(git);
  }

  return new Promise((resolve) => {
    git.onDidChangeState((state) => {
      if (state === "initialized") {
        resolve(ValueResult.ok(git));
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

/**
 * Finds the primary remote fetch URL for a repository.
 *
 * The priority is:
 * 1. The remote associated with the current branch
 * 2. The remote named "origin"
 * 3. The first remote
 *
 * If none of these are found, undefined is returned.
 *
 * This is just a heuristic. We may not find the correct remote in all cases,
 * for example when the user has defined an alias in their SSH or Git config.
 *
 * @param repository The repository to find the remote for.
 */
async function findRemote(repository: Repository): Promise<string | undefined> {
  // Try to retrieve the remote 5 times with a 5 second delay between each attempt.
  // This is to account for the case where the Git extension has not yet retrieved
  // the state for all Git repositories.
  // This can happen on Codespaces where the Git extension is initialized before the
  // filesystem is ready.
  for (let count = 0; count < 5; count++) {
    const remoteName = repository.state.HEAD?.upstream?.remote ?? "origin";
    const upstreamRemoteUrl = repository.state.remotes.find(
      (remote) => remote.name === remoteName,
    )?.fetchUrl;
    if (upstreamRemoteUrl) {
      return upstreamRemoteUrl;
    }

    if (remoteName !== "origin") {
      const originRemoteUrl = repository.state.remotes.find(
        (remote) => remote.name === "origin",
      )?.fetchUrl;

      if (originRemoteUrl) {
        return originRemoteUrl;
      }
    }

    // Maybe they have a different remote that is not named origin and is not the
    // upstream of the current branch. If so, just select the first one.
    const firstRemoteUrl = repository.state.remotes[0]?.fetchUrl;
    if (firstRemoteUrl) {
      return firstRemoteUrl;
    }

    // Wait for 5 seconds before trying again.
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
  const gitResult = await getGitExtensionAPI();
  if (gitResult.isFailure) {
    return ValueResult.fail(gitResult.errors);
  }

  const git = gitResult.value;

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
