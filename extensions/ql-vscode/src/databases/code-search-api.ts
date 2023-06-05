import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { Progress, CancellationToken } from "vscode";
import { showAndLogWarningMessage } from "../helpers";
import { Credentials } from "../common/authentication";

export async function getCodeSearchRepositories(
  query: string,
  progress: Progress<{
    message?: string | undefined;
    increment?: number | undefined;
  }>,
  token: CancellationToken,
  credentials: Credentials,
): Promise<string[]> {
  let nwos: string[] = [];
  const octokit = await provideOctokitWithThrottling(credentials);

  for await (const response of octokit.paginate.iterator(
    octokit.rest.search.code,
    {
      q: query,
      per_page: 100,
    },
  )) {
    nwos.push(...response.data.map((item) => item.repository.full_name));
    // calculate progress bar: 80% of the progress bar is used for the code search
    const totalNumberOfRequests = Math.ceil(response.data.total_count / 100);
    // Since we have a maximum of 1000 responses of the api, we can use a fixed increment whenever the totalNumberOfRequests would be greater than 10
    const increment =
      totalNumberOfRequests < 10 ? 80 / totalNumberOfRequests : 8;
    progress.report({ increment });

    if (token.isCancellationRequested) {
      nwos = [];
      break;
    }
  }

  return [...new Set(nwos)];
}

async function provideOctokitWithThrottling(
  credentials: Credentials,
): Promise<Octokit> {
  const MyOctokit = Octokit.plugin(throttling);
  const auth = await credentials.getAccessToken();

  const octokit = new MyOctokit({
    auth,
    retry,
    throttle: {
      onRateLimit: (retryAfter: number, options: any): boolean => {
        void showAndLogWarningMessage(
          `Request quota exhausted for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`,
        );

        return true;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any): void => {
        void showAndLogWarningMessage(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
        );
      },
    },
  });

  return octokit;
}
