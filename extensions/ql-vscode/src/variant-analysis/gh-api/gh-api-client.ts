import type { Credentials } from "../../common/authentication";
import type { Repository } from "./repository";

export async function getRepositoryFromNwo(
  credentials: Credentials,
  owner: string,
  repo: string,
): Promise<Repository> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data as Repository;
}

/**
 * Creates a gist with the given description and files.
 * Returns the URL of the created gist.
 */
export async function createGist(
  credentials: Credentials,
  description: string,
  files: { [key: string]: { content: string } },
): Promise<string | undefined> {
  const octokit = await credentials.getOctokit();
  const response = await octokit.request("POST /gists", {
    description,
    files,
    public: false,
  });
  if (response.status >= 300) {
    throw new Error(
      `Error exporting variant analysis results: ${response.status} ${JSON.stringify(
        response?.data,
      )}`,
    );
  }
  return response.data.html_url;
}
