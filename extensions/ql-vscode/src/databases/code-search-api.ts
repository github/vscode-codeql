import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";
import { CancellationToken } from "vscode";
import { Credentials } from "../common/authentication";
import { BaseLogger } from "../common/logging";
import { AppOctokit } from "../common/octokit";
import {
  ProgressCallback,
  UserCancellationException,
} from "../common/vscode/progress";

export async function getCodeSearchRepositories(
  query: string,
  progress: ProgressCallback,
  token: CancellationToken,
  credentials: Credentials,
  logger: BaseLogger,
): Promise<string[]> {
  const nwos: string[] = [];
  const octokit = await provideOctokitWithThrottling(credentials, logger);
  let i = 0;

  for await (const response of octokit.paginate.iterator(
    octokit.rest.search.code,
    {
      q: query,
      per_page: 100,
    },
  )) {
    i++;
    nwos.push(...response.data.map((item) => item.repository.full_name));
    const totalNumberOfResults = Math.ceil(response.data.total_count / 100);
    const totalNumberOfRequests =
      totalNumberOfResults > 10 ? 10 : totalNumberOfResults;
    progress({
      maxStep: totalNumberOfRequests,
      step: i,
      message: "Sending api requests to get code search results.",
    });

    if (token.isCancellationRequested) {
      throw new UserCancellationException("Code search cancelled.", true);
    }
  }

  return [...new Set(nwos)];
}

async function provideOctokitWithThrottling(
  credentials: Credentials,
  logger: BaseLogger,
): Promise<Octokit> {
  const MyOctokit = AppOctokit.plugin(throttling);
  const auth = await credentials.getAccessToken();

  const octokit = new MyOctokit({
    auth,
    throttle: {
      onRateLimit: (retryAfter: number, options: any): boolean => {
        void logger.log(
          `Rate Limit detected for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`,
        );

        return true;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any): void => {
        void logger.log(
          `Secondary Rate Limit detected for request ${options.method} ${options.url}`,
        );
      },
    },
  });

  return octokit;
}
