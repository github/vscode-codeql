import { RequestError } from "@octokit/request-error";
import type { Octokit } from "@octokit/rest";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { showNeverAskAgainDialog } from "../../common/vscode/dialog";
import type { GitHubDatabaseConfig } from "../../config";
import { hasGhecDrUri } from "../../config";
import type { Credentials } from "../../common/authentication";
import { AppOctokit } from "../../common/octokit";
import type { ProgressCallback } from "../../common/vscode/progress";
import { getErrorMessage } from "../../common/helpers-pure";
import { getLanguageDisplayName } from "../../common/query-language";
import { window } from "vscode";
import { extLogger } from "../../common/logging/vscode";

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
  // On GHEC-DR, unauthenticated requests will never work, so we should always ask
  // for authentication.
  const hasAccessToken =
    !!(await credentials.getExistingAccessToken()) || hasGhecDrUri();

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

export async function convertGithubNwoToDatabaseUrl(
  nwo: string,
  octokit: Octokit,
  progress: ProgressCallback,
  language?: string,
): Promise<
  | {
      databaseUrl: string;
      owner: string;
      name: string;
      databaseId: number;
      databaseCreatedAt: string;
      commitOid: string | null;
    }
  | undefined
> {
  try {
    const [owner, repo] = nwo.split("/");

    const response = await octokit.rest.codeScanning.listCodeqlDatabases({
      owner,
      repo,
    });

    const languages = response.data.map((db) => db.language);

    if (!language || !languages.includes(language)) {
      language = await promptForLanguage(languages, progress);
      if (!language) {
        return;
      }
    }

    const databaseForLanguage = response.data.find(
      (db) => db.language === language,
    );
    if (!databaseForLanguage) {
      throw new Error(`No database found for language '${language}'`);
    }

    return {
      databaseUrl: databaseForLanguage.url,
      owner,
      name: repo,
      databaseId: databaseForLanguage.id,
      databaseCreatedAt: databaseForLanguage.created_at,
      commitOid: databaseForLanguage.commit_oid ?? null,
    };
  } catch (e) {
    void extLogger.log(`Error: ${getErrorMessage(e)}`);
    throw new Error(`Unable to get database for '${nwo}'`);
  }
}

async function promptForLanguage(
  languages: string[],
  progress: ProgressCallback | undefined,
): Promise<string | undefined> {
  progress?.({
    message: "Choose language",
    step: 2,
    maxStep: 2,
  });
  if (!languages.length) {
    throw new Error("No databases found");
  }
  if (languages.length === 1) {
    return languages[0];
  }

  const items = languages
    .map((language) => ({
      label: getLanguageDisplayName(language),
      description: language,
      language,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const selectedItem = await window.showQuickPick(items, {
    placeHolder: "Select the database language to download:",
    ignoreFocusOut: true,
  });
  if (!selectedItem) {
    return undefined;
  }

  return selectedItem.language;
}
