import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { showNeverAskAgainDialog } from "../../common/vscode/dialog";
import { GitHubDatabaseConfig } from "../../config";
import { Credentials } from "../../common/authentication";
import { AppOctokit } from "../../common/octokit";

export type CodeqlDatabase =
  RestEndpointMethodTypes["codeScanning"]["listCodeqlDatabases"]["response"]["data"][number];

/**
 * Ask the user if they want to connect to GitHub to download CodeQL databases.
 * This should be used when the user does not have an access token and should
 * be followed by an access token prompt.
 */
async function askForGitHubConnect(
  config: GitHubDatabaseConfig,
): Promise<boolean> {
  const answer = await showNeverAskAgainDialog(
    "This repository has an origin (GitHub) that may have one or more CodeQL databases. Connect to GitHub and download any existing databases?",
    false,
    "Connect",
    "Not now",
    "Never",
  );

  if (answer === "Not now" || answer === undefined) {
    return false;
  }

  if (answer === "Never") {
    await config.setDownload("never");
    return false;
  }

  return true;
}

export type ListDatabasesResult = {
  /**
   * Whether the user has been prompted for credentials. This can be used to determine
   * follow-up actions based on whether the user has already had any feedback.
   */
  promptedForCredentials: boolean;
  databases: CodeqlDatabase[];
  octokit: Octokit;
};

/**
 * List CodeQL databases for a GitHub repository.
 *
 * This will first try to fetch the CodeQL databases for the repository with
 * existing credentials (or none if there are none). If that fails, it will
 * prompt the user to connect to GitHub and try again.
 *
 * If the user does not want to connect to GitHub, this will return `undefined`.
 */
export async function listDatabases(
  owner: string,
  repo: string,
  credentials: Credentials,
  config: GitHubDatabaseConfig,
): Promise<ListDatabasesResult | undefined> {
  const hasAccessToken = !!(await credentials.getExistingAccessToken());

  let octokit = hasAccessToken
    ? await credentials.getOctokit()
    : new AppOctokit();

  let promptedForCredentials = false;

  let databases: CodeqlDatabase[];
  try {
    const response = await octokit.rest.codeScanning.listCodeqlDatabases({
      owner,
      repo,
    });
    databases = response.data;
  } catch (e) {
    // If we get a 404 when we don't have an access token, it might be because
    // the repository is private/internal. Therefore, we should ask the user
    // whether they want to connect to GitHub and try again.
    if (e instanceof RequestError && e.status === 404 && !hasAccessToken) {
      // Check whether the user wants to connect to GitHub
      if (!(await askForGitHubConnect(config))) {
        return;
      }

      // Prompt for credentials
      octokit = await credentials.getOctokit();

      promptedForCredentials = true;

      const response = await octokit.rest.codeScanning.listCodeqlDatabases({
        owner,
        repo,
      });
      databases = response.data;
    } else {
      throw e;
    }
  }

  return {
    promptedForCredentials,
    databases,
    octokit,
  };
}
